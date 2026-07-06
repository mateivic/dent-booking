"use client";

import { Button } from "@/components/ui/button";
import { useT } from "@/features/i18n/language-provider";
import { ORDERED_STEPS, type WizardStep } from "../lib/booking-state";

interface WizardNavProps {
  currentStep: WizardStep;
  canProceed: boolean;
  // Whether this is the first navigable step (Back is disabled). Passed in
  // because the effective first step depends on context — e.g. the location
  // step is skipped when the tenant has a single location.
  isFirst: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  submitting: boolean;
}

export function WizardNav({
  currentStep,
  canProceed,
  isFirst,
  onBack,
  onNext,
  onSubmit,
  submitting,
}: WizardNavProps) {
  const t = useT();
  if (currentStep === "success" || currentStep === "submitting") return null;

  const idx = ORDERED_STEPS.indexOf(currentStep);
  const isLast = idx === ORDERED_STEPS.length - 1;

  return (
    <div className="flex items-center justify-between gap-3 pt-2 font-display">
      <Button type="button" variant="ghost" onClick={onBack} disabled={isFirst}>
        ← {t.nav.back}
      </Button>
      {isLast ? (
        <Button
          type="button"
          onClick={onSubmit}
          disabled={!canProceed || submitting}
        >
          {submitting ? t.nav.submitting : t.nav.confirm}
        </Button>
      ) : (
        <Button type="button" onClick={onNext} disabled={!canProceed}>
          {t.nav.continue} →
        </Button>
      )}
    </div>
  );
}
