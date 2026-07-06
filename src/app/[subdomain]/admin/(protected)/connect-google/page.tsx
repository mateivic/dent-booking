import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getTenantBundlePrivate } from "@/lib/tenant";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  getCalendarClientForLocation,
  listWritableCalendars,
  type CalendarListEntry,
} from "@/features/calendar/lib/google";
import { CalendarPicker } from "@/features/calendar/components/calendar-picker";

interface PageProps {
  params: Promise<{ subdomain: string }>;
  searchParams: Promise<{ google?: string; message?: string }>;
}

type CalendarFetch =
  | { status: "ok"; calendars: CalendarListEntry[] }
  | { status: "error" };

export default async function ConnectGooglePage({
  params,
  searchParams,
}: PageProps) {
  const { subdomain } = await params;
  const sp = await searchParams;

  const bundle = await getTenantBundlePrivate(subdomain);
  if (!bundle) notFound();

  const integrationByLocation = new Map(
    bundle.calendarIntegrations.map((i) => [i.location_id, i] as const),
  );

  // Fetch each connected account's writable calendars for the picker. Per-
  // location try/catch so one revoked/expired token can't break the page —
  // that location just shows an error note and Reconnect keeps working.
  const service = getSupabaseServiceRoleClient();
  const calendarsByLocation = new Map<string, CalendarFetch>(
    await Promise.all(
      bundle.locations
        .filter((l) => integrationByLocation.has(l.id))
        .map(async (l): Promise<[string, CalendarFetch]> => {
          try {
            const { client } = await getCalendarClientForLocation(
              service,
              l.id,
            );
            if (!client) return [l.id, { status: "error" }];
            return [
              l.id,
              { status: "ok", calendars: await listWritableCalendars(client) },
            ];
          } catch (err) {
            console.warn(
              `[connect-google] calendar list failed for location ${l.id}`,
              err,
            );
            return [l.id, { status: "error" }];
          }
        }),
    ),
  );

  return (
    <section>
      <h2 className="mb-6 text-xl font-semibold">Google Calendar</h2>

      {sp.google === "connected" && (
        <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Google calendar connected.
        </p>
      )}
      {sp.google === "disconnected" && (
        <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Google calendar disconnected.
        </p>
      )}
      {sp.google === "error" && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {sp.message ?? "Could not complete the request."}
        </p>
      )}

      <p className="mb-4 text-sm text-ink-muted">
        Each location can be linked to its own Google account, and you choose
        which of that account&apos;s calendars receives bookings (the primary
        calendar by default). Two locations can share one account with
        different calendars.
      </p>

      {bundle.locations.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-muted">No locations yet.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {bundle.locations.map((location) => {
            const integration = integrationByLocation.get(location.id) ?? null;
            const calendarFetch = calendarsByLocation.get(location.id) ?? null;
            return (
              <li key={location.id}>
                <Card>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">{location.name}</p>
                      {integration ? (
                        <p className="mt-1 text-sm text-emerald-700">
                          Connected —{" "}
                          {integration.google_email ?? "Google account"}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-ink-muted">
                          Not connected
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <form action="/admin/connect-google/start" method="GET">
                        <input
                          type="hidden"
                          name="locationId"
                          value={location.id}
                        />
                        <Button
                          type="submit"
                          variant={integration ? "secondary" : "primary"}
                        >
                          {integration ? "Reconnect" : "Connect"}
                        </Button>
                      </form>
                      {integration && (
                        <form
                          action="/admin/connect-google/disconnect"
                          method="POST"
                        >
                          <input
                            type="hidden"
                            name="locationId"
                            value={location.id}
                          />
                          <Button type="submit" variant="destructive">
                            Disconnect
                          </Button>
                        </form>
                      )}
                    </div>
                  </div>

                  {integration && calendarFetch?.status === "ok" && (
                    <CalendarPicker
                      locationId={location.id}
                      currentCalendarId={integration.google_calendar_id}
                      calendars={calendarFetch.calendars}
                    />
                  )}
                  {integration && calendarFetch?.status === "error" && (
                    <p className="mt-3 border-t border-border pt-3 text-sm text-red-700">
                      Couldn&apos;t load this account&apos;s calendars. The
                      connection may have expired — use Reconnect.
                    </p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
