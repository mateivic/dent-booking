"use server";

import { revalidatePath } from "next/cache";
import { getAuthedAdmin } from "@/features/admin/lib/auth";
import { sendReviewRequestEmail } from "@/features/booking/server/booking-emails";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { TenantConfig } from "@/lib/supabase/types";

export interface SendReviewRequestState {
  ok: boolean;
  error?: string;
}

// Sends the one-time "leave a review" email for a finished reservation.
// Authorization is code-level (mirrors the other admin actions): tenant scope
// comes from the signed-in admin's profile, and the sent-at stamp is written
// only after the transport confirms the send (reminders pattern).
export async function sendReviewRequest(input: {
  reservationId: string;
}): Promise<SendReviewRequestState> {
  const admin = await getAuthedAdmin();
  if (!admin) return { ok: false, error: "Unauthorized" };
  if (!input.reservationId) return { ok: false, error: "Missing reservation" };

  const supabase = getSupabaseServiceRoleClient();

  const [{ data: tenant }, { data: reservation }] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, name, logo_path, hero_path, config")
      .eq("id", admin.tenantId)
      .maybeSingle(),
    supabase
      .from("reservations")
      .select(
        "id, status, start_time, end_time, review_email_sent_at, clients!inner(first_name, last_name, email), locations!inner(name, timezone, address, phone, website, socials, review_link)",
      )
      .eq("id", input.reservationId)
      .eq("tenant_id", admin.tenantId)
      .maybeSingle(),
  ]);

  if (!tenant) return { ok: false, error: "Tenant not found" };
  if (!reservation) return { ok: false, error: "Reservation not found" };

  const client = reservation.clients as unknown as {
    first_name: string;
    last_name: string;
    email: string | null;
  };
  const location = reservation.locations as unknown as {
    name: string;
    timezone: string;
    address: string | null;
    phone: string | null;
    website: string | null;
    socials: Record<string, string> | null;
    review_link: string | null;
  };

  if (reservation.status === "CANCELLED") {
    return { ok: false, error: "Reservation is cancelled" };
  }
  if (new Date(reservation.end_time).getTime() > Date.now()) {
    return { ok: false, error: "Reservation is not finished yet" };
  }
  if (reservation.review_email_sent_at) {
    return { ok: false, error: "Review email was already sent" };
  }
  if (!client.email) {
    return { ok: false, error: "Client has no email address" };
  }
  if (!location.review_link) {
    return { ok: false, error: "This location has no review link set" };
  }

  const result = await sendReviewRequestEmail({
    tenantName: tenant.name,
    tenantLogoPath: tenant.logo_path,
    tenantHeroPath: tenant.hero_path,
    primaryColor: (tenant.config as TenantConfig | null)?.styles?.primary ?? null,
    clientName: `${client.first_name} ${client.last_name}`,
    clientEmail: client.email,
    locationName: location.name,
    locationAddress: location.address,
    locationPhone: location.phone,
    website: location.website,
    socials: location.socials ?? {},
    startIso: reservation.start_time,
    timezone: location.timezone,
    reviewUrl: location.review_link,
  });

  if (!result.ok) {
    return { ok: false, error: `Email failed to send: ${result.error}` };
  }

  const { error: updateErr } = await supabase
    .from("reservations")
    .update({ review_email_sent_at: new Date().toISOString() })
    .eq("id", reservation.id);
  if (updateErr) {
    // The email went out; log the stamp failure but don't fail the action.
    console.error("[sendReviewRequest] failed to stamp sent-at", updateErr);
  }

  revalidatePath("/admin/dashboard");
  return { ok: true };
}
