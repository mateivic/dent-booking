"use client";

import { useEffect, useState } from "react";

export interface ChartColors {
  brand: string;
  ink: string;
  inkMuted: string;
  border: string;
}

// Chart.js needs concrete color strings, so read the resolved theme tokens off
// :root after mount (ThemeProvider sets the tenant overrides client-side; the
// rAF tick keeps us behind its effect). Fallbacks mirror globals.css.
export function useChartColors(): ChartColors | null {
  const [colors, setColors] = useState<ChartColors | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const styles = getComputedStyle(document.documentElement);
      const read = (name: string, fallback: string) =>
        styles.getPropertyValue(name).trim() || fallback;
      setColors({
        brand: read("--color-brand", "#2563eb"),
        ink: read("--color-ink", "#0f172a"),
        inkMuted: read("--color-ink-muted", "#64748b"),
        border: read("--color-border", "#e2e8f0"),
      });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return colors;
}
