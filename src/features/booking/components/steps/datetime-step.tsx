"use client";

import { useEffect, type Dispatch } from "react";
import type { Location } from "@/lib/supabase/types";
import type { BookingAction, BookingState } from "../../lib/booking-state";
import type { SlotsQueryState } from "../../hooks/use-slots-query";
import { localHHMMToUtcIso, todayIsoInZone } from "../../lib/timezone";
import { firstOpenDateIso } from "../../lib/working-hours";
import { BookingCalendar } from "../booking-calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useT } from "@/features/i18n/language-provider";

interface DateTimeStepProps {
  state: BookingState;
  dispatch: Dispatch<BookingAction>;
  location: Location;
  slotsQuery: SlotsQueryState;
}

export function DateTimeStep({
  state,
  dispatch,
  location,
  slotsQuery,
}: DateTimeStepProps) {
  const t = useT();
  // Default to the first open day on/after today (in the location's timezone),
  // so the slot list isn't empty when the clinic is closed today.
  useEffect(() => {
    if (!state.date) {
      const today = todayIsoInZone(location.timezone);
      dispatch({
        type: "SET_DATE",
        date: firstOpenDateIso(
          location.working_hours,
          location.timezone,
          today,
          location.closed_dates,
        ),
      });
    }
  }, [
    state.date,
    location.timezone,
    location.working_hours,
    location.closed_dates,
    dispatch,
  ]);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl font-medium tracking-tight">
        {t.datetime.heading}
      </h2>

      <div className="flex justify-center">
        <BookingCalendar
          value={state.date}
          onSelect={(date) => dispatch({ type: "SET_DATE", date })}
          timezone={location.timezone}
          workingHours={location.working_hours}
          closedDates={location.closed_dates}
        />
      </div>

      <SlotsDisplay
        state={state}
        dispatch={dispatch}
        location={location}
        slotsQuery={slotsQuery}
      />
    </div>
  );
}

interface SlotsDisplayProps {
  state: BookingState;
  dispatch: Dispatch<BookingAction>;
  location: Location;
  slotsQuery: SlotsQueryState;
}

function SlotsDisplay({
  state,
  dispatch,
  location,
  slotsQuery,
}: SlotsDisplayProps) {
  const t = useT();
  if (slotsQuery.status === "loading") {
    return (
      <div
        role="status"
        aria-label={t.datetime.finding}
        className="grid grid-cols-4 gap-2 sm:grid-cols-6"
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
    );
  }
  if (slotsQuery.status === "error") {
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {slotsQuery.error ?? t.datetime.loadError}
      </p>
    );
  }
  if (slotsQuery.status === "ready" && slotsQuery.slots.length === 0) {
    return (
      <p className="text-sm text-ink-muted">{t.datetime.noSlots}</p>
    );
  }
  if (slotsQuery.status !== "ready" || !state.date) return null;

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {slotsQuery.slots.map((hhmm) => {
        const iso = localHHMMToUtcIso(state.date!, hhmm, location.timezone);
        const isSelected = state.startIso === iso;
        return (
          <button
            key={hhmm}
            type="button"
            onClick={() => dispatch({ type: "SET_SLOT", startIso: iso })}
            className={cn(
              "rounded-md border py-2 text-sm font-medium transition duration-150",
              "hover:-translate-y-px active:scale-95 motion-reduce:transform-none",
              isSelected
                ? "border-brand bg-brand text-white shadow-sm"
                : "border-border hover:border-brand hover:bg-surface-muted",
            )}
          >
            {hhmm}
          </button>
        );
      })}
    </div>
  );
}
