import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getAvailabilityConnector } from "@/features/availability/connectors/factory";
import type { AvailabilityConnector } from "@/features/availability/connectors/types";
import { sendEmail } from "@/lib/email/send-email";
import { sendSms } from "@/lib/sms/send-sms";
import { toE164, deriveSmsSender } from "@/lib/sms/phone";
import { buildSubdomainUrl } from "@/lib/url";
import { getTenantHeroUrl, getTenantLogoUrl } from "@/lib/supabase/storage";
import {
  addDaysIso,
  todayIsoInZone,
  zonedToUtc,
} from "@/features/booking/lib/timezone";
import {
  buildReminderSms,
  renderClientReminder,
} from "@/features/booking/lib/reminder-templates";
import type { TenantConfig } from "@/lib/supabase/types";

export interface ReminderRunSummary {
  emailsSent: number;
  smsSent: number;
  skipped: number;
  failed: number;
}

interface TenantRow {
  id: string;
  name: string;
  subdomain: string;
  logo_path: string | null;
  hero_path: string | null;
  config: TenantConfig | null;
}

interface LocationRow {
  id: string;
  name: string;
  timezone: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  socials: Record<string, string> | null;
}

interface ReservationRow {
  id: string;
  start_time: string;
  status: string;
  google_event_id: string | null;
  email_reminder_sent: boolean;
  sms_reminder_sent: boolean;
  cancellation_token: string;
  clients: {
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  } | null;
  reservation_services: { services: { name: string } | null }[] | null;
}

// Sends day-before reminders for every tenant: an email to each client (always
// on) and, when the tenant has it enabled, an SMS to clients with a valid phone.
// Idempotent — only flips the *_reminder_sent flags after a successful send, and
// the query skips rows already flagged, so re-runs never double-send.
export async function sendDueReminders(): Promise<ReminderRunSummary> {
  const supabase = getSupabaseServiceRoleClient();
  const summary: ReminderRunSummary = {
    emailsSent: 0,
    smsSent: 0,
    skipped: 0,
    failed: 0,
  };

  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, subdomain, logo_path, hero_path, config");
  if (error || !data) {
    console.error("[reminders] failed to load tenants", error);
    return summary;
  }
  const tenants = data as unknown as TenantRow[];

  for (const tenant of tenants) {
    const config = (tenant.config ?? {}) as TenantConfig;
    const smsEnabled = config.sms?.enabled === true;

    const { data: locData, error: locErr } = await supabase
      .from("locations")
      .select("id, name, timezone, address, phone, website, socials")
      .eq("tenant_id", tenant.id);
    if (locErr || !locData) {
      console.error("[reminders] failed to load locations", tenant.id, locErr);
      continue;
    }

    for (const location of locData as unknown as LocationRow[]) {
      await processLocation(supabase, summary, {
        tenant,
        config,
        smsEnabled,
        location,
      });
    }
  }

  return summary;
}

interface LocationCtx {
  tenant: TenantRow;
  config: TenantConfig;
  smsEnabled: boolean;
  location: LocationRow;
}

async function processLocation(
  supabase: SupabaseClient,
  summary: ReminderRunSummary,
  ctx: LocationCtx,
): Promise<void> {
  const { location } = ctx;
  const tz = location.timezone;

  // Appointments whose start falls on tomorrow's local calendar day.
  const tomorrow = addDaysIso(todayIsoInZone(tz), 1);
  const startUtc = zonedToUtc(tomorrow, "00:00", tz).toISOString();
  const endUtc = zonedToUtc(addDaysIso(tomorrow, 1), "00:00", tz).toISOString();

  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, start_time, status, google_event_id, email_reminder_sent, sms_reminder_sent, cancellation_token, clients!inner(first_name, last_name, email, phone), reservation_services(services(name))",
    )
    .eq("location_id", location.id)
    .neq("status", "CANCELLED")
    .gte("start_time", startUtc)
    .lt("start_time", endUtc);

  if (error) {
    console.error(
      "[reminders] failed to load reservations",
      location.id,
      error,
    );
    return;
  }
  const reservations = (data ?? []) as unknown as ReservationRow[];
  if (reservations.length === 0) return;

  // One connector per location (Google when connected, else the DB connector).
  const connector = await getAvailabilityConnector(supabase, location.id);

  for (const reservation of reservations) {
    try {
      await processReservation(supabase, summary, {
        ...ctx,
        connector,
        reservation,
      });
    } catch (err) {
      console.error("[reminders] reservation failed", reservation.id, err);
      summary.failed++;
    }
  }
}

