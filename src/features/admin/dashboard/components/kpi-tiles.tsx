import { Card } from "@/components/ui/card";
import { formatPrice } from "@/features/booking/lib/money";
import type { DashboardKpis } from "../types";

interface KpiTilesProps {
  kpis: DashboardKpis;
}

export function KpiTiles({ kpis }: KpiTilesProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      <Tile
        label="Reservations"
        value={String(kpis.reservationCount)}
        sub={`${kpis.cancelledCount} cancelled`}
      />
      <Tile label="Revenue" value={formatPrice(kpis.revenue)} />
      <Tile
        label="Top client"
        value={kpis.topClient?.name ?? "—"}
        sub={
          kpis.topClient
            ? `${kpis.topClient.count} reservation${kpis.topClient.count === 1 ? "" : "s"}`
            : undefined
        }
      />
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-sm text-ink-muted">{label}</p>
      <p
        className="mt-1 truncate text-2xl font-semibold text-ink"
        title={value}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-ink-muted">{sub}</p> : null}
    </Card>
  );
}
