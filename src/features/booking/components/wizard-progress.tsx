"use client";

import { ORDERED_STEPS, type WizardStep } from "../lib/booking-state";
import { useT } from "@/features/i18n/language-provider";
import { cn } from "@/lib/utils";

interface WizardProgressProps {
  currentStep: WizardStep;
  // The steps to display. Defaults to all ordered steps; callers can omit
  // steps that are skipped (e.g. "location" when there's a single location).
  steps?: WizardStep[];
}

export function WizardProgress({ currentStep, steps }: WizardProgressProps) {
  const t = useT();
  if (currentStep === "success") return null;

  const stepList = steps ?? ORDERED_STEPS;

  const labelFor = (step: WizardStep): string => {
    switch (step) {
      case "location":
        return t.progress.location;
      case "services":
        return t.progress.services;
      case "datetime":
        return t.progress.datetime;
      case "contact":
        return t.progress.contact;
      default:
        return "";
    }
  };

  const currentIndex = stepList.indexOf(
    currentStep === "submitting" ? "contact" : currentStep,
  );

  return (
    <ol className="flex items-center gap-3" aria-label={t.progress.aria}>
      {stepList.map((step, idx) => {
        const isDone = idx < currentIndex;
        const isCurrent = idx === currentIndex;
        return (
          <li key={step} className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                isDone && "bg-brand text-white",
                isCurrent &&
                  "bg-brand text-white shadow-[0_0_7px_3px_color-mix(in_srgb,var(--color-brand)_45%,transparent)]",
                !isDone && !isCurrent && "bg-surface-muted text-ink-muted",
              )}
              aria-current={isCurrent ? "step" : undefined}
            >
              {isDone ? "✓" : idx + 1}
            </span>
            <span
              className={cn(
                "hidden text-sm sm:block",
                isCurrent ? "font-medium text-ink" : "text-ink-muted",
              )}
            >
              {labelFor(step)}
            </span>
            {idx < stepList.length - 1 && (
              <span
                className={cn(
                  "h-px w-6 sm:w-10",
                  isDone ? "bg-brand" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
