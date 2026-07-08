import "server-only";
import type {
  BusyWindow,
  CalendarEventInput,
  CalendarEventSnapshot,
} from "@/features/calendar/lib/google";
import type { GoogleSyncStatus } from "@/lib/supabase/types";

// Re-export so connector implementations import BusyWindow from "./types" rather
// than reaching into the calendar feature.
export type { BusyWindow, CalendarEventSnapshot };

export type ConnectorKind = "google" | "database";

// Outcome of materializing a booking on the connector's external system.
export interface ConnectorEventResult {
  // External event id (Google), or null when there is no external system / it
  // failed to create.
  externalEventId: string | null;
  // Value to persist into reservations.google_sync_status.
  //   google   -> "SYNCED" on success, "FAILED" on error
  //   database -> "NOT_APPLICABLE"
  syncStatus: GoogleSyncStatus;
  // Whether the reservation should be CONFIRMED (false -> PENDING).
  confirmed: boolean;
}

// A location-scoped availability source. Google Calendar is one implementation;
// the database (reservations table) is the default fallback when a location has
// no connector attached.
export interface AvailabilityConnector {
  readonly kind: ConnectorKind;

  // Busy windows overlapping [timeMinIso, timeMaxIso). `timezone` is the location
  // timezone (used by Google for all-day events; ignored by the DB connector).
  listBusyWindows(
    timeMinIso: string,
    timeMaxIso: string,
    timezone: string,
  ): Promise<BusyWindow[]>;

  // Materialize the booking on the external system. Never throws: failures are
  // folded into the result so callers handle every connector uniformly.
  createEvent(details: CalendarEventInput): Promise<ConnectorEventResult>;

  // Current status + start of a booking's external event. Used for 23P01
  // stale-conflict self-heal (is a conflicting reservation's event gone?) and by
  // the reminder job (has the event moved to a different day?). The database
  // connector always reports { status: "active", startIso: null } — the DB is
  // authoritative and has no external start.
  getEventDetails(externalEventId: string): Promise<CalendarEventSnapshot>;

  // Best-effort removal of the external event on cancellation. No-op for the
  // database connector.
  deleteEvent(externalEventId: string): Promise<void>;
}
