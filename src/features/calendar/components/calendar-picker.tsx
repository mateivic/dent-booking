"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { CalendarListEntry } from "@/features/calendar/lib/google";
import {
  updateLocationCalendar,
  type UpdateLocationCalendarResult,
} from "@/features/calendar/actions/calendar-selection";

interface CalendarPickerProps {
  locationId: string;
  currentCalendarId: string;
  calendars: CalendarListEntry[];
}

// Dropdown of the connected account's writable calendars. The primary
// calendar is stored under Google's "primary" alias (the column default), all
// others under their real calendar id.
export function CalendarPicker({
  locationId,
  currentCalendarId,
  calendars,
}: CalendarPickerProps) {
  const [selected, setSelected] = useState(currentCalendarId);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<UpdateLocationCalendarResult | null>(
    null,
  );

  const options = calendars.map((c) => ({
    value: c.primary ? "primary" : c.id,
    label: c.primary ? `${c.summary} (primary)` : c.summary,
  }));
  // The saved calendar can disappear (deleted or unshared on Google's side);
  // keep it selectable so the dropdown reflects reality and warn the admin.
  const currentIsKnown = options.some((o) => o.value === currentCalendarId);

  const selectId = `calendar-${locationId}`;

  function save() {
    startTransition(async () => {
      setResult(await updateLocationCalendar(locationId, selected));
    });
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <Label htmlFor={selectId}>Calendar</Label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Select
          id={selectId}
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setResult(null);
          }}
          disabled={pending}
          className="sm:max-w-xs"
        >
          {!currentIsKnown && (
            <option value={currentCalendarId}>
              Unknown calendar (no longer available)
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          variant="primary"
          onClick={save}
          disabled={pending || selected === currentCalendarId}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>

      {!currentIsKnown && (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          The selected calendar is no longer available on this Google account —
          pick another and save.
        </p>
      )}
      {result?.ok === false && result.error && (
        <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {result.error}
        </p>
      )}
      {result?.ok === true && (
        <p className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Saved.
        </p>
      )}
    </div>
  );
}
