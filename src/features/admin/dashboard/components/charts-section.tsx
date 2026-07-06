"use client";

import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardKpis } from "../types";

// Charts are browser-only (canvas) and heavy — load them lazily on the client
// so chart.js stays out of the server bundle and the initial route JS.
const ReservationsChart = dynamic(
  () => import("./reservations-chart").then((m) => m.ReservationsChart),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> },
);
const TopServicesChart = dynamic(
  () => import("./top-services-chart").then((m) => m.TopServicesChart),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> },
);

interface ChartsSectionProps {
  series: DashboardKpis["series"];
  topServices: DashboardKpis["topServices"];
}

export function ChartsSection({ series, topServices }: ChartsSectionProps) {
  const hasReservations = series.counts.some((count) => count > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <h3 className="text-sm font-medium text-ink-muted">Reservations</h3>
        <div className="mt-3 h-64">
          {hasReservations ? (
            <ReservationsChart
              labels={series.labels}
              counts={series.counts}
              revenues={series.revenues}
            />
          ) : (
            <EmptyChart />
          )}
        </div>
      </Card>
      <Card className="p-4">
        <h3 className="text-sm font-medium text-ink-muted">Top services</h3>
        <div className="mt-3 h-64">
          {topServices.length > 0 ? (
            <TopServicesChart services={topServices} />
          ) : (
            <EmptyChart />
          )}
        </div>
      </Card>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-ink-muted">
      No reservations in this period.
    </div>
  );
}
