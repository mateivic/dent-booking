"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { addDaysIso } from "@/features/booking/lib/timezone";
import { useIsMobile } from "./use-is-mobile";

interface CalendarNavProps {
  focusedDateIso: string;
  weekStartIso: string;
}

// Week/day navigation via the ?date= URL param (server refetches the
// containing week). Desktop steps a week at a time, mobile a day at a time.
// "Today" clears the param — the server falls back to today in the display
// timezone.
export function CalendarNav({ focusedDateIso, weekStartIso }: CalendarNavProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const isMobile = useIsMobile();

  function navigateTo(dateIso: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (dateIso) params.set("date", dateIso);
    else params.delete("date");
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `?${qs}` : "?");
    });
  }

  const step = isMobile ? 1 : 7;
  const label = isMobile
    ? formatDate(focusedDateIso, {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : `${formatDate(weekStartIso, { day: "numeric", month: "short" })} – ${formatDate(
        addDaysIso(weekStartIso, 6),
        { day: "numeric", month: "short", year: "numeric" },
      )}`;

  return (
    <div className="flex items-center gap-2">
      <span className="mr-1 text-sm font-medium text-ink" aria-live="polite">
        {label}
      </span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        aria-label={isMobile ? "Previous day" : "Previous week"}
        onClick={() => navigateTo(addDaysIso(focusedDateIso, -step))}
      >
        <ChevronIcon direction="left" />
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => navigateTo(null)}
      >
        Today
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        aria-label={isMobile ? "Next day" : "Next week"}
        onClick={() => navigateTo(addDaysIso(focusedDateIso, step))}
      >
        <ChevronIcon direction="right" />
      </Button>
    </div>
  );
}

// Plain calendar dates formatted at UTC noon — no timezone shifting possible.
function formatDate(
  dateIso: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(
    new Date(`${dateIso}T12:00:00Z`),
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {direction === "left" ? (
        <path d="M12.5 15L7.5 10l5-5" />
      ) : (
        <path d="M7.5 5l5 5-5 5" />
      )}
    </svg>
  );
}
