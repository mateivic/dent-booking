"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildSubdomainUrl } from "@/lib/url";
import type { ActionResult } from "./types";

// All actions return an `ActionResult` instead of calling `redirect()`.
// A same-origin `redirect()` from a Server Action is followed as a soft (SPA)
// navigation, which does NOT re-run the subdomain proxy rewrite — so the
// destination renders with `[subdomain]` resolved to the literal first path
// segment ("admin") and the tenant-404 page appears. The client hook performs
// a hard `window.location` navigation to `redirectTo` instead, which goes
// through the proxy and resolves the tenant correctly.
//
// `revalidatePath("/", "layout")` on auth-state changes mirrors Supabase's
// official Next.js SSR pattern (purge cached Server Component output).

export async function signIn(
  subdomain: string,
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { redirectTo: buildSubdomainUrl(subdomain, "/admin/dashboard") };
}

export async function requestPasswordReset(
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Enter your email first" };
  }

  const supabase = await getSupabaseServerClient();
  const appBase = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appBase}/auth/callback?type=recovery`,
  });
  if (error) {
    return { error: error.message };
  }
  return { ok: true };
}

export async function setPassword(
  subdomain: string,
  _prevState: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match" };
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { redirectTo: buildSubdomainUrl(subdomain, "/admin/dashboard") };
}

// Sign-out has no form inputs, so it isn't wired through `useActionState`;
// the button calls it inside a transition and navigates to `redirectTo`.
export async function signOut(subdomain: string): Promise<ActionResult> {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  return { redirectTo: buildSubdomainUrl(subdomain, "/admin/login") };
}
