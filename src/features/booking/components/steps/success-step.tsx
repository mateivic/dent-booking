"use client";

import { Button } from "@/components/ui/button";
import { useTenant } from "@/features/tenant-theme/theme-provider";
import { useT } from "@/features/i18n/language-provider";
import { getTenantLogoUrl } from "@/lib/supabase/storage";
import type { BookingResult } from "../../lib/booking-state";

interface SuccessStepProps {
  result: BookingResult;
  onStartOver: () => void;
}

export function SuccessStep({ onStartOver }: SuccessStepProps) {
  const { tenant } = useTenant();
  const t = useT();
  const logoUrl = getTenantLogoUrl(tenant.logo_path);

  return (
    <div className="flex flex-1 flex-col justify-center items-center gap-8 text-center">
      {logoUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={logoUrl}
          alt={tenant.name}
          className="absolute top-10 left-1/2 transform -translate-x-1/2 h-18 w-auto object-contain animate-fade-up motion-reduce:animate-none"
        />
      )}

      <span className="flex size-20 items-center justify-center rounded-full bg-brand/10 text-brand animate-pop-in motion-reduce:animate-none">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-10"
          aria-hidden="true"
        >
          <path
            d="M5 13l4 4L19 7"
            strokeDasharray={24}
            className="animate-draw-check motion-reduce:animate-none"
          />
        </svg>
      </span>

      <div
        className="space-y-2 animate-fade-up motion-reduce:animate-none font-display"
        style={{ animationDelay: "120ms" }}
      >
        <h2 className="text-3xl font-medium tracking-tight">
          {t.success.heading}
        </h2>
        <p className="max-w-sm text-ink-muted">{t.success.message}</p>
      </div>

      <div
        className="pt-2 animate-fade-up motion-reduce:animate-none font-display"
        style={{ animationDelay: "240ms" }}
      >
        <Button variant="secondary" onClick={onStartOver}>
          {t.success.again}
        </Button>
      </div>
    </div>
  );
}
