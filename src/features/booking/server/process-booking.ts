import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { sendBookingConfirmationEmails } from "@/features/booking/server/booking-emails";
import { getAvailabilityConnector } from "@/features/availability/connectors/factory";
import type { AvailabilityConnector } from "@/features/availability/connectors/types";
import {
  isClosedDate,
  isWithinWorkingHours,
} from "@/features/booking/lib/working-hours";
import { dateIsoInZone } from "@/features/booking/lib/timezone";
import type { WorkingHours } from "@/lib/supabase/types";

export interface ProcessBookingClient {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes?: string;
}

export interface ProcessBookingInput {
  locationId: string;
  serviceIds: string[];
  startTime: string;
  client: ProcessBookingClient;
}

export type ProcessBookingResult =
  | {
      ok: true;
      reservationId: string;
      cancellationToken: string;
      status: "CONFIRMED" | "PENDING";
    }
  | { ok: false; status: number; error: string };

export async function processBooking(
  subdomain: string,
  input: ProcessBookingInput,
): Promise<ProcessBookingResult> {
  const validation = validate(input);
  if (validation) return { ok: false, status: 400, error: validation };

  const supabase = getSupabaseServiceRoleClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, logo_path, hero_path, config")
    .eq("subdomain", subdomain)
    .maybeSingle();
  if (!tenant) return { ok: false, status: 404, error: "Tenant not found" };

  const [{ data: location }, { data: services }] = await Promise.all([
    supabase
      .from("locations")
      .select(
        "id, tenant_id, name, contact_email, address, phone, website, socials, timezone, working_hours, closed_dates",
      )
      .eq("id", input.locationId)
      .maybeSingle(),
    supabase
      .from("services")
      .select("id, tenant_id, location_id, name, duration_minutes, price")
      .in("id", input.serviceIds)
      .is("deleted_at", null),
  ]);

  if (!location || location.tenant_id !== tenant.id) {
    return { ok: false, status: 404, error: "Location not found" };
  }
  if (!services || services.length !== input.serviceIds.length) {
    return { ok: false, status: 404, error: "One or more services not found" };
  }
  if (services.some((s) => s.tenant_id !== tenant.id)) {
    return {
      ok: false,
      status: 400,
      error: "Service does not belong to tenant",
    };
  }
  if (services.some((s) => s.location_id !== location.id)) {
    return {
      ok: false,
      status: 400,
      error: "Service is not offered at this location",
    };
  }

  const totalDurationMin = services.reduce(
    (sum, s) => sum + s.duration_minutes,
    0,
  );
  const startTime = new Date(input.startTime);
  if (Number.isNaN(startTime.getTime())) {
    return { ok: false, status: 400, error: "Invalid startTime" };
  }
  if (startTime.getTime() < Date.now()) {
    return { ok: false, status: 400, error: "Cannot book in the past" };
  }
  const endTime = new Date(startTime.getTime() + totalDurationMin * 60_000);

  if (
    !isWithinWorkingHours(
      startTime,
      endTime,
      location.working_hours as WorkingHours,
      location.timezone,
    )
  ) {
    return { ok: false, status: 400, error: "Slot is outside working hours" };
  }

  if (
    isClosedDate(
      dateIsoInZone(startTime, location.timezone),
      location.closed_dates as string[],
    )
  ) {
    return { ok: false, status: 400, error: "Clinic is closed on this date" };
  }

  const connector = await getAvailabilityConnector(supabase, location.id);

  try {
    const startMs = startTime.getTime();
    const endMs = endTime.getTime();
    const busy = await connector.listBusyWindows(
      startTime.toISOString(),
      endTime.toISOString(),
      location.timezone,
    );
    const conflict = busy.some(
      (w) =>
        startMs < new Date(w.end).getTime() &&
        endMs > new Date(w.start).getTime(),
    );
    if (conflict) {
      return { ok: false, status: 409, error: "Slot is no longer available" };
    }
  } catch {
    return {
      ok: false,
      status: 502,
      error: "Could not verify slot availability",
    };
  }

  const clientId = await findOrCreateClient(supabase, tenant.id, input.client);
  if (!clientId)
    return { ok: false, status: 500, error: "Failed to create client" };

  const cancellationToken = generateCancellationToken();
  const reservationRow = {
    tenant_id: tenant.id,
    location_id: input.locationId,
    client_id: clientId,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    notes: input.client.notes ?? null,
    status: "PENDING",
    google_sync_status: "PENDING",
    cancellation_token: cancellationToken,
  };

  let { data: reservation, error: resErr } = await supabase
    .from("reservations")
    .insert(reservationRow)
    .select("id")
    .single();

  // A 23P01 (no-overlap) violation can be stale when an external calendar is the
  // source of truth: the conflicting reservation's Google event may have been
  // deleted in Google, leaving an orphan DB row. Cancel any such stale rows and
  // retry once. With the database connector there is no external authority — a
  // 23P01 is always a genuine conflict — so we skip the heal entirely and fall
  // through to the 409 below.
  if (resErr?.code === "23P01" && connector.kind === "google") {
    const healed = await cancelStaleConflicts(
      supabase,
      connector,
      input.locationId,
      startTime,
      endTime,
    );
    if (healed > 0) {
      ({ data: reservation, error: resErr } = await supabase
        .from("reservations")
        .insert(reservationRow)
        .select("id")
        .single());
    }
  }

  if (resErr || !reservation) {
    if (resErr?.code === "23P01") {
      return { ok: false, status: 409, error: "Slot is no longer available" };
    }
    console.error("[processBooking] reservation insert error", resErr);
    return { ok: false, status: 500, error: "Failed to create reservation" };
  }

  // `services` is validated above to match input.serviceIds exactly; mapping
  // from the fetched rows lets us snapshot the price at booking time.
  const { error: rsErr } = await supabase.from("reservation_services").insert(
    services.map((s) => ({
      reservation_id: reservation.id,
      service_id: s.id,
      tenant_id: tenant.id,
      price: s.price,
    })),
  );
  if (rsErr) {
    console.error("[processBooking] reservation_services insert error", rsErr);
    return { ok: false, status: 500, error: "Failed to link services" };
  }

  const summary = `${input.client.firstName} ${input.client.lastName} — ${services
    .map((s) => s.name)
    .join(", ")}`;

  const eventResult = await connector.createEvent({
    summary,
    description: buildEventDescription(
      input,
      services.map((s) => s.name),
    ),
    startIso: startTime.toISOString(),
    endIso: endTime.toISOString(),
    timeZone: location.timezone,
    attendeeEmail: input.client.email,
  });

  await supabase
    .from("reservations")
    .update({
      google_event_id: eventResult.externalEventId,
      google_sync_status: eventResult.syncStatus,
      status: eventResult.confirmed ? "CONFIRMED" : "PENDING",
    })
    .eq("id", reservation.id);

  // Best-effort confirmation + clinic notification, sent after the response so
  // the booking isn't blocked on Brevo. Failures only log (see booking-emails).
  after(() =>
    sendBookingConfirmationEmails({
      subdomain,
      tenantName: tenant.name,
      tenantLogoPath: tenant.logo_path,
      tenantHeroPath: tenant.hero_path,
      primaryColor: tenant.config?.styles?.primary ?? null,
      clientName: `${input.client.firstName} ${input.client.lastName}`,
      clientEmail: input.client.email,
      clientPhone: input.client.phone,
      locationName: location.name,
      locationContactEmail: location.contact_email,
      locationAddress: location.address,
      locationPhone: location.phone,
      website: location.website,
      socials: location.socials ?? {},
      serviceNames: services.map((s) => s.name),
      startIso: startTime.toISOString(),
      endIso: endTime.toISOString(),
      timezone: location.timezone,
      cancellationToken,
      notes: input.client.notes,
    }),
  );

  return {
    ok: true,
    reservationId: reservation.id,
    cancellationToken,
    status: eventResult.confirmed ? "CONFIRMED" : "PENDING",
  };
}

