"use client";

import "./chart-setup";
import { Bar } from "react-chartjs-2";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/features/booking/lib/money";
import { useChartColors } from "./use-chart-colors";

interface TopServicesChartProps {
  services: { name: string; count: number; revenue: number }[];
}

const TICK_MAX_CHARS = 18;

// Top 5 most-booked services as a horizontal bar chart; the tooltip carries
// the full service name plus its revenue.
export function TopServicesChart({ services }: TopServicesChartProps) {
  const colors = useChartColors();
  if (!colors) return <Skeleton className="h-full w-full" />;

  return (
    <Bar
      data={{
        labels: services.map((s) => s.name),
        datasets: [
          {
            data: services.map((s) => s.count),
            backgroundColor: colors.brand,
            borderRadius: 4,
            maxBarThickness: 24,
          },
        ],
      }}
      options={{
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            displayColors: false,
            callbacks: {
              label: (ctx) =>
                `${ctx.parsed.x} booking${ctx.parsed.x === 1 ? "" : "s"}`,
              afterLabel: (ctx) =>
                `Revenue: ${formatPrice(services[ctx.dataIndex]?.revenue ?? 0)}`,
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: colors.border },
            border: { display: false },
            ticks: { color: colors.inkMuted, precision: 0 },
          },
          y: {
            grid: { display: false },
            border: { color: colors.border },
            ticks: {
              color: colors.inkMuted,
              callback(value) {
                const label = this.getLabelForValue(Number(value));
                return label.length > TICK_MAX_CHARS
                  ? `${label.slice(0, TICK_MAX_CHARS - 1)}…`
                  : label;
              },
            },
          },
        },
      }}
    />
  );
}
