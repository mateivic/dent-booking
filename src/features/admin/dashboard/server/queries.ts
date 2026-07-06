import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  GoogleSyncStatus,
  ReservationStatus,
} from "@/lib/supabase/types";
import type { CalendarReservationRow, KpiReservationRow } from "../types";

// Reservation reads for the dashboard. Uses the cookie-bound RLS client, like
// the admin reservations page: the signed-in admin's policies already scope
// every row to their tenant, so no explicit tenant filter is needed.

interface RangeQueryInput {
  startUtcIso: string;
  endUtcIso: string;
  locationId?: string;
}

// PostgREST caps a response at 1000 rows; a year-long KPI range can exceed
// that, so both queries page until a short page arrives.
const PAGE_SIZE = 1000;

interface RawClient {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
}

interface RawReservationService {
  price: number | null;
  services: { name: string; price: number };
}

interface RawKpiRow {
  id: string;
  start_time: string;
  status: string;
  client_id: string;
  clients: RawClient;
  reservation_services: RawReservationService[];
}

interface RawCalendarRow extends RawKpiRow {
  end_time: string;
  notes: string | null;
  google_sync_status: string;
  review_email_sent_at: string | null;
  location_id: string;
  locations: { name: string; timezone: string; review_link: string | null };
}

// Reservations whose appointment START falls in [start, end) — the KPI period
// semantics. All statuses: cancelled rows are counted (then excluded) by the
// aggregation.
export async function fetchKpiReservations(
  input: RangeQueryInput,
): Promise<KpiReservationRow[]> {
  const supabase = await getSupabaseServerClient();

  const rows = await fetchAllPages<RawKpiRow>((from, to) => {
    let query = supabase
      .from("reservations")
      .select(
        `
        id,
        start_time,
        status,
        client_id,
        clients!inner(first_name, last_name),
        reservation_services!inner(price, services!inner(name, price))
      `,
      )
      .gte("start_time", input.startUtcIso)
      .lt("start_time", input.endUtcIso)
      .order("start_time", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
    if (input.locationId) query = query.eq("location_id", input.locationId);
    return query;
  });

  return rows.map((row) => ({
    id: row.id,
    startTime: row.start_time,
    status: row.status as ReservationStatus,
    clientId: row.client_id,
    clientName: `${row.clients.first_name} ${row.clients.last_name}`,
    services: resolveServices(row.reservation_services),
  }));
}

// Non-cancelled reservations OVERLAPPING [start, end) — catches appointments
// spanning the week edges so the calendar never drops a visible event.
export async function fetchCalendarReservations(
  input: RangeQueryInput,
): Promise<CalendarReservationRow[]> {
  const supabase = await getSupabaseServerClient();

  const rows = await fetchAllPages<RawCalendarRow>((from, to) => {
    let query = supabase
      .from("reservations")
      .select(
        `
        id,
        start_time,
        end_time,
        notes,
        status,
        google_sync_status,
        review_email_sent_at,
        location_id,
        client_id,
        clients!inner(first_name, last_name, email, phone),
        locations!inner(name, timezone, review_link),
        reservation_services!inner(price, services!inner(name, price))
      `,
      )
      .lt("start_time", input.endUtcIso)
      .gt("end_time", input.startUtcIso)
      .neq("status", "CANCELLED")
      .order("start_time", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
    if (input.locationId) query = query.eq("location_id", input.locationId);
    return query;
  });

  return rows.map((row) => ({
    id: row.id,
    startTime: row.start_time,
    endTime: row.end_time,
    notes: row.notes,
    status: row.status as ReservationStatus,
    googleSyncStatus: row.google_sync_status as GoogleSyncStatus,
    reviewEmailSentAt: row.review_email_sent_at,
    locationId: row.location_id,
    locationName: row.locations.name,
    locationReviewLink: row.locations.review_link,
    clientName: `${row.clients.first_name} ${row.clients.last_name}`,
    clientEmail: row.clients.email ?? null,
    clientPhone: row.clients.phone ?? null,
    services: resolveServices(row.reservation_services),
  }));
}

// Booking-time price snapshot, falling back to the live service price for rows
// written before the snapshot migration.
function resolveServices(
  reservationServices: RawReservationService[],
): { name: string; price: number }[] {
  return reservationServices.map((rs) => ({
    name: rs.services.name,
    price: rs.price ?? rs.services.price,
  }));
}

async function fetchAllPages<T>(
  buildQuery: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Failed to load reservations: ${error.message}`);
    }
    const page = (data ?? []) as T[];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return all;
}
