// Day-before reminder content. The email reuses the shared branded base
// (`renderBrandedEmail`); the SMS is a short Croatian one-liner. Strings are
// Croatian to match the booking UI and the other emails.

import {
  renderBrandedEmail,
  type BrandedEmailButton,
} from "@/features/booking/lib/email-templates";

export interface ClientReminderInput {
  tenantName: string;
  heroUrl: string | null;
  logoUrl: string | null;
  primaryColor?: string | null;
  clientName: string;
  locationName: string;
  locationAddress: string | null;
  locationPhone: string | null;
  website: string | null;
  socials: Record<string, string>;
  serviceNames: string[];
  startIso: string;
  timezone: string;
  cancelUrl: string;
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function reminderDateParts(iso: string, timezone: string) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("hr-HR", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
  const weekday = new Intl.DateTimeFormat("hr-HR", {
    timeZone: timezone,
    weekday: "long",
  }).format(d);
  const time = new Intl.DateTimeFormat("hr-HR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return { date, weekday: capitalizeFirst(weekday), time };
}

export function renderClientReminder(input: ClientReminderInput): string {
  const { time } = reminderDateParts(input.startIso, input.timezone);
  const buttons: BrandedEmailButton[] = [
    { label: "Otkaži termin", url: input.cancelUrl, variant: "secondary" },
  ];
  return renderBrandedEmail({
    tenantName: input.tenantName,
    heroUrl: input.heroUrl,
    logoUrl: input.logoUrl,
    primaryColor: input.primaryColor,
    greetingName: input.clientName,
    message:
      "podsjećamo Vas na Vaš termin sutra u " +
      time +
      "h. Veselimo se Vašem dolasku!",
    details: [
      {
        label: "Lokacija",
        value: input.locationName,
        sub: input.locationAddress ?? undefined,
      },
      { label: "Usluge", value: input.serviceNames.join(", ") },
    ],
    buttons,
    napomena:
      'Ako ne možete doći, molimo Vas da otkažete termin putem gumba „Otkaži termin".<br/>Molimo dođite nekoliko minuta ranije.',
    locationAddress: input.locationAddress,
    locationPhone: input.locationPhone,
    website: input.website,
    socials: input.socials,
  });
}

export interface ReminderSmsInput {
  tenantName: string;
  locationAddress: string;
  startIso: string;
  timezone: string;
}

// GSM-7 (the cheap SMS alphabet) has no Croatian letters. A single č/ć/ž/đ/š
// forces the whole message into UCS-2, which halves the per-segment length
// (70 vs 160) and can double the price. Fold the Croatian-specific letters to
// ASCII so reminder texts stay single-segment GSM-7. (Emails are UTF-8 and keep
// the proper characters.)
const CROATIAN_TO_ASCII: Record<string, string> = {
  č: "c",
  ć: "c",
  ž: "z",
  đ: "d",
  š: "s",
  Č: "C",
  Ć: "C",
  Ž: "Z",
  Đ: "D",
  Š: "S",
};

function toGsmSafe(s: string): string {
  return s.replace(/[čćžđšČĆŽĐŠ]/g, (ch) => CROATIAN_TO_ASCII[ch] ?? ch);
}

export function buildReminderSms(input: ReminderSmsInput): string {
  const { date, time } = reminderDateParts(input.startIso, input.timezone);
  const message = `Podsjetnik: termin u ${input.tenantName} sutra ${date} u ${time}h. Lokacija: ${input.locationAddress}. Veselimo se Vasem dolasku!`;
  return toGsmSafe(message);
}
