// Hand-written for v1. Regenerate later via:
//   supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts

export interface TenantStylesConfig {
  primary?: string;
  secondary?: string;
  /** CSS length applied to button corners, e.g. "9999px" (pill) or "0.5rem". */
  radius?: string;
  /** Google Font family for headings/hero, e.g. "Playfair Display". Defaults to Cormorant Garamond. */
  fontDisplay?: string;
  /** Google Font family for body text, e.g. "Inter". Defaults to Geist. */
  fontBody?: string;
}

export interface TenantLangConfig {
  /** Enabled UI languages, e.g. ["hr", "en"]. */
  languages?: string[];
  /** Initial language; must be one of `languages`. Defaults to "hr". */
  defaultLanguage?: string;
}

export interface TenantSmsConfig {
  /** Send the day-before SMS reminder (Brevo). Missing = false (off). */
  enabled?: boolean;
  /** SMS sender override; sanitized to <=11 alphanumeric chars before use. Missing = derived from tenant name. */
  senderName?: string;
}

export interface TenantConfig {
  styles?: TenantStylesConfig;
  lang?: TenantLangConfig;
  sms?: TenantSmsConfig;
  /** Show service prices on the public booking site. Missing = true (visible). */
  showPrices?: boolean;
  /** Short tagline shown on the intro/hero screen. */
  tagline?: string;
  /** Optional note shown atop the services step, keyed by language code (e.g. { hr, en }). */
  servicesNote?: Record<string, string>;
}

export type WorkingHoursValue = { open: string; close: string } | null;
export type WorkingHours = Record<string, WorkingHoursValue>;

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  logo_path: string | null;
  hero_path: string | null;
  config: TenantConfig;
  created_at: string;
}

export interface TenantPublic {
  id: string;
  name: string;
  subdomain: string;
  logo_path: string | null;
  hero_path: string | null;
  config: TenantConfig;
}

export interface Location {
  id: string;
  tenant_id: string;
  name: string;
  contact_email: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  /** Free-form social links, e.g. { instagram: "https://…", facebook: "https://…" }. */
  socials: Record<string, string>;
  timezone: string;
  working_hours: WorkingHours;
  /** One-off non-working dates as "YYYY-MM-DD" (location timezone), on top of working_hours. */
  closed_dates: string[];
  image_path: string | null;
  created_at: string;
}

export interface CalendarIntegration {
  id: string;
  tenant_id: string;
  location_id: string;
  google_email: string | null;
  google_calendar_id: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceCategory {
  id: string;
  tenant_id: string;
  location_id: string;
  name: string;
  description: string | null;
  display_order: number;
  created_at: string;
}

export interface Service {
  id: string;
  tenant_id: string;
  location_id: string;
  category_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  display_order: number;
  created_at: string;
}

export type ReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED";
// "NOT_APPLICABLE" marks a reservation at a location with no external calendar
// connector — the DB row is the source of truth, nothing to sync.
export type GoogleSyncStatus =
  | "PENDING"
  | "SYNCED"
  | "FAILED"
  | "NOT_APPLICABLE";

export interface Reservation {
  id: string;
  tenant_id: string;
  location_id: string;
  client_id: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  status: ReservationStatus;
  google_event_id: string | null;
  google_sync_status: GoogleSyncStatus;
  cancellation_token: string;
  sms_reminder_sent: boolean;
  email_reminder_sent: boolean;
  cancelled_at: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  tenant_id: string;
  role: string;
  created_at: string;
}
