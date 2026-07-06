"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
    updateWorkingHours,
    type UpdateWorkingHoursState,
} from "../actions/update-working-hours";
import type { WorkingHours } from "@/lib/supabase/types";
import { ClosedDatesCalendar } from "./closed-dates-calendar";

interface WorkingHoursFormProps {
    locationId: string;
    locationName: string;
    workingHours: WorkingHours;
    timezone: string;
    closedDates: string[];
}

interface DayState {
    closed: boolean;
    open: string;
    close: string;
}

const WEEKDAYS: Array<{ key: string; short: string; label: string }> = [
    { key: "mon", short: "Mon", label: "Monday" },
    { key: "tue", short: "Tue", label: "Tuesday" },
    { key: "wed", short: "Wed", label: "Wednesday" },
    { key: "thu", short: "Thu", label: "Thursday" },
    { key: "fri", short: "Fri", label: "Friday" },
    { key: "sat", short: "Sat", label: "Saturday" },
    { key: "sun", short: "Sun", label: "Sunday" },
];

const initialActionState: UpdateWorkingHoursState = { ok: null };

// "2026-12-25" -> "25.12.2026." (Croatian short date on the summary chips).
function formatChipDate(iso: string): string {
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}.`;
}

function buildInitialDays(workingHours: WorkingHours): Record<string, DayState> {
    return WEEKDAYS.reduce<Record<string, DayState>>((acc, { key }) => {
        const cfg = workingHours[key];
        acc[key] = cfg
            ? { closed: false, open: cfg.open, close: cfg.close }
            : { closed: true, open: "09:00", close: "17:00" };
        return acc;
    }, {});
}

export function WorkingHoursForm({
    locationId,
    locationName,
    workingHours,
    timezone,
    closedDates: initialClosedDates,
}: WorkingHoursFormProps) {
    const [state, action, pending] = useActionState(updateWorkingHours, initialActionState);
    const [days, setDays] = useState(() => buildInitialDays(workingHours));
    const [closedDates, setClosedDates] = useState<string[]>(
        () => [...initialClosedDates].sort(),
    );

    // Weekdays already closed by the weekly schedule — the exceptions calendar
    // greys these out so only otherwise-open days can be marked closed.
    const weeklyClosedWeekdays = useMemo(
        () =>
            new Set(
                WEEKDAYS.filter(({ key }) => days[key].closed).map(({ key }) => key),
            ),
        [days],
    );

    function setDay(key: string, patch: Partial<DayState>) {
        setDays((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    }

    function removeClosedDate(iso: string) {
        setClosedDates((prev) => prev.filter((d) => d !== iso));
    }

    function applyToWeekdays() {
        const mon = days.mon;
        setDays((prev) => ({
            ...prev,
            tue: { ...mon },
            wed: { ...mon },
            thu: { ...mon },
            fri: { ...mon },
        }));
    }

    function applyToAll() {
        const mon = days.mon;
        setDays((prev) => {
            const next = { ...prev };
            for (const { key } of WEEKDAYS) {
                next[key] = { ...mon };
            }
            return next;
        });
    }

    function closeWeekends() {
        setDays((prev) => ({
            ...prev,
            sat: { ...prev.sat, closed: true },
            sun: { ...prev.sun, closed: true },
        }));
    }

    return (
        <form action={action} className="space-y-6">
            <input type="hidden" name="locationId" value={locationId} />

            <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="text-lg font-medium">{locationName}</h3>
                <div className="flex flex-wrap gap-2 text-xs">
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={applyToWeekdays}
                        className="text-ink-muted"
                    >
                        Mon→Fri same as Monday
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={applyToAll}
                        className="text-ink-muted"
                    >
                        All week same as Monday
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={closeWeekends}
                        className="text-ink-muted"
                    >
                        Close weekends
                    </Button>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {WEEKDAYS.map(({ key, label }) => {
                    const day = days[key];
                    return (
                        <div
                            key={key}
                            className={cn(
                                "rounded-lg border p-4 transition-colors",
                                day.closed
                                    ? "border-border bg-surface-muted"
                                    : "border-brand/30 bg-white",
                            )}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold">{label}</p>
                                    <span
                                        className={cn(
                                            "text-xs font-medium",
                                            day.closed ? "text-ink-muted" : "text-brand",
                                        )}
                                    >
                                        {day.closed ? "Closed" : "Open"}
                                    </span>
                                </div>
                                <Switch
                                    checked={!day.closed}
                                    onCheckedChange={(open) =>
                                        setDay(key, { closed: !open })
                                    }
                                    aria-label={`${label}: ${day.closed ? "closed" : "open"}`}
                                />
                            </div>

                            <input
                                type="hidden"
                                name={`${key}_closed`}
                                value={day.closed ? "on" : ""}
                            />

                            {day.closed ? (
                                <p className="mt-3 text-sm text-ink-muted">
                                    Closed all day
                                </p>
                            ) : (
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-ink-muted">
                                            Open
                                        </label>
                                        <Input
                                            type="time"
                                            name={`${key}_open`}
                                            value={day.open}
                                            onChange={(e) =>
                                                setDay(key, { open: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-ink-muted">
                                            Close
                                        </label>
                                        <Input
                                            type="time"
                                            name={`${key}_close`}
                                            value={day.close}
                                            onChange={(e) =>
                                                setDay(key, { close: e.target.value })
                                            }
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="space-y-3 border-t border-border pt-6">
                <div>
                    <h4 className="text-base font-medium">Non-working days</h4>
                    <p className="text-sm text-ink-muted">
                        Click a day to close the clinic for that date (holidays,
                        vacation). Days already closed by the weekly schedule
                        can&apos;t be selected.
                    </p>
                </div>

                <input
                    type="hidden"
                    name="closed_dates"
                    value={closedDates.join(",")}
                />

                <div className="flex flex-wrap gap-6">
                    <ClosedDatesCalendar
                        value={closedDates}
                        onChange={setClosedDates}
                        timezone={timezone}
                        weeklyClosedWeekdays={weeklyClosedWeekdays}
                    />

                    <div className="min-w-48 flex-1">
                        <p className="mb-2 text-sm font-medium">
                            Selected ({closedDates.length})
                        </p>
                        {closedDates.length === 0 ? (
                            <p className="text-sm text-ink-muted">
                                No non-working days selected.
                            </p>
                        ) : (
                            <ul className="flex flex-wrap gap-2">
                                {closedDates.map((iso) => (
                                    <li key={iso}>
                                        <button
                                            type="button"
                                            onClick={() => removeClosedDate(iso)}
                                            className={cn(
                                                "inline-flex items-center gap-1.5 rounded-full",
                                                "border border-brand/30 bg-brand/5 px-3 py-1",
                                                "text-sm text-brand transition-colors hover:bg-brand/10",
                                            )}
                                            aria-label={`Remove ${formatChipDate(iso)}`}
                                        >
                                            {formatChipDate(iso)}
                                            <span aria-hidden className="text-base leading-none">
                                                ×
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>

            {state.ok === false && state.error && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            )}
            {state.ok === true && (
                <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    Saved.
                </p>
            )}

            <div className="flex justify-end">
                <Button type="submit" disabled={pending}>
                    {pending ? "Saving…" : "Save changes"}
                </Button>
            </div>
        </form>
    );
}
