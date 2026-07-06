import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getAvailabilityConnector } from "@/features/availability/connectors/factory";
import { sendBookingCancellationEmail } from "@/features/booking/server/booking-emails";
import type { TenantConfig } from "@/lib/supabase/types";

export type CancelBookingResult =
  | { ok: true; alreadyCancelled: boolean }
  | { ok: false; status: number; error: string };

// Everything performCancellation needs about the reservation, in one embed.
const RESERVATION_EMBED =
  "id, tenant_id, location_id, status, google_event_id, start_time, clients!inner(first_name, last_name, email), locations!inner(name, timezone, address, phone, website, socials), reservation_services(services(name))";

interface CancellationTenant {
  id: string;
  name: string;
  logo_path: string | null;
  hero_path: string | null;
  config: TenantConfig | null;
}

interface CancellableReservation {
  id: string;
  tenant_id: string;
  location_id: string;
  status: string;
  google_event_id: string | null;
  start_time: string;
  clients: unknown;
  locations: unknown;
  reservation_services: unknown;
}

// Public cancellation via the emailed link. Always notifies the client.
export async function cancelBookingByToken(
  subdomain: string,
  token: string,
): Promise<CancelBookingResult> {
  if (!token) return { ok: false, status: 400, error: "token required" };

  const supabase = getSupabaseServiceRoleClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, logo_path, hero_path, config")
    .eq("subdomain", subdomain)
    .maybeSingle();
  if (!tenant) return { ok: false, status: 404, error: "Tenant not found" };

  const { data: reservation, error } = await supabase
    .from("reservations")
    .select(RESERVATION_EMBED)
    .eq("cancellation_token", token)
    .maybeSingle();

  if (error || !reservation || reservation.tenant_id !== tenant.id) {
    return { ok: false, status: 404, error: "Reservation not found" };
  }

  return performCancellation({
    supabase,
    tenant: tenant as CancellationTenant,
    subdomain,
    reservation: reservation as unknown as CancellableReservation,
    notifyClient: true,
  });
}

// Admin-initiated cancellation from the dashboard. The caller chooses whether
// the client gets the cancellation email. Scoped by tenant: a reservation id
// from another tenant matches 0 rows.
export async function cancelReservationAsTenantAdmin(input: {
  tenantId: string;
  reservationId: string;
  notifyClient: boolean;
}): Promise<CancelBookingResult> {
  if (!input.reservationId) {
    return { ok: false, status: 400, error: "reservationId required" };
  }

  const supabase = getSupabaseServiceRoleClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, subdomain, logo_path, hero_path, config")
    .eq("id", input.tenantId)
    .maybeSingle();
  if (!tenant) return { ok: false, status: 404, error: "Tenant not found" };

  const { data: reservation, error } = await supabase
    .from("reservations")
    .select(RESERVATION_EMBED)
    .eq("id", input.reservationId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();

  if (error || !reservation) {
    return { ok: false, status: 404, error: "Reservation not found" };
  }

  return performCancellation({
    supabase,
    tenant: tenant as CancellationTenant,
    subdomain: tenant.subdomain as string,
    reservation: reservation as unknown as CancellableReservation,
    notifyClient: input.notifyClient,
  });
}

// The single definition of what cancelling means: flip the status, delete the
// external calendar event (best-effort), optionally email the client.
async function performCancellation(args: {
  supabase: SupabaseClient;
  tenant: CancellationTenant;
  subdomain: string;
  reservation: CancellableReservation;
  notifyClient: boolean;
}): Promise<CancelBookingResult> {
  const { supabase, tenant, subdomain, reservation, notifyClient } = args;

  if (reservation.status === "CANCELLED") {
    return { ok: true, alreadyCancelled: true };
  }

  const { error: updateErr } = await supabase
    .from("reservations")
    .update({ status: "CANCELLED", cancelled_at: new Date().toISOString() })
    .eq("id", reservation.id);

  if (updateErr) {
    console.error("[cancelBooking] update failed", updateErr);
    return { ok: false, status: 500, error: "Failed to cancel reservation" };
  }

  if (reservation.google_event_id) {
    try {
      const connector = await getAvailabilityConnector(
        supabase,
        reservation.location_id,
      );
      await connector.deleteEvent(reservation.google_event_id);
    } catch (err) {
      console.error("[cancelBooking] calendar delete failed (non-fatal)", err);
    }
  }

  // Best-effort cancellation notice to the client, after the response.
  const client = reservation.clients as {
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
  const location = reservation.locations as {
    name: string;
    timezone: string;
    address: string | null;
    phone: string | null;
    website: string | null;
    socials: Record<string, string> | null;
  } | null;
  const serviceNames = (
    (reservation.reservation_services as
      | { services: { name: string } | null }[]
      | null) ?? []
  )
    .map((rs) => rs.services?.name)
    .filter((n): n is string => Boolean(n));
  if (notifyClient && client?.email && location) {
    const clientEmail = client.email;
    after(() =>
      sendBookingCancellationEmail({
        subdomain,
        tenantName: tenant.name,
        tenantLogoPath: tenant.logo_path,
        tenantHeroPath: tenant.hero_path,
        primaryColor: tenant.config?.styles?.primary ?? null,
        clientName: `${client.first_name} ${client.last_name}`,
        clientEmail,
        locationName: location.name,
        locationAddress: location.address,
        locationPhone: location.phone,
        website: location.website,
        socials: location.socials ?? {},
        serviceNames,
        startIso: reservation.start_time,
        timezone: location.timezone,
      }),
    );
  }

  return { ok: true, alreadyCancelled: false };
}
