// Pure KPI aggregation over normalized reservation rows. Volumes are small
// (one clinic's reservations for a period), so this runs in TS on the server
// instead of a Postgres RPC — the timezone bucketing stays in one language.

import type { DashboardKpis, KpiReservationRow, PeriodRange } from "../types";
import { bucketKeyForInstant } from "./period";

const TOP_SERVICES_LIMIT = 5;

export function computeKpis(
  rows: KpiReservationRow[],
  range: PeriodRange,
  timezone: string,
): DashboardKpis {
  const active = rows.filter((r) => r.status !== "CANCELLED");
  const cancelledCount = rows.length - active.length;

  let revenue = 0;
  const serviceAgg = new Map<string, { count: number; revenue: number }>();
  const clientAgg = new Map<string, { name: string; count: number }>();
  const countByBucket = new Map<string, number>(
    range.bucketKeys.map((k) => [k, 0]),
  );
  const revenueByBucket = new Map<string, number>(
    range.bucketKeys.map((k) => [k, 0]),
  );

  for (const row of active) {
    const rowRevenue = row.services.reduce((sum, s) => sum + s.price, 0);
    revenue += rowRevenue;

    for (const service of row.services) {
      const agg = serviceAgg.get(service.name) ?? { count: 0, revenue: 0 };
      agg.count += 1;
      agg.revenue += service.price;
      serviceAgg.set(service.name, agg);
    }

    const client = clientAgg.get(row.clientId) ?? {
      name: row.clientName,
      count: 0,
    };
    client.count += 1;
    clientAgg.set(row.clientId, client);

    const bucket = bucketKeyForInstant(
      row.startTime,
      timezone,
      range.granularity,
    );
    if (countByBucket.has(bucket)) {
      countByBucket.set(bucket, (countByBucket.get(bucket) ?? 0) + 1);
      revenueByBucket.set(
        bucket,
        (revenueByBucket.get(bucket) ?? 0) + rowRevenue,
      );
    }
  }

  const topServices = [...serviceAgg.entries()]
    .map(([name, agg]) => ({ name, ...agg }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, TOP_SERVICES_LIMIT);

  const topClient =
    [...clientAgg.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    )[0] ?? null;

  return {
    reservationCount: active.length,
    cancelledCount,
    revenue,
    topServices,
    topClient,
    series: {
      labels: range.bucketLabels,
      counts: range.bucketKeys.map((k) => countByBucket.get(k) ?? 0),
      revenues: range.bucketKeys.map((k) => revenueByBucket.get(k) ?? 0),
    },
  };
}
