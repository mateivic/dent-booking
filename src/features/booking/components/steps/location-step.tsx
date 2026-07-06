"use client";

import type { Dispatch } from "react";
import Image from "next/image";
import type { Location } from "@/lib/supabase/types";
import type { BookingAction, BookingState } from "../../lib/booking-state";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getLocationImageUrl } from "@/lib/supabase/storage";
import { useT } from "@/features/i18n/language-provider";

interface LocationStepProps {
  state: BookingState;
  dispatch: Dispatch<BookingAction>;
  locations: Location[];
}

export function LocationStep({
  state,
  dispatch,
  locations,
}: LocationStepProps) {
  const t = useT();
  return (
    <div className="space-y-3">
      <h2 className="font-display text-2xl font-medium tracking-tight">
        {t.location.heading}
      </h2>
      <div className="grid gap-3">
        {locations.map((loc) => {
          const selected = state.locationId === loc.id;
          const imageUrl = getLocationImageUrl(loc.image_path);
          return (
            <button
              key={loc.id}
              type="button"
              onClick={() =>
                dispatch({ type: "SET_LOCATION", locationId: loc.id })
              }
              className="text-left"
            >
              <Card
                className={cn(
                  "overflow-hidden p-0 transition-colors",
                  selected
                    ? "border-brand ring-2 ring-brand"
                    : "hover:border-brand",
                )}
              >
                {imageUrl && (
                  <div className="relative aspect-video w-full bg-muted">
                    <Image
                      src={imageUrl}
                      alt={loc.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 640px"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="p-4 font-display">
                  <h3 className="text-lg font-semibold">{loc.name}</h3>
                  {loc.address && (
                    <p className="mt-1 text-sm text-ink-muted">{loc.address}</p>
                  )}
                </div>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}
