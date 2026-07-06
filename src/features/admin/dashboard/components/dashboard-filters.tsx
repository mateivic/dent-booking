"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import type { Location } from "@/lib/supabase/types";
import { LocationFilter } from "@/features/admin/shared/location-filter";
import { DEFAULT_PERIOD } from "../lib/period";
import type { PeriodKey } from "../types";

const PERIOD_OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "this-week", label: "This week" },
  { value: "last-week", label: "Last week" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "this-year", label: "This year" },
  { value: "last-year", label: "Last year" },
];

interface DashboardFiltersProps {
  locations: Location[];
}

export function DashboardFilters({ locations }: DashboardFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <PeriodFilter />
      <LocationFilter locations={locations} includeAll />
    </div>
  );
}

function PeriodFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const current = searchParams.get("period") ?? DEFAULT_PERIOD;

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    const params = new URLSearchParams(searchParams.toString());

    if (next === DEFAULT_PERIOD) {
      params.delete("period");
    } else {
      params.set("period", next);
    }

    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `?${qs}` : "?");
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="period-filter" className="text-sm text-ink-muted">
        Period
      </label>
      <select
        id="period-filter"
        value={current}
        onChange={handleChange}
        disabled={pending}
        className={cn(
          "h-9 rounded-md border border-border bg-white px-3 text-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1",
          "disabled:opacity-50",
        )}
      >
        {PERIOD_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
