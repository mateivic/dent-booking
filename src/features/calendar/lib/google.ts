import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarIntegration } from "@/lib/supabase/types";
import { zonedToUtc } from "@/features/booking/lib/timezone";

export const REQUIRED_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar",
];

export interface CalendarEventInput {
  summary: string;
  description?: string;
  startIso: string;
  endIso: string;
  timeZone: string;
  attendeeEmail?: string;
}

export interface BusyWindow {
  start: string;
  end: string;
}

export function buildOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "GOOGLE_OAUTH_CLIENT_ID / CLIENT_SECRET / REDIRECT_URI must be configured",
    );
  }
  return new google.auth.OAuth2({
    clientId,
    clientSecret,
    redirectUri,
  });
}

// Resolves the integration for a location and returns an OAuth2Client that
// auto-persists refreshed tokens back into calendar_integrations.
export async function getCalendarClientForLocation(
  supabase: SupabaseClient,
  locationId: string,
): Promise<
  | { client: OAuth2Client; integration: CalendarIntegration }
  | { client: null; integration: null }
> {
  const { data, error } = await supabase
    .from("calendar_integrations")
    .select("*")
    .eq("location_id", locationId)
    .maybeSingle();

  if (error || !data) return { client: null, integration: null };
  const integration = data as CalendarIntegration;

  const client = buildOAuthClient();
  client.setCredentials({
    access_token: integration.access_token,
    refresh_token: integration.refresh_token,
    expiry_date: integration.token_expires_at
      ? new Date(integration.token_expires_at).getTime()
      : undefined,
  });

  // The googleapis client refreshes the access token automatically. When it
  // does, persist the new token + expiry. Google rotates refresh tokens rarely,
  // but handle that too if it happens.
  client.on("tokens", (tokens) => {
    const updates: Record<string, string> = {
      updated_at: new Date().toISOString(),
    };
    if (tokens.access_token) updates.access_token = tokens.access_token;
    if (tokens.expiry_date) {
      updates.token_expires_at = new Date(tokens.expiry_date).toISOString();
    }
    if (tokens.refresh_token) updates.refresh_token = tokens.refresh_token;

    void supabase
      .from("calendar_integrations")
      .update(updates)
      .eq("id", integration.id)
      .then(({ error: updErr }) => {
        if (updErr) {
          console.error(
            `[calendar] failed to persist refreshed tokens for integration ${integration.id}:`,
            updErr,
          );
        }
      });
  });

  return { client, integration };
}

// Lists every (non-cancelled) event on the calendar overlapping
// [timeMinIso, timeMaxIso) as busy windows. Unlike freebusy.query, this counts
// events regardless of their free/busy ("transparency") setting, and treats
// all-day events as covering the whole local day. `timezone` is the location
// timezone, used to place all-day events on the absolute timeline.
export async function listBusyWindows(
  client: OAuth2Client,
  calendarId: string,
  timeMinIso: string,
  timeMaxIso: string,
  timezone: string,
): Promise<BusyWindow[]> {
  const calendar = google.calendar({ version: "v3", auth: client });
  const resp = await calendar.events.list({
    calendarId,
    timeMin: timeMinIso,
    timeMax: timeMaxIso,
    singleEvents: true, // expand recurring events into individual instances
    orderBy: "startTime",
    maxResults: 2500,
  });

  const windows: BusyWindow[] = [];
  for (const event of resp.data.items ?? []) {
    if (event.status === "cancelled") continue;
    const start = eventEdgeToIso(event.start, timezone);
    const end = eventEdgeToIso(event.end, timezone);
    if (start && end) windows.push({ start, end });
  }
  return windows;
}

