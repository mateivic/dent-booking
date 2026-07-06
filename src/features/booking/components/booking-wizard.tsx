"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTenant } from "@/features/tenant-theme/theme-provider";
import { useT } from "@/features/i18n/language-provider";
import { LanguageSwitcher } from "@/features/i18n/language-switcher";
import { useBookingWizard } from "../hooks/use-booking-wizard";
import { ORDERED_STEPS, type WizardStep } from "../lib/booking-state";
import { LocationStep } from "./steps/location-step";
import { ServicesStep } from "./steps/services-step";
import { DateTimeStep } from "./steps/datetime-step";
import { ContactStep } from "./steps/contact-step";
import { SuccessStep } from "./steps/success-step";
import { SubmittingStep } from "./steps/submitting-step";
import { IntroStep } from "./steps/intro-step";
import { WizardProgress } from "./wizard-progress";
import { WizardNav } from "./wizard-nav";
import { getTenantLogoUrl } from "@/lib/supabase/storage";

export function BookingWizard() {
  const { tenant, locations, categories, services } = useTenant();
  const { state, dispatch, slotsQuery, canProceed, submit, reset } =
    useBookingWizard();
  const t = useT();

  // Track travel direction so sections slide forward (in from the right, out to
  // the left) and reverse on Back. Uses React's "adjust state during render"
  // pattern (render-safe) rather than reading a ref during render. Hooks run
  // before any early return.
  const reduceMotion = useReducedMotion();
  const logoUrl = getTenantLogoUrl(tenant.logo_path);
  const [prevStep, setPrevStep] = useState<WizardStep>(state.step);
  const [direction, setDirection] = useState(1);
  if (prevStep !== state.step) {
    const fromIdx = ORDERED_STEPS.indexOf(prevStep);
    const toIdx = ORDERED_STEPS.indexOf(state.step);
    setDirection(toIdx >= fromIdx ? 1 : -1);
    setPrevStep(state.step);
  }

  const stepVariants = {
    enter: (dir: number) => ({
      x: reduceMotion ? 0 : dir > 0 ? 40 : -40,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({
      x: reduceMotion ? 0 : dir > 0 ? -40 : 40,
      opacity: 0,
    }),
  };

  // Scroll back to the top whenever the step changes (forward or back) so a
  // taller section doesn't leave the user mid-page on the next one.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }, [state.step, reduceMotion]);

  if (state.step === "intro") {
    // With a single (preselected) location, skip the location step entirely so
    // there's no flash of it auto-advancing.
    return (
      <IntroStep
        onStart={() =>
          dispatch(
            locations.length === 1
              ? { type: "GOTO_STEP", step: "services" }
              : { type: "START" },
          )
        }
      />
    );
  }

  if (locations.length === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 text-center">
        <h1 className="text-2xl font-semibold">{tenant.name}</h1>
        <p className="mt-3 text-ink-muted">{t.wizard.noLocations}</p>
      </main>
    );
  }

  if (state.step === "success" && state.result) {
    return (
      <main className="mx-auto w-full max-w-2xl flex flex-col flex-1 px-6 py-12">
        <SuccessStep result={state.result} onStartOver={reset} />
      </main>
    );
  }

  if (state.step === "submitting") {
    return (
      <main className="mx-auto w-full max-w-2xl flex flex-col flex-1 px-6 py-12">
        <SubmittingStep />
      </main>
    );
  }

  const location = state.locationId
    ? locations.find((l) => l.id === state.locationId)
    : null;

  // A single location is preselected and its step is skipped, so the effective
  // first navigable step is "services". Reflect that in the progress bar and
  // the Back button so Back doesn't bounce off the auto-advancing location step.
  const singleLocation = locations.length === 1;
  const progressSteps = singleLocation
    ? ORDERED_STEPS.filter((s) => s !== "location")
    : ORDERED_STEPS;
  const firstStepIndex = singleLocation ? 1 : 0;
  const isFirstStep = ORDERED_STEPS.indexOf(state.step) <= firstStepIndex;

  return (
    <main className="relative mx-auto w-full max-w-2xl flex-1 px-6 pt-10">
      <LanguageSwitcher className="absolute right-6 top-6 text-ink-muted" />
      <header className="mb-6 mt-8 md:mt-16 text-center flex justify-center">
        {logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={logoUrl}
            alt={tenant.name}
            className="h-22 w-auto object-contain animate-fade-up motion-reduce:animate-none"
          />
        ) : (
          <h1 className="font-display text-3xl font-medium tracking-tight">
            {t.wizard.title(tenant.name)}
          </h1>
        )}
      </header>

      <div className="mb-8 flex justify-center">
        <WizardProgress currentStep={state.step} steps={progressSteps} />
      </div>

      {/* overflow-x-clip contains the ±40px step slide. The px-2/-mx-2 pair adds
          clip breathing room (padding sits inside the clip edge) so input focus
          rings aren't shaved, while the slide is still clipped and stays aligned. */}
      <section className="relative overflow-x-clip px-2 -mx-2">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={state.step}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="space-y-6"
          >
            {state.step === "location" && (
              <LocationStep
                state={state}
                dispatch={dispatch}
                locations={locations}
              />
            )}

            {state.step === "services" && location && (
              <ServicesStep
                state={state}
                dispatch={dispatch}
                categories={categories.filter(
                  (c) => c.location_id === location.id,
                )}
                services={services.filter((s) => s.location_id === location.id)}
              />
            )}

            {state.step === "datetime" && location && (
              <DateTimeStep
                state={state}
                dispatch={dispatch}
                location={location}
                slotsQuery={slotsQuery}
              />
            )}

            {state.step === "contact" && location && (
              <ContactStep
                state={state}
                dispatch={dispatch}
                location={location}
                services={services.filter((s) => s.location_id === location.id)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </section>

      {/* Direct child of <main> so sticky can travel its full height: sits in
          flow when the step fits the viewport, pins to the bottom edge when it
          overflows. -mx-6/px-6 counter main's gutter (full-bleed on mobile);
          pb calc absorbs the iOS home-indicator inset (0 in a browser tab). */}
      <div className="sticky bottom-0 z-10 -mx-6 mt-8  bg-surface/95 px-6 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <WizardNav
          currentStep={state.step}
          canProceed={canProceed}
          isFirst={isFirstStep}
          onBack={() => dispatch({ type: "BACK" })}
          onNext={() => dispatch({ type: "NEXT" })}
          onSubmit={submit}
          submitting={false}
        />
      </div>
    </main>
  );
}
