// "Floating" local ISO strings (no UTC offset) for FullCalendar. Events are
// pre-converted to the display timezone on the server, so the calendar itself
// does zero timezone math and needs no timezone plugin. Pure Intl — safe to
// import from client code too (the now-indicator uses it in the browser).

export function toFloatingIso(utcIso: string, timezone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(utcIso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

// Wall-clock "now" in `timezone` as a floating ISO string.
export function floatingNowIso(timezone: string): string {
  return toFloatingIso(new Date().toISOString(), timezone);
}
