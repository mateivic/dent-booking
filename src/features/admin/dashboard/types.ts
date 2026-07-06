import type {
  GoogleSyncStatus,
  ReservationStatus,
} from "@/lib/supabase/types";

export type PeriodKey =
  | "this-week"
  | "last-week"
  | "this-month"
  | "last-month"
  | "this-year"
  | "last-year";

export type Granularity = "day" | "month";

// One resolved period filter: absolute UTC bounds (half-open [start, end)) plus
// the chart buckets covering it, all computed in the display timezone.
export interface PeriodRange {
  key: PeriodKey;
  startUtcIso: string;
  endUtcIso: string;
  granularity: Granularity;
  /** Bucket identity: "YYYY-MM-DD" (day) or "YYYY-MM" (month). */
  bucketKeys: string[];
  /** Human labels aligned with bucketKeys ("Mon 29", "15", "Jan"). */
  bucketLabels: string[];
}

// Normalized reservation row for KPI aggregation. Prices are already resolved
// (booking-time snapshot, falling back to the live service price for legacy rows).
export interface KpiReservationRow {
  id: string;
  startTime: string;
  status: ReservationStatus;
  clientId: string;
  clientName: string;
  services: { name: string; price: number }[];
}

export interface DashboardKpis {
  reservationCount: number;
  cancelledCount: number;
  revenue: number;
  topServices: { name: string; count: number; revenue: number }[];
  topClient: { name: string; count: number } | null;
  series: { labels: string[]; counts: number[]; revenues: number[] };
}

// Normalized reservation row for the calendar (UTC instants, resolved prices);
// converted into CalendarEventVM with a display timezone at page assembly.
export interface CalendarReservationRow {
  id: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  status: ReservationStatus;
  googleSyncStatus: GoogleSyncStatus;
  reviewEmailSentAt: string | null;
  locationId: string;
  locationName: string;
  locationReviewLink: string | null;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  services: { name: string; price: number }[];
}

// Calendar event view model — plain serializable data, safe as a client prop.
// `start`/`end` are "floating" local ISO strings (no offset) already converted
// to the display timezone, so the calendar does zero timezone math.
export interface CalendarEventVM {
  id: string;
  start: string;
  end: string;
  dateLabel: string;
  timeLabel: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  services: { name: string; price: number }[];
  status: ReservationStatus;
  googleSyncStatus: GoogleSyncStatus;
  /** When the one-time review-request email was sent; null = not sent. */
  reviewEmailSentAt: string | null;
  /** end_time has passed (computed server-side at render). */
  isFinished: boolean;
  /** The location has a review_link configured. */
  hasReviewLink: boolean;
  locationId: string;
  locationName: string;
  notes: string | null;
}
