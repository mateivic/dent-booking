// Single source of truth for timezone math used across the booking flow.
// Pure functions relying only on `Intl` (no date library), safe to import from
// both client and server code. All "wall-clock" values use the location's
// timezone; weekday codes are lowercase 3-letter English ("mon".."sun").

export interface LocalTimeParts {
  weekday: string;
  minutes: number; // minutes since local midnight
}

// Wall-clock weekday + minutes for an instant, as seen in `timezone`.
export function localTimeInZone(date: Date, timezone: string): LocalTimeParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const weekday = (parts.find((p) => p.type === "weekday")?.value ?? "")
    .toLowerCase()
    .slice(0, 3);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return { weekday, minutes: hour * 60 + minute };
}

// Lowercase 3-letter weekday code for a YYYY-MM-DD date in `timezone`.
export function weekdayKey(dateStr: string, timezone: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "short" })
    .format(d)
    .toLowerCase()
    .slice(0, 3);
}

// Offset (ms) between `timezone` wall-clock and UTC at the given instant.
// DST-aware because Intl resolves the zone at that moment.
export function tzOffsetMs(utcDate: Date, timezone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(utcDate)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - utcDate.getTime();
}

// A local wall-clock (dateStr + HH:MM in `timezone`) as a UTC Date.
export function zonedToUtc(dateStr: string, hhmm: string, timezone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = hhmm.split(":").map(Number);
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute);
  return new Date(targetUtc - tzOffsetMs(new Date(targetUtc), timezone));
}

export function localHHMMToUtcIso(
  dateStr: string,
  hhmm: string,
  timezone: string,
): string {
  return zonedToUtc(dateStr, hhmm, timezone).toISOString();
}

// HH:MM (24h) wall-clock of an instant in `timezone`.
export function formatHHMM(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

// Calendar date (YYYY-MM-DD) of an instant, as seen in `timezone`.
export function dateIsoInZone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return `${year}-${month}-${day}`;
}

// Today's date as YYYY-MM-DD in `timezone`.
export function todayIsoInZone(timezone: string): string {
  return dateIsoInZone(new Date(), timezone);
}

// Add `days` calendar days to a YYYY-MM-DD string (returns YYYY-MM-DD).
export function addDaysIso(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
