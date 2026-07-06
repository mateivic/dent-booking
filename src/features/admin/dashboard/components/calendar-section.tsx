"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { FcBusinessHours } from "../lib/calendar-events";
import type { CalendarEventVM } from "../types";
import { CalendarNav } from "./calendar-nav";
import { EventDetailsPanel } from "./event-details-panel";

// FullCalendar is browser-only and heavy — lazy-load it on the client.
const DashboardCalendar = dynamic(
  () => import("./dashboard-calendar").then((m) => m.DashboardCalendar),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full" /> },
);

interface CalendarSectionProps {
  events: CalendarEventVM[];
  focusedDateIso: string;
  weekStartIso: string;
  timezone: string;
  timezoneNote: string | null;
  slotMinTime: string;
  slotMaxTime: string;
  businessHours: FcBusinessHours[];
  connectedLocationIds: string[];
}

export function CalendarSection({
  events,
  focusedDateIso,
  weekStartIso,
  timezone,
  timezoneNote,
  slotMinTime,
  slotMaxTime,
  businessHours,
  connectedLocationIds,
}: CalendarSectionProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = events.find((e) => e.id === selectedId) ?? null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-ink">Calendar</h3>
        <CalendarNav
          focusedDateIso={focusedDateIso}
          weekStartIso={weekStartIso}
        />
      </div>
      {timezoneNote ? (
        <p className="text-xs text-ink-muted">Times shown in {timezoneNote}.</p>
      ) : null}
      <Card className="p-2 sm:p-4">
        <DashboardCalendar
          events={events}
          initialDateIso={focusedDateIso}
          timezone={timezone}
          slotMinTime={slotMinTime}
          slotMaxTime={slotMaxTime}
          businessHours={businessHours}
          connectedLocationIds={connectedLocationIds}
          onEventClick={setSelectedId}
        />
      </Card>
      <EventDetailsPanel
        event={selected}
        connectedLocationIds={connectedLocationIds}
        onClose={() => setSelectedId(null)}
      />
    </section>
  );
}