interface ReservationCtx extends LocationCtx {
  connector: AvailabilityConnector;
  reservation: ReservationRow;
}

async function processReservation(
  supabase: SupabaseClient,
  summary: ReminderRunSummary,
  ctx: ReservationCtx,
): Promise<void> {
  const { tenant, config, smsEnabled, location, connector, reservation } = ctx;

  // Connector is the source of truth for connected locations: if the event was
  // removed (e.g. cancelled in Google Calendar), skip. Only a definitive
  // "deleted" suppresses the reminder — a transient API error sends anyway.
  if (reservation.google_event_id) {
    let status: "active" | "deleted" = "active";
    try {
      status = await connector.getEventStatus(reservation.google_event_id);
    } catch (err) {
      console.error(
        "[reminders] could not verify event; sending anyway",
        reservation.id,
        err,
      );
    }
    if (status === "deleted") {
      summary.skipped++;
      return;
    }
  }

  const client = reservation.clients;
  if (!client) {
    summary.skipped++;
    return;
  }
  const clientName = `${client.first_name} ${client.last_name}`;
  const serviceNames = (reservation.reservation_services ?? [])
    .map((rs) => rs.services?.name)
    .filter((n): n is string => Boolean(n));

  // Email reminder — always on, when the client has an email and it hasn't sent.
  if (!reservation.email_reminder_sent && client.email) {
    const html = renderClientReminder({
      tenantName: tenant.name,
      heroUrl: getTenantHeroUrl(tenant.hero_path),
      logoUrl: getTenantLogoUrl(tenant.logo_path),
      primaryColor: config.styles?.primary ?? null,
      clientName,
      locationName: location.name,
      locationAddress: location.address,
      locationPhone: location.phone,
      website: location.website,
      socials: location.socials ?? {},
      serviceNames,
      startIso: reservation.start_time,
      timezone: location.timezone,
      cancelUrl: buildSubdomainUrl(
        tenant.subdomain,
        `/cancel/${reservation.cancellation_token}`,
      ),
    });
    const res = await sendEmail({
      to: { email: client.email, name: clientName },
      subject: `Podsjetnik na termin – ${tenant.name}`,
      html,
      senderName: tenant.name,
    });
    if (res.ok) {
      await supabase
        .from("reservations")
        .update({ email_reminder_sent: true })
        .eq("id", reservation.id);
      summary.emailsSent++;
    } else {
      summary.failed++;
    }
  }

  // SMS reminder — only when the tenant enabled it, the phone is valid, and it
  // hasn't sent yet.
  if (smsEnabled && !reservation.sms_reminder_sent) {
    const recipient = toE164(client.phone);
    if (recipient) {
      // Optional per-tenant sender override; both paths are sanitized to the
      // <=11-char alphanumeric sender id carriers require.
      const res = await sendSms({
        sender: deriveSmsSender(config.sms?.senderName?.trim() || tenant.name),
        recipient,
        content: buildReminderSms({
          tenantName: tenant.name,
          locationAddress: location.address || location.name,
          startIso: reservation.start_time,
          timezone: location.timezone,
        }),
      });
      if (res.ok) {
        await supabase
          .from("reservations")
          .update({ sms_reminder_sent: true })
          .eq("id", reservation.id);
        summary.smsSent++;
      } else {
        summary.failed++;
      }
    }
  }
}
