import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabaseServerClient,
  getSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { buildSubdomainUrl } from "@/lib/url";

// Top-level Supabase auth callback. Lives OUTSIDE the [subdomain] segment so a
// single redirect URL can be configured in Supabase Auth for the whole project.
// The proxy in src/proxy.ts returns next() when no subdomain is present, so
// hitting http://lvh.me:3000/auth/callback bypasses the rewrite and lands here.
//
// Handles two link shapes:
//   ?code=...                         (PKCE — from signInWithPassword / resetPasswordForEmail)
//   ?token_hash=...&type=invite|recovery|email|magiclink   (OTP — from Dashboard invite + email templates)

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const nextOverride = url.searchParams.get("next");

  const supabase = await getSupabaseServerClient();

  let authError: string | null = null;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) authError = error.message;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "invite" | "recovery" | "email" | "magiclink",
    });
    if (error) authError = error.message;
  } else {
    authError = "Missing auth code";
  }
  if (authError) {
    return renderError("Sign-in failed", authError);
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return renderError("Sign-in failed", "No user in session.");
  }

  // Resolve tenant via service role: the new user's profile row was created
  // out-of-band by the operator (manual SQL after invite).
  const service = getSupabaseServiceRoleClient();
  const { data: profile } = await service
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  let subdomain: string | null = null;
  if (profile?.tenant_id) {
    const { data: tenant } = await service
      .from("tenants")
      .select("subdomain")
      .eq("id", profile.tenant_id)
      .maybeSingle();
    subdomain = tenant?.subdomain ?? null;
  }

  if (!subdomain) {
    // No tenant we can hand off to. Sign the half-authenticated user out so
    // they can retry cleanly once an admin links them.
    await supabase.auth.signOut();
    return renderError(
      "Account not linked yet",
      "Your account does not have a clinic linked to it. Contact your administrator and try the invite link again once they confirm.",
    );
  }

  const isPasswordSetupFlow = type === "invite" || type === "recovery";
  const targetPath = nextOverride
    ? nextOverride
    : isPasswordSetupFlow
      ? "/admin/set-password"
      : "/admin/dashboard";

  return NextResponse.redirect(buildSubdomainUrl(subdomain, targetPath));
}

// Inline error page for the bare-apex case where we have no subdomain to
// redirect to (and so no tenant-scoped /admin/login to land on).
function renderError(title: string, message: string): NextResponse {
  const body = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #fafafa; color: #1a1a1a; }
  main { max-width: 480px; margin: 12vh auto; padding: 32px; background: white; border: 1px solid #e5e5e5; border-radius: 12px; }
  h1 { margin: 0 0 12px; font-size: 20px; }
  p { margin: 0; color: #555; line-height: 1.5; }
</style></head>
<body><main>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(message)}</p>
</main></body></html>`;
  return new NextResponse(body, {
    status: 400,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
