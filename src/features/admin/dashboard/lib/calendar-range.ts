// Resolves the calendar's ?date= URL param into the Monday-based week that
// contains it. The whole week is always fetched so the desktop week view and
// the mobile day view share one data set.

import {
  addDaysIso,
  todayIsoInZone,
  weekdayKey,
  zonedToUtc,
} from "@/features/booking/lib/timezone";

const WEEKDAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface CalendarWeek {
  /** The day the calendar focuses (mobile day view, desktop week containing it). */
  focusedDateIso: string;
  /** Monday of the focused week. */
  weekStartIso: string;
  startUtcIso: string;
  endUtcIso: string;
}

export function resolveCalendarWeek(
  dateParam: string | undefined,
  timezone: string,
): CalendarWeek {
  const focusedDateIso = isValidDateIso(dateParam)
    ? dateParam
    : todayIsoInZone(timezone);

  const mondayOffset = WEEKDAY_ORDER.indexOf(
    weekdayKey(focusedDateIso, timezone),
  );
  const weekStartIso = addDaysIso(focusedDateIso, -mondayOffset);

  return {
    focusedDateIso,
    weekStartIso,
    startUtcIso: zonedToUtc(weekStartIso, "00:00", timezone).toISOString(),
    endUtcIso: zonedToUtc(
      addDaysIso(weekStartIso, 7),
      "00:00",
      timezone,
    ).toISOString(),
  };
}

function isValidDateIso(value: string | undefined): value is string {
  if (!value || !DATE_RE.test(value)) return false;
  // Reject impossible dates like 2026-02-31 (addDaysIso normalizes via Date.UTC).
  return addDaysIso(value, 0) === value;
}
