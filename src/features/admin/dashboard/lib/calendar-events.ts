// Server-side assembly of calendar props: reservation rows → FullCalendar
// event view models (floating local times), plus the visible hour window and
// business-hours shading derived from the displayed locations' working hours.

import { formatHHMM } from "@/features/booking/lib/timezone";
import { parseHHMM } from "@/features/booking/lib/working-hours";
import type { Location, WorkingHoursValue } from "@/lib/supabase/types";
import type { CalendarEventVM, CalendarReservationRow } from "../types";
import { toFloatingIso } from "./floating-time";

// FullCalendar weekday indices (0 = Sunday) for our "mon".."sun" keys.
const FC_DAY_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

export interface FcBusinessHours {
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
}

export interface CalendarWindow {
  /** e.g. "08:00:00" */
  slotMinTime: string;
  slotMaxTime: string;
  businessHours: FcBusinessHours[];
}

const FALLBACK_START_MIN = 8 * 60;
const FALLBACK_END_MIN = 20 * 60;
const PAD_MIN = 60;

export function toCalendarEventVM(
  row: CalendarReservationRow,
  timezone: string,
): CalendarEventVM {
  const start = new Date(row.startTime);
  const end = new Date(row.endTime);
  return {
    id: row.id,
    start: toFloatingIso(row.startTime, timezone),
    end: toFloatingIso(row.endTime, timezone),
    dateLabel: new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(start),
    timeLabel: `${formatHHMM(start, timezone)} – ${formatHHMM(end, timezone)}`,
    clientName: row.clientName,
    clientEmail: row.clientEmail,
    clientPhone: row.clientPhone,
    services: row.services,
    status: row.status,
    googleSyncStatus: row.googleSyncStatus,
    reviewEmailSentAt: row.reviewEmailSentAt,
    isFinished: end.getTime() < Date.now(),
    hasReviewLink: row.locationReviewLink !== null,
    locationId: row.locationId,
    locationName: row.locationName,
    notes: row.notes,
  };
}

// Visible hour range = union of the displayed locations' working hours padded
// by an hour each side, expanded so no event can clip, floored/ceiled to whole
// hours; 08–20 when nothing is configured. Business hours shade open time per
// weekday (widest open window across the displayed locations).
export function deriveCalendarWindow(
  locations: Location[],
  events: CalendarEventVM[],
): CalendarWindow {
  let openMin = Number.POSITIVE_INFINITY;
  let closeMax = Number.NEGATIVE_INFINITY;
  const byWeekday = new Map<number, { open: number; close: number }>();

  for (const location of locations) {
    for (const [weekday, value] of Object.entries(location.working_hours ?? {})) {
      const window = value as WorkingHoursValue;
      const dayIndex = FC_DAY_INDEX[weekday];
      if (!window || dayIndex === undefined) continue;
      const open = parseHHMM(window.open);
      const close = parseHHMM(window.close);
      openMin = Math.min(openMin, open);
      closeMax = Math.max(closeMax, close);
      const existing = byWeekday.get(dayIndex);
      byWeekday.set(dayIndex, {
        open: Math.min(existing?.open ?? open, open),
        close: Math.max(existing?.close ?? close, close),
      });
    }
  }

  let startMin = Number.isFinite(openMin)
    ? openMin - PAD_MIN
    : FALLBACK_START_MIN;
  let endMin = Number.isFinite(closeMax) ? closeMax + PAD_MIN : FALLBACK_END_MIN;

  for (const event of events) {
    startMin = Math.min(startMin, floatingMinutes(event.start));
    // An event ending on a later calendar day keeps the column open to midnight.
    const sameDay = event.end.slice(0, 10) === event.start.slice(0, 10);
    endMin = Math.max(endMin, sameDay ? floatingMinutes(event.end) : 24 * 60);
  }

  startMin = Math.max(0, Math.floor(startMin / 60) * 60);
  endMin = Math.min(24 * 60, Math.ceil(endMin / 60) * 60);

  return {
    slotMinTime: minutesToHms(startMin),
    slotMaxTime: minutesToHms(endMin),
    businessHours: [...byWeekday.entries()].map(([dayIndex, window]) => ({
      daysOfWeek: [dayIndex],
      startTime: minutesToHms(window.open),
      endTime: minutesToHms(window.close),
    })),
  };
}

function floatingMinutes(floatingIso: string): number {
  return parseHHMM(floatingIso.slice(11, 16));
}

function minutesToHms(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}