// A Google event start/end edge as an absolute ISO instant. Timed events carry
// `dateTime`; all-day events carry a `date` (YYYY-MM-DD) placed at local
// midnight in the location timezone (Google's all-day `end.date` is exclusive,
// so an all-day event spans the whole local day).
function eventEdgeToIso(
  edge: { dateTime?: string | null; date?: string | null } | undefined,
  timezone: string,
): string | null {
  if (edge?.dateTime) return edge.dateTime;
  // if (edge?.date) return zonedToUtc(edge.date, "00:00", timezone).toISOString();
  return null;
}

export async function createCalendarEvent(
  client: OAuth2Client,
  calendarId: string,
  event: CalendarEventInput,
): Promise<string> {
  const calendar = google.calendar({ version: "v3", auth: client });
  const resp = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: event.summary,
      description: event.description,
      start: { dateTime: event.startIso, timeZone: event.timeZone },
      end: { dateTime: event.endIso, timeZone: event.timeZone },
    },
  });
  if (!resp.data.id) throw new Error("Calendar API did not return an event id");
  return resp.data.id;
}

export async function deleteCalendarEvent(
  client: OAuth2Client,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const calendar = google.calendar({ version: "v3", auth: client });
  try {
    await calendar.events.delete({ calendarId, eventId });
  } catch (err: unknown) {
    // 404/410 — event already gone, treat as success.
    const status =
      (err as { code?: number; status?: number }).code ??
      (err as { code?: number; status?: number }).status;
    if (status === 404 || status === 410) return;
    throw err;
  }
}

export interface CalendarEventSnapshot {
  status: "active" | "deleted";
  // Raw Google start: a full ISO instant for timed events (`start.dateTime`) or
  // a date-only "YYYY-MM-DD" for all-day events (`start.date`). Null when the
  // event is deleted or has no start.
  startIso: string | null;
}

// Current status + start of a calendar event, from a single events.get. Google
// is the source of truth for availability: a 404/410 or a "cancelled" status
// both mean it's gone. Used to self-heal stale reservations whose Google event
// was deleted (callers read `.status`), and by the reminder job, which also
// compares `.startIso` to detect an event moved to a different day.
export async function getCalendarEvent(
  client: OAuth2Client,
  calendarId: string,
  eventId: string,
): Promise<CalendarEventSnapshot> {
  const calendar = google.calendar({ version: "v3", auth: client });
  try {
    const resp = await calendar.events.get({ calendarId, eventId });
    if (resp.data.status === "cancelled") {
      return { status: "deleted", startIso: null };
    }
    return {
      status: "active",
      startIso: resp.data.start?.dateTime ?? resp.data.start?.date ?? null,
    };
  } catch (err: unknown) {
    const status =
      (err as { code?: number; status?: number }).code ??
      (err as { code?: number; status?: number }).status;
    if (status === 404 || status === 410) {
      return { status: "deleted", startIso: null };
    }
    throw err;
  }
}

export async function fetchGoogleUserEmail(
  client: OAuth2Client,
): Promise<string | null> {
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const resp = await oauth2.userinfo.get();
  return resp.data.email ?? null;
}

export interface CalendarListEntry {
  id: string;
  summary: string;
  primary: boolean;
}

// Calendars the account can write events to (minAccessRole "writer" includes
// owners and excludes read-only subscriptions like Holidays). Primary first,
// rest alphabetical.
export async function listWritableCalendars(
  client: OAuth2Client,
): Promise<CalendarListEntry[]> {
  const calendar = google.calendar({ version: "v3", auth: client });
  const entries: CalendarListEntry[] = [];
  let pageToken: string | undefined;
  do {
    const resp = await calendar.calendarList.list({
      minAccessRole: "writer",
      maxResults: 250,
      pageToken,
    });
    for (const item of resp.data.items ?? []) {
      if (!item.id) continue;
      entries.push({
        id: item.id,
        summary: item.summary ?? item.id,
        primary: item.primary === true,
      });
    }
    pageToken = resp.data.nextPageToken ?? undefined;
  } while (pageToken);
  return entries.sort(
    (a, b) =>
      Number(b.primary) - Number(a.primary) ||
      a.summary.localeCompare(b.summary),
  );
}
