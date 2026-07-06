"use client";

import { type CSSProperties } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import type { WorkingHours } from "@/lib/supabase/types";
import { todayIsoInZone, weekdayKey } from "../lib/timezone";
import { isClosedDate } from "../lib/working-hours";

interface BookingCalendarProps {
  value: string | null; // YYYY-MM-DD in the location's timezone
  onSelect: (dateStr: string) => void;
  timezone: string;
  workingHours: WorkingHours;
  closedDates: string[];
}

// react-day-picker works in the browser's local time. We treat its `Date`s as
// naive calendar dates: build/read them with local getters only (never UTC) so
// a clicked day maps to the same YYYY-MM-DD regardless of the visitor's own
// timezone. "Today" is anchored to the location's timezone, not the browser's.
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

export function BookingCalendar({
  value,
  onSelect,
  timezone,
  workingHours,
  closedDates,
}: BookingCalendarProps) {
  const today = isoToLocalDate(todayIsoInZone(timezone));
  const selected = value ? isoToLocalDate(value) : undefined;

  const isClosedDay = (date: Date): boolean => {
    const iso = localDateToIso(date);
    return !workingHours[weekdayKey(iso, timezone)] || isClosedDate(iso, closedDates);
  };

  return (
    <div className="inline-block rounded-lg border border-border bg-surface p-3">
      <DayPicker
        mode="single"
        weekStartsOn={1}
        selected={selected}
        onSelect={(date) => {
          if (date) onSelect(localDateToIso(date));
        }}
        today={today}
        startMonth={today}
        disabled={[{ before: today }, isClosedDay]}
        showOutsideDays
        style={themeVars}
      />
    </div>
  );
}
