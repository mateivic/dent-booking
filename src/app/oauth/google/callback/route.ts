import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  REQUIRED_SCOPES,
  buildOAuthClient,
  fetchGoogleUserEmail,
} from "@/features/calendar/lib/google";
import { verifyOAuthState } from "@/features/calendar/lib/oauth-state";

// Top-level, off-tenant. Google redirects here after consent. The state param
// carries the locationId we're connecting; after upserting calendar_integrations
// we redirect to the tenant's subdomain.

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return redirectToTenant(null, errorParams(`Google denied access: ${oauthError}`));
  }
  if (!code || !state) {
    return redirectToTenant(null, errorParams("Missing code or state"));
  }

  let locationId: string;
  try {
    ({ locationId } = await verifyOAuthState(state));
  } catch (err) {
    console.error("[oauth/google/callback] state verification failed", err);
    return redirectToTenant(null, errorParams("Invalid or expired authorization request"));
  }

  const service = getSupabaseServiceRoleClient();
  const { data: location } = await service
    .from("locations")
    .select("id, tenant_id")
    .eq("id", locationId)
    .maybeSingle();
  if (!location) {
    return redirectToTenant(null, errorParams("Location not found"));
  }
  const { data: tenant } = await service
    .from("tenants")
    .select("subdomain")
    .eq("id", location.tenant_id)
    .maybeSingle();
  const subdomain = tenant?.subdomain ?? null;

  const oauth2 = buildOAuthClient();
  let tokenResp;
  try {
    tokenResp = await oauth2.getToken(code);
  } catch (err) {
    console.error("[oauth/google/callback] token exchange failed", err);
    return redirectToTenant(subdomain, errorParams("Could not complete Google authorization"));
  }

  const tokens = tokenResp.tokens;
  if (!tokens.refresh_token) {
    return redirectToTenant(
      subdomain,
      errorParams(
        "No refresh token returned. Revoke the app at myaccount.google.com and try again.",
      ),
    );
  }

  const grantedScopes = (tokens.scope ?? "").split(" ").filter(Boolean);
  const missingScopes = REQUIRED_SCOPES.filter(
    (s) => s !== "openid" && s !== "email" && !grantedScopes.includes(s),
  );
  if (missingScopes.length > 0) {
    return redirectToTenant(
      subdomain,
      errorParams(`Missing required permissions: ${missingScopes.join(", ")}`),
    );
  }

  oauth2.setCredentials(tokens);
  let googleEmail: string | null = null;
  try {
    googleEmail = await fetchGoogleUserEmail(oauth2);
  } catch (err) {
    console.warn("[oauth/google/callback] could not fetch user email", err);
  }

  // Preserve a previously chosen calendar when the same Google account
  // reconnects. A different account's calendar ids are meaningless here, and
  // if either email is unknown we can't prove it's the same account — reset
  // to "primary" in both cases.
  const { data: existing } = await service
    .from("calendar_integrations")
    .select("google_email, google_calendar_id")
    .eq("location_id", location.id)
    .maybeSingle();
  const calendarId =
    existing?.google_email && googleEmail && existing.google_email === googleEmail
      ? existing.google_calendar_id
      : "primary";

  const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;
  const { error: upsertErr } = await service
    .from("calendar_integrations")
    .upsert(
      {
        tenant_id: location.tenant_id,
        location_id: location.id,
        google_email: googleEmail,
        google_calendar_id: calendarId,
        access_token: tokens.access_token ?? "",
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "location_id" },
    );

  if (upsertErr) {
    console.error("[oauth/google/callback] upsert failed", upsertErr);
    return redirectToTenant(subdomain, errorParams("Could not save authorization"));
  }

  return redirectToTenant(subdomain, { google: "connected" });
}

function redirectToTenant(
  subdomain: string | null,
  qs: Record<string, string>,
): NextResponse {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const u = new URL(base);
  if (subdomain) u.hostname = `${subdomain}.${u.hostname}`;
  u.pathname = "/admin/connect-google";
  u.search = "";
  for (const [k, v] of Object.entries(qs)) u.searchParams.set(k, v);
  return NextResponse.redirect(u);
}

function errorParams(message: string): Record<string, string> {
  return { google: "error", message };
}