function validate(input: ProcessBookingInput): string | null {
  if (!input.locationId) return "locationId required";
  if (!input.serviceIds?.length) return "serviceIds required";
  if (!input.startTime) return "startTime required";
  if (!input.client?.firstName || !input.client?.lastName)
    return "client name required";
  if (!input.client?.email || !input.client.email.includes("@"))
    return "valid client email required";
  if (!input.client?.phone) return "client phone required";
  return null;
}

async function findOrCreateClient(
  supabase: SupabaseClient,
  tenantId: string,
  client: ProcessBookingClient,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("email", client.email)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("clients")
    .insert({
      tenant_id: tenantId,
      first_name: client.firstName,
      last_name: client.lastName,
      email: client.email,
      phone: client.phone,
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("[processBooking] client insert error", error);
    return null;
  }
  return created.id;
}

function generateCancellationToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Cancels reservations overlapping [startTime, endTime) at this location whose
// Google event has been deleted (Google is authoritative for availability),
// returning how many were cancelled. Rows that never synced to Google (no event
// id) or whose event still exists are left untouched — so genuine double-bookings
// are still blocked by the no-overlap constraint.
async function cancelStaleConflicts(
  supabase: SupabaseClient,
  connector: AvailabilityConnector,
  locationId: string,
  startTime: Date,
  endTime: Date,
): Promise<number> {
  const { data: conflicts } = await supabase
    .from("reservations")
    .select("id, google_event_id")
    .eq("location_id", locationId)
    .neq("status", "CANCELLED")
    .lt("start_time", endTime.toISOString())
    .gt("end_time", startTime.toISOString());

  if (!conflicts?.length) return 0;

  let cancelled = 0;
  for (const conflict of conflicts) {
    if (!conflict.google_event_id) continue;

    let deleted: boolean;
    try {
      deleted =
        (await connector.getEventStatus(conflict.google_event_id)) ===
        "deleted";
    } catch (err) {
      console.error(
        "[processBooking] could not verify calendar event; keeping reservation",
        conflict.id,
        err,
      );
      continue;
    }
    if (!deleted) continue;

    const { error } = await supabase
      .from("reservations")
      .update({ status: "CANCELLED", cancelled_at: new Date().toISOString() })
      .eq("id", conflict.id);
    if (error) {
      console.error(
        "[processBooking] failed to cancel stale reservation",
        conflict.id,
        error,
      );
      continue;
    }
    cancelled++;
  }
  return cancelled;
}

function buildEventDescription(
  input: ProcessBookingInput,
  serviceNames: string[],
): string {
  const lines = [
    `Klijent: ${input.client.firstName} ${input.client.lastName}`,
    `Email: ${input.client.email}`,
    `Telefon: ${input.client.phone}`,
    `Usluge: ${serviceNames.join(", ")}`,
  ];
  if (input.client.notes) lines.push("", `Napomena: ${input.client.notes}`);
  return lines.join("\n");
}
