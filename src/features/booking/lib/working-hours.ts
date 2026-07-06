import type { WorkingHours } from "@/lib/supabase/types";
import {
  addDaysIso,
  localTimeInZone,
  weekdayKey,
  zonedToUtc,
} from "./timezone";

// Working-hours logic. `WorkingHours` is keyed by lowercase 3-letter English
// weekday codes ("mon".."sun"), matching what the admin form writes.

export function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

// One-off non-working dates ("YYYY-MM-DD") sit on top of the weekly hours: a
// date listed here is closed even if its weekday has open/close hours.
export function isClosedDate(
  dateIso: string,
  closedDates: string[] | null | undefined,
): boolean {
  return !!closedDates?.includes(dateIso);
}

export function isWithinWorkingHours(
  start: Date,
  end: Date,
  workingHours: WorkingHours,
  timezone: string,
): boolean {
  const startLocal = localTimeInZone(start, timezone);
  const endLocal = localTimeInZone(end, timezone);
  if (startLocal.weekday !== endLocal.weekday) return false;

  const dayConfig = workingHours[startLocal.weekday];
  if (!dayConfig) return false;

  return (
    startLocal.minutes >= parseHHMM(dayConfig.open) &&
    endLocal.minutes <= parseHHMM(dayConfig.close)
  );
}

export interface DayWindow {
  startUtc: Date;
  endUtc: Date;
}

export function dayWindowUtc(
  dateStr: string,
  openHHMM: string,
  closeHHMM: string,
  timezone: string,
): DayWindow {
  return {
    startUtc: zonedToUtc(dateStr, openHHMM, timezone),
    endUtc: zonedToUtc(dateStr, closeHHMM, timezone),
  };
}

// First date (YYYY-MM-DD) on/after `fromIso` the location is open, searching up
// to two weeks ahead. A day counts as open only if its weekday has hours and it
// is not a one-off closed date. Falls back to `fromIso` if nothing is open
// (mirrors the previous "default to today" behaviour rather than leaving the
// picker empty).
export function firstOpenDateIso(
  workingHours: WorkingHours,
  timezone: string,
  fromIso: string,
  closedDates?: string[] | null,
): string {
  let cur = fromIso;
  for (let i = 0; i < 14; i++) {
    if (workingHours[weekdayKey(cur, timezone)] && !isClosedDate(cur, closedDates)) {
      return cur;
    }
    cur = addDaysIso(cur, 1);
  }
  return fromIso;
}
