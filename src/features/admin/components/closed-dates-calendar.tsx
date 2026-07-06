"use client";

import { type CSSProperties } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { todayIsoInZone, weekdayKey } from "@/features/booking/lib/timezone";

interface ClosedDatesCalendarProps {
  /** Selected closed dates as YYYY-MM-DD (location timezone). */
  value: string[];
  onChange: (dates: string[]) => void;
  timezone: string;
  /** Weekday codes ("mon".."sun") already closed by the weekly schedule. */
  weeklyClosedWeekdays: Set<string>;
}

// react-day-picker works in the browser's local time. Treat its `Date`s as naive
// calendar dates: build/read them with local getters only (never UTC) so a
// clicked day maps to the same YYYY-MM-DD regardless of the visitor's timezone.
// Mirrors booking-calendar.tsx.
function isoToLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function localDateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Map react-day-picker's brand-agnostic CSS variables onto the tenant theme.
const themeVars = {
  "--rdp-accent-color": "var(--color-brand)",
  "--rdp-accent-background-color": "var(--color-surface-muted)",
  "--rdp-today-color": "var(--color-brand)",
} as CSSProperties;

export function ClosedDatesCalendar({
  value,
  onChange,
  timezone,
  weeklyClosedWeekdays,
}: ClosedDatesCalendarProps) {
  const today = isoToLocalDate(todayIsoInZone(timezone));
  const selected = value.map(isoToLocalDate);

  // Days already closed by the weekly schedule can't be marked as exceptions —
  // the admin only paints closures onto otherwise-open days.
  const isWeeklyClosed = (date: Date): boolean =>
    weeklyClosedWeekdays.has(weekdayKey(localDateToIso(date), timezone));

  return (
    <div className="inline-block rounded-lg border border-border bg-surface p-3">
      <DayPicker
        mode="multiple"
        weekStartsOn={1}
        selected={selected}
        onSelect={(dates) => onChange((dates ?? []).map(localDateToIso).sort())}
        today={today}
        startMonth={today}
        disabled={[{ before: today }, isWeeklyClosed]}
        showOutsideDays
        style={themeVars}
      />
    </div>
  );
}
