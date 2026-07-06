"use client";

import { useState, type Dispatch } from "react";
import type { Location, Service } from "@/lib/supabase/types";
import {
  validateContact,
  type BookingAction,
  type BookingState,
  type ContactField,
} from "../../lib/booking-state";
import { DEFAULT_PHONE_COUNTRY } from "../../lib/countries";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { PhoneField } from "../phone-field";
import {
  formatDuration,
  formatLocalDateTime,
  sumDurations,
} from "../../lib/duration";
import { formatPrice, sumPrices } from "../../lib/money";
import { useT } from "@/features/i18n/language-provider";
import { useTenant } from "@/features/tenant-theme/theme-provider";
import type { ValidationCode } from "@/features/i18n/dictionaries/dictionary";

interface ContactStepProps {
  state: BookingState;
  dispatch: Dispatch<BookingAction>;
  location: Location;
  services: Service[];
}

export function ContactStep({
  state,
  dispatch,
  location,
  services,
}: ContactStepProps) {
  const t = useT();
  const { tenant } = useTenant();
  const showPrices = tenant.config.showPrices ?? true;
  const selectedServices = services.filter((s) =>
    state.serviceIds.includes(s.id),
  );
  const errors = validateContact(state.client);
  const [touched, setTouched] = useState<
    Partial<Record<ContactField, boolean>>
  >({});

  function patch<K extends keyof BookingState["client"]>(
    key: K,
    value: BookingState["client"][K],
  ) {
    dispatch({ type: "PATCH_CLIENT", patch: { [key]: value } });
  }

  function markTouched(field: ContactField) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  function errorFor(field: ContactField): string | null {
    const code = errors[field];
    if (!code || !touched[field]) return null;
    return t.validation[code as ValidationCode];
  }

  return (
    <div className="space-y-4 font-display">
      <h2 className="text-2xl font-medium tracking-tight">
        {t.contact.heading}
      </h2>

      <Card className="bg-surface-muted">
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-ink-muted">{t.contact.locationLabel}</span>
            {location.name}
          </p>
          {state.startIso && (
            <p>
              <span className="text-ink-muted">{t.contact.whenLabel}</span>
              {formatLocalDateTime(state.startIso, location.timezone)}
            </p>
          )}
          <p>
            <span className="text-ink-muted">{t.contact.servicesLabel}</span>
            {selectedServices.map((s) => s.name).join(", ")} ·{" "}
            {formatDuration(sumDurations(selectedServices))}
          </p>
          {showPrices && (
            <p className="font-medium">
              {t.contact.totalLabel(formatPrice(sumPrices(selectedServices)))}
            </p>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="firstName">{t.contact.firstName}</Label>
          <Input
            id="firstName"
            autoComplete="given-name"
            value={state.client.firstName}
            onChange={(e) => patch("firstName", e.target.value)}
            onBlur={() => markTouched("firstName")}
            aria-invalid={Boolean(errorFor("firstName"))}
          />
          <FieldError message={errorFor("firstName")} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="lastName">{t.contact.lastName}</Label>
          <Input
            id="lastName"
            autoComplete="family-name"
            value={state.client.lastName}
            onChange={(e) => patch("lastName", e.target.value)}
            onBlur={() => markTouched("lastName")}
            aria-invalid={Boolean(errorFor("lastName"))}
          />
          <FieldError message={errorFor("lastName")} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">{t.contact.email}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={state.client.email}
          onChange={(e) => patch("email", e.target.value)}
          onBlur={() => markTouched("email")}
          aria-invalid={Boolean(errorFor("email"))}
        />
        <FieldError message={errorFor("email")} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="phone">{t.contact.phone}</Label>
        <PhoneField
          id="phone"
          country={state.client.phoneCountry ?? DEFAULT_PHONE_COUNTRY}
          number={state.client.phone}
          onCountryChange={(iso) => patch("phoneCountry", iso)}
          onNumberChange={(value) => patch("phone", value)}
          onBlur={() => markTouched("phone")}
          invalid={Boolean(errorFor("phone"))}
        />
        <FieldError message={errorFor("phone")} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="notes">{t.contact.notes}</Label>
        <Input
          id="notes"
          value={state.client.notes}
          onChange={(e) => patch("notes", e.target.value)}
        />
      </div>

      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
    </div>
  );
}

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-xs text-red-600">{message}</p>;
}
