"use client";

import type { Dispatch } from "react";
import type { Service, ServiceCategory } from "@/lib/supabase/types";
import type { BookingAction, BookingState } from "../../lib/booking-state";
import { formatDuration, sumDurations } from "../../lib/duration";
import { formatPrice } from "../../lib/money";
import { cn } from "@/lib/utils";
import { useT, useLanguage } from "@/features/i18n/language-provider";
import { useTenant } from "@/features/tenant-theme/theme-provider";

interface ServicesStepProps {
  state: BookingState;
  dispatch: Dispatch<BookingAction>;
  categories: ServiceCategory[];
  services: Service[];
}

export function ServicesStep({
  state,
  dispatch,
  categories,
  services,
}: ServicesStepProps) {
  const t = useT();
  const { tenant } = useTenant();
  const { language } = useLanguage();
  const showPrices = tenant.config.showPrices ?? true;
  // Exact-language match only — no fallback. Absent/blank for the current
  // language means no note renders.
  const servicesNote = tenant.config.servicesNote?.[language]?.trim();
  function toggle(id: string) {
    const next = state.serviceIds.includes(id)
      ? state.serviceIds.filter((sid) => sid !== id)
      : [...state.serviceIds, id];
    dispatch({ type: "SET_SERVICES", serviceIds: next });
  }

  const selected = services.filter((s) => state.serviceIds.includes(s.id));
  const totalMin = sumDurations(selected);

  const sortedCategories = [...categories].sort(
    (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-4 font-display">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-medium tracking-tight">
          {t.services.heading}
        </h2>
        {totalMin > 0 && (
          <span className="text-sm text-ink-muted">
            {t.services.total(formatDuration(totalMin))}
          </span>
        )}
      </div>

      {servicesNote && (
        <p className="whitespace-pre-line rounded-lg border-l-2 border-brand bg-surface-muted px-4 py-3 text-sm text-ink-muted">
          {servicesNote}
        </p>
      )}

      {sortedCategories.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-ink-muted">
          {t.services.none}
        </p>
      ) : (
        <div className="space-y-5">
          {sortedCategories.map((category) => {
            const categoryServices = services
              .filter((s) => s.category_id === category.id)
              .sort(
                (a, b) =>
                  a.display_order - b.display_order ||
                  a.name.localeCompare(b.name),
              );
            if (categoryServices.length === 0) return null;

            return (
              <section key={category.id} className="space-y-2">
                <header>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                    {category.name}
                  </h3>
                  {category.description && (
                    <p className="text-xs text-ink-muted">
                      {category.description}
                    </p>
                  )}
                </header>
                <div className="grid gap-2">
                  {categoryServices.map((svc) => {
                    const isSelected = state.serviceIds.includes(svc.id);
                    return (
                      <label
                        key={svc.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition duration-200",
                          "hover:-translate-y-px hover:shadow-sm motion-reduce:transform-none",
                          isSelected
                            ? "border-brand bg-surface-muted ring-1 ring-brand/30"
                            : "border-border hover:border-brand",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(svc.id)}
                          className="mt-1 accent-brand"
                        />
                        <div className="flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="font-medium">{svc.name}</span>
                            <span className="flex shrink-0 items-baseline gap-2 text-sm text-ink-muted">
                              <span>
                                {formatDuration(svc.duration_minutes)}
                              </span>
                              {showPrices && (
                                <span className="font-medium text-ink">
                                  {svc.price === 0
                                    ? t.services.free
                                    : formatPrice(svc.price)}
                                </span>
                              )}
                            </span>
                          </div>
                          {svc.description && (
                            <p className="mt-1 text-sm text-ink-muted">
                              {svc.description}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
