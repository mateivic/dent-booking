// Resolves the dashboard period presets into absolute UTC ranges + chart
// buckets. All boundaries are local midnights in the display timezone (for
// "All locations" the caller passes the first location's timezone), converted
// per-instant via zonedToUtc so DST transitions are handled correctly.

import {
  addDaysIso,
  dateIsoInZone,
  todayIsoInZone,
  weekdayKey,
  zonedToUtc,
} from "@/features/booking/lib/timezone";
import type { Granularity, PeriodKey, PeriodRange } from "../types";

const WEEKDAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const PERIOD_KEYS: PeriodKey[] = [
  "this-week",
  "last-week",
  "this-month",
  "last-month",
  "this-year",
  "last-year",
];

export const DEFAULT_PERIOD: PeriodKey = "this-week";

export function parsePeriodKey(value: string | undefined): PeriodKey {
  return PERIOD_KEYS.includes(value as PeriodKey)
    ? (value as PeriodKey)
    : DEFAULT_PERIOD;
}

export function resolvePeriodRange(
  key: PeriodKey,
  timezone: string,
): PeriodRange {
  const todayIso = todayIsoInZone(timezone);

  switch (key) {
    case "this-week":
    case "last-week": {
      const mondayOffset = WEEKDAY_ORDER.indexOf(weekdayKey(todayIso, timezone));
      let startIso = addDaysIso(todayIso, -mondayOffset);
      if (key === "last-week") startIso = addDaysIso(startIso, -7);
      return dayBucketRange(key, startIso, addDaysIso(startIso, 7), timezone, weekdayLabel);
    }
    case "this-month":
    case "last-month": {
      let [year, month] = [
        Number(todayIso.slice(0, 4)),
        Number(todayIso.slice(5, 7)),
      ];
      if (key === "last-month") {
        month -= 1;
        if (month === 0) {
          month = 12;
          year -= 1;
        }
      }
      const startIso = `${year}-${pad2(month)}-01`;
      const endIso =
        month === 12 ? `${year + 1}-01-01` : `${year}-${pad2(month + 1)}-01`;
      return dayBucketRange(key, startIso, endIso, timezone, dayOfMonthLabel);
    }
    case "this-year":
    case "last-year": {
      const year =
        Number(todayIso.slice(0, 4)) - (key === "last-year" ? 1 : 0);
      const bucketKeys = Array.from(
        { length: 12 },
        (_, i) => `${year}-${pad2(i + 1)}`,
      );
      return {
        key,
        startUtcIso: zonedToUtc(`${year}-01-01`, "00:00", timezone).toISOString(),
        endUtcIso: zonedToUtc(`${year + 1}-01-01`, "00:00", timezone).toISOString(),
        granularity: "month",
        bucketKeys,
        bucketLabels: bucketKeys.map(monthLabel),
      };
    }
  }
}

// Bucket key ("YYYY-MM-DD" or "YYYY-MM") an instant falls into, in `timezone`.
export function bucketKeyForInstant(
  iso: string,
  timezone: string,
  granularity: Granularity,
): string {
  const dateIso = dateIsoInZone(new Date(iso), timezone);
  return granularity === "month" ? dateIso.slice(0, 7) : dateIso;
}

function dayBucketRange(
  key: PeriodKey,
  startIso: string,
  endIsoExclusive: string,
  timezone: string,
  label: (dateIso: string) => string,
): PeriodRange {
  const bucketKeys: string[] = [];
  for (let d = startIso; d < endIsoExclusive; d = addDaysIso(d, 1)) {
    bucketKeys.push(d);
  }
  return {
    key,
    startUtcIso: zonedToUtc(startIso, "00:00", timezone).toISOString(),
    endUtcIso: zonedToUtc(endIsoExclusive, "00:00", timezone).toISOString(),
    granularity: "day",
    bucketKeys,
    bucketLabels: bucketKeys.map(label),
  };
}

// Label helpers format the plain calendar date at UTC noon so the date can
// never shift — no timezone math is involved at label time.
function weekdayLabel(dateIso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateIso}T12:00:00Z`));
}

function dayOfMonthLabel(dateIso: string): string {
  return String(Number(dateIso.slice(8, 10)));
}

function monthLabel(monthKey: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${monthKey}-15T12:00:00Z`));
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
