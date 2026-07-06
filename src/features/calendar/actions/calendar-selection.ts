"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getAuthedAdmin } from "@/features/admin/lib/auth";
import {
  getCalendarClientForLocation,
  listWritableCalendars,
} from "@/features/calendar/lib/google";

export interface UpdateLocationCalendarResult {
  ok: boolean;
  error?: string;
}

// Points a location's Google integration at a specific calendar of the
// connected account. Reservations don't snapshot the calendar id, so events
// created before a switch stay on the old calendar (cancelling them deletes
// against the new calendar and the 404 is swallowed) — fixing that would need
// a google_calendar_id column on reservations.
export async function updateLocationCalendar(
  locationId: string,
  calendarId: string,
): Promise<UpdateLocationCalendarResult> {
  const admin = await getAuthedAdmin();
  if (!admin) return { ok: false, error: "Unauthorized" };
  if (!locationId || !calendarId) {
    return { ok: false, error: "Missing location or calendar" };
  }

  const supabase = getSupabaseServiceRoleClient();
  const { client, integration } = await getCalendarClientForLocation(
    supabase,
    locationId,
  );
  if (!integration) {
    return { ok: false, error: "Google is not connected for this location" };
  }
  if (integration.tenant_id !== admin.tenantId) {
    return { ok: false, error: "Unauthorized" };
  }

  // "primary" is Google's built-in alias and always valid; any other id must
  // actually be a writable calendar on the connected account.
  if (calendarId !== "primary") {
    let ownsCalendar: boolean;
    try {
      const calendars = await listWritableCalendars(client);
      ownsCalendar = calendars.some((c) => c.id === calendarId);
    } catch {
      return {
        ok: false,
        error: "Could not verify calendar with Google. Try reconnecting.",
      };
    }
    if (!ownsCalendar) {
      return { ok: false, error: "Calendar not found on the connected account" };
    }
  }

  const { error: writeErr } = await supabase
    .from("calendar_integrations")
    .update({
      google_calendar_id: calendarId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integration.id);
  if (writeErr) return { ok: false, error: writeErr.message };

  revalidatePath("/admin/connect-google");
  return { ok: true };
}
