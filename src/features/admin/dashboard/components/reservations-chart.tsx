"use client";

import "./chart-setup";
import { Bar } from "react-chartjs-2";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/features/booking/lib/money";
import { useChartColors } from "./use-chart-colors";

interface ReservationsChartProps {
  labels: string[];
  counts: number[];
  revenues: number[];
}

// Reservation counts per period bucket. Revenue rides along in the tooltip —
// a second value axis is deliberately avoided (one axis per chart).
export function ReservationsChart({
  labels,
  counts,
  revenues,
}: ReservationsChartProps) {
  const colors = useChartColors();
  if (!colors) return <Skeleton className="h-full w-full" />;

  return (
    <Bar
      data={{
        labels,
        datasets: [
          {
            data: counts,
            backgroundColor: colors.brand,
            borderRadius: 4,
            maxBarThickness: 32,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            displayColors: false,
            callbacks: {
              label: (ctx) =>
                `${ctx.parsed.y} reservation${ctx.parsed.y === 1 ? "" : "s"}`,
              afterLabel: (ctx) =>
                `Revenue: ${formatPrice(revenues[ctx.dataIndex] ?? 0)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: colors.border },
            ticks: {
              color: colors.inkMuted,
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 16,
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: colors.border },
            border: { display: false },
            ticks: { color: colors.inkMuted, precision: 0 },
          },
        },
      }}
    />
  );
}
