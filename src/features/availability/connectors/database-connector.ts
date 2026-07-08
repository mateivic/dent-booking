import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AvailabilityConnector, ConnectorEventResult } from "./types";

// The default connector for locations with no external calendar. Busy windows
// come straight from the reservations table; bookings are confirmed immediately
// with no external event.
export function createDatabaseConnector(
  supabase: SupabaseClient,
  locationId: string,
): AvailabilityConnector {
  return {
    kind: "database",

    async listBusyWindows(timeMinIso, timeMaxIso) {
      // Same overlap predicate as the reservations_no_overlap exclusion
      // constraint (and cancelStaleConflicts): every non-cancelled reservation
      // overlapping [timeMin, timeMax) is busy. start_time/end_time are
      // TIMESTAMPTZ (UTC), so no timezone conversion is needed.
      const { data, error } = await supabase
        .from("reservations")
        .select("start_time, end_time")
        .eq("location_id", locationId)
        .neq("status", "CANCELLED")
        .lt("start_time", timeMaxIso)
        .gt("end_time", timeMinIso);

      if (error) {
        throw new Error(`DB busy-window lookup failed: ${error.message}`);
      }
      return (data ?? []).map((r) => ({
        start: r.start_time as string,
        end: r.end_time as string,
      }));
    },

    // No external system: the reservation row itself confirms the booking.
    async createEvent(): Promise<ConnectorEventResult> {
      return { externalEventId: null, syncStatus: "NOT_APPLICABLE", confirmed: true };
    },

    // DB is authoritative; a conflicting row is always a real conflict, and
    // there is no external event to read a start time from.
    async getEventDetails() {
      return { status: "active" as const, startIso: null };
    },

    // Nothing to delete externally.
    async deleteEvent() {
      // no-op
    },
  };
}
