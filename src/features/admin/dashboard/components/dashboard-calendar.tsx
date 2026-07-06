"use client";

import { useEffect, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { EventClickArg, EventContentArg } from "@fullcalendar/core";
import type { FcBusinessHours } from "../lib/calendar-events";
import { floatingNowIso } from "../lib/floating-time";
import type { CalendarEventVM } from "../types";
import { useIsMobile } from "./use-is-mobile";

interface DashboardCalendarProps {
  events: CalendarEventVM[];
  /** Focused day (mobile day view); the week containing it renders on desktop. */
  initialDateIso: string;
  /** Display timezone — all event times are already wall-clock in this zone. */
  timezone: string;
  slotMinTime: string;
  slotMaxTime: string;
  businessHours: FcBusinessHours[];
  connectedLocationIds: string[];
  onEventClick: (id: string) => void;
}

// FullCalendar time-grid wrapper. Events arrive as "floating" local ISO
// strings pre-converted to the display timezone, so no timezone plugin is
// needed; the now-indicator gets the same treatment via floatingNowIso.
export function DashboardCalendar({
  events,
  initialDateIso,
  timezone,
  slotMinTime,
  slotMaxTime,
  businessHours,
  connectedLocationIds,
  onEventClick,
}: DashboardCalendarProps) {
  const isMobile = useIsMobile();
  const calendarRef = useRef<FullCalendar>(null);

  // `initialView`/`initialDate` only apply at mount; keep the rendered view
  // and date in sync when the breakpoint or the ?date= navigation changes.
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const view = isMobile ? "timeGridDay" : "timeGridWeek";
    if (api.view.type !== view) {
      api.changeView(view, initialDateIso);
    } else {
      api.gotoDate(initialDateIso);
    }
  }, [isMobile, initialDateIso]);

  const connected = new Set(connectedLocationIds);

  function renderEventContent(arg: EventContentArg) {
    const vm = arg.event.extendedProps.vm as CalendarEventVM;
    const syncWarning =
      connected.has(vm.locationId) &&
      (vm.googleSyncStatus === "FAILED" || vm.googleSyncStatus === "PENDING");
    const durationMin =
      arg.event.start && arg.event.end
        ? (arg.event.end.getTime() - arg.event.start.getTime()) / 60000
        : 60;
    const title = `${vm.timeLabel} · ${vm.clientName}`;

    // The card height scales with duration (~40px per 30 min), so short slots
    // can't hold three lines. Collapse to what fits: a ~15-min slot shows only
    // the client name; a ~30-min slot drops the services line. Full detail is
    // always available in the tooltip and the details panel.
    const reviewSent = Boolean(vm.reviewEmailSentAt);

    if (durationMin <= 20) {
      return (
        <div
          className="flex h-full items-center gap-1 overflow-hidden px-1.5 leading-none"
          title={title}
        >
          {syncWarning ? <SyncWarningIcon /> : null}
          {reviewSent ? <ReviewSentIcon /> : null}
          <span className="truncate text-[11px] font-medium">
            {vm.clientName}
          </span>
        </div>
      );
    }

    return (
      <div
        className="flex h-full flex-col overflow-hidden px-1.5 py-0.5 text-left"
        title={title}
      >
        <p className="flex items-center gap-1 truncate text-[11px] leading-tight text-ink-muted">
          {vm.timeLabel}
          {syncWarning ? <SyncWarningIcon /> : null}
          {reviewSent ? <ReviewSentIcon /> : null}
        </p>
        <p className="truncate text-xs font-medium leading-tight">
          {vm.clientName}
        </p>
        {durationMin > 40 ? (
          <p className="truncate text-[11px] leading-tight text-ink-muted">
            {vm.services.map((s) => s.name).join(", ")}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <FullCalendar
      ref={calendarRef}
      plugins={[timeGridPlugin]}
      initialView={isMobile ? "timeGridDay" : "timeGridWeek"}
      initialDate={initialDateIso}
      firstDay={1}
      headerToolbar={false}
      allDaySlot={false}
      nowIndicator
      now={() => floatingNowIso(timezone)}
      slotMinTime={slotMinTime}
      slotMaxTime={slotMaxTime}
      slotDuration="00:30:00"
      businessHours={businessHours}
      events={events.map((e) => ({
        id: e.id,
        start: e.start,
        end: e.end,
        extendedProps: { vm: e },
      }))}
      eventContent={renderEventContent}
      eventClick={(arg: EventClickArg) => {
        arg.jsEvent.preventDefault();
        onEventClick(arg.event.id);
      }}
      eventClassNames="cursor-pointer"
      height="auto"
      expandRows
      dayHeaderFormat={{ weekday: "short", day: "numeric" }}
      slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
    />
  );
}

function ReviewSentIcon() {
  return (
    <svg
      aria-label="Review email sent"
      role="img"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3 w-3 shrink-0 text-amber-500"
    >
      <path d="M10 1.8l2.47 5 5.53.8-4 3.9.94 5.5L10 14.4 5.06 17l.94-5.5-4-3.9 5.53-.8 2.47-5z" />
    </svg>
  );
}

function SyncWarningIcon() {
  return (
    <svg
      aria-label="Not synced to Google Calendar"
      role="img"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3 w-3 shrink-0 text-amber-600"
    >
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
