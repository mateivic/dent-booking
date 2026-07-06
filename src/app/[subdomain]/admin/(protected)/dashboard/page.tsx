import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import type { Location } from "@/lib/supabase/types";
import { getTenantBundlePrivate } from "@/lib/tenant";
import { resolveLocation } from "@/features/admin/shared/resolve-location";
import { CalendarSection } from "@/features/admin/dashboard/components/calendar-section";
import { ChartsSection } from "@/features/admin/dashboard/components/charts-section";
import { DashboardFilters } from "@/features/admin/dashboard/components/dashboard-filters";
import { KpiTiles } from "@/features/admin/dashboard/components/kpi-tiles";
import {
  deriveCalendarWindow,
  toCalendarEventVM,
} from "@/features/admin/dashboard/lib/calendar-events";
import { resolveCalendarWeek } from "@/features/admin/dashboard/lib/calendar-range";
import { computeKpis } from "@/features/admin/dashboard/lib/kpis";
import {
  parsePeriodKey,
  resolvePeriodRange,
} from "@/features/admin/dashboard/lib/period";
import {
  fetchCalendarReservations,
  fetchKpiReservations,
} from "@/features/admin/dashboard/server/queries";

interface PageProps {
  params: Promise<{ subdomain: string }>;
  searchParams: Promise<{ location?: string; period?: string; date?: string }>;
}

export default async function DashboardPage({ params, searchParams }: PageProps) {
  const [{ subdomain }, { location: locationParam, period: periodParam, date: dateParam }] =
    await Promise.all([params, searchParams]);

  // Private bundle: needed to derive which locations are Google-connected.
  // Only the derived id list crosses into client props — never integration rows.
  const bundle = await getTenantBundlePrivate(subdomain);
  if (!bundle) notFound();

  const resolved = resolveLocation(bundle.locations, locationParam, {
    allowAll: true,
  });

  if (resolved.kind === "empty") {
    return (
      <section className="space-y-6">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <Card>
          <p className="text-sm text-ink-muted">
            Add a location first — the dashboard shows reservations per location.
          </p>
        </Card>
      </section>
    );
  }

  const displayedLocations =
    resolved.kind === "one" ? [resolved.location] : bundle.locations;
  // For "All locations" the first location's timezone drives periods + calendar.
  const displayTimezone = displayedLocations[0].timezone;
  const locationId =
    resolved.kind === "one" ? resolved.location.id : undefined;

  const period = resolvePeriodRange(parsePeriodKey(periodParam), displayTimezone);
  const week = resolveCalendarWeek(dateParam, displayTimezone);

  let kpiRows, calendarRows;
  try {
    [kpiRows, calendarRows] = await Promise.all([
      fetchKpiReservations({
        startUtcIso: period.startUtcIso,
        endUtcIso: period.endUtcIso,
        locationId,
      }),
      fetchCalendarReservations({
        startUtcIso: week.startUtcIso,
        endUtcIso: week.endUtcIso,
        locationId,
      }),
    ]);
  } catch (error) {
    return (
      <section className="space-y-6">
        <Header locations={bundle.locations} />
        <p className="text-red-700">
          {error instanceof Error ? error.message : "Failed to load dashboard data."}
        </p>
      </section>
    );
  }

  const kpis = computeKpis(kpiRows, period, displayTimezone);
  const events = calendarRows.map((row) =>
    toCalendarEventVM(row, displayTimezone),
  );
  const window = deriveCalendarWindow(displayedLocations, events);

  const connectedLocationIds = bundle.calendarIntegrations.map(
    (integration) => integration.location_id,
  );

  const timezoneNote =
    new Set(displayedLocations.map((l) => l.timezone)).size > 1
      ? displayTimezone
      : null;

  return (
    <section className="space-y-6">
      <Header locations={bundle.locations} />
      <KpiTiles kpis={kpis} />
      <ChartsSection series={kpis.series} topServices={kpis.topServices} />
      <CalendarSection
        key={`${week.weekStartIso}:${displayTimezone}:${locationId ?? "all"}`}
        events={events}
        focusedDateIso={week.focusedDateIso}
        weekStartIso={week.weekStartIso}
        timezone={displayTimezone}
        timezoneNote={timezoneNote}
        slotMinTime={window.slotMinTime}
        slotMaxTime={window.slotMaxTime}
        businessHours={window.businessHours}
        connectedLocationIds={connectedLocationIds}
      />
    </section>
  );
}

function Header({ locations }: { locations: Location[] }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h2 className="text-xl font-semibold">Dashboard</h2>
      <DashboardFilters locations={locations} />
    </div>
  );
}
