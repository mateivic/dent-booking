import "server-only";
import type { OAuth2Client } from "google-auth-library";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvent,
  listBusyWindows,
  type CalendarEventInput,
} from "@/features/calendar/lib/google";
import type { AvailabilityConnector, ConnectorEventResult } from "./types";

// Wraps the Google Calendar helpers, bound to an OAuth client + calendar id, as
// an AvailabilityConnector. Busy windows come from the calendar and each booking
// is mirrored as a calendar event.
export function createGoogleConnector(
  client: OAuth2Client,
  calendarId: string,
): AvailabilityConnector {
  return {
    kind: "google",

    listBusyWindows(timeMinIso, timeMaxIso, timezone) {
      return listBusyWindows(client, calendarId, timeMinIso, timeMaxIso, timezone);
    },

    async createEvent(details: CalendarEventInput): Promise<ConnectorEventResult> {
      try {
        const externalEventId = await createCalendarEvent(
          client,
          calendarId,
          details,
        );
        return { externalEventId, syncStatus: "SYNCED", confirmed: true };
      } catch (err) {
        console.error("[googleConnector] calendar event insert failed", err);
        return { externalEventId: null, syncStatus: "FAILED", confirmed: false };
      }
    },

    getEventDetails(externalEventId) {
      return getCalendarEvent(client, calendarId, externalEventId);
    },

    deleteEvent(externalEventId) {
      return deleteCalendarEvent(client, calendarId, externalEventId);
    },
  };
}
