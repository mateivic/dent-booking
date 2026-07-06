// HTML render functions for booking emails. The client-facing emails share one
// branded base (`renderBrandedEmail`); each is a thin composition of content.
// Strings are Croatian to match the booking UI.

export interface ClientConfirmationInput {
  tenantName: string;
  heroUrl: string | null;
  logoUrl: string | null;
  primaryColor?: string | null;
  clientName: string;
  locationName: string;
  locationContactEmail: string | null;
  locationAddress: string | null;
  locationPhone: string | null;
  website: string | null;
  socials: Record<string, string>;
  serviceNames: string[];
  startIso: string;
  timezone: string;
  cancelUrl: string;
  addToCalendarUrl: string;
}

export interface ClinicNotificationInput {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  locationName: string;
  serviceNames: string[];
  startIso: string;
  timezone: string;
  notes?: string;
}

export interface ClientCancellationInput {
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
  rebookUrl: string;
}

function formatLocal(iso: string, timezone: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("hr-HR", {
    timeZone: timezone,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Split a timestamp into the localized date / weekday / time pieces the
// branded email lays out separately.
function formatDateParts(iso: string, timezone: string) {
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

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  twitter: "X",
  x: "X",
  whatsapp: "WhatsApp",
};

function socialLabel(key: string): string {
  return SOCIAL_LABELS[key.toLowerCase()] ?? capitalizeFirst(key);
}

// Tenant-entered links may omit the scheme ("instagram.com/x"); make them
// absolute so the email's anchors resolve.
function normalizeUrl(u: string): string {
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

// ---------------------------------------------------------------------------
// Shared branded base — used by every client-facing email. `message` and
// `napomena` are trusted (developer-authored) and may contain limited HTML;
// all user/tenant-sourced values are escaped here.
// ---------------------------------------------------------------------------

export interface BrandedEmailButton {
  label: string;
  url: string;
  variant?: "primary" | "secondary";
}

export interface BrandedEmailDetail {
  label: string;
  value: string;
  sub?: string;
}

export interface BrandedEmailInput {
  tenantName: string;
  heroUrl: string | null;
  logoUrl: string | null;
  primaryColor?: string | null;
  greetingName: string;
  message: string;
  details: BrandedEmailDetail[];
  buttons?: BrandedEmailButton[];
  napomena?: string | null;
  locationAddress?: string | null;
  locationPhone?: string | null;
  website?: string | null;
  socials?: Record<string, string>;
}

export function renderBrandedEmail(input: BrandedEmailInput): string {
  const bg = "#ffffff";
  const text = "#1a1a1a";
  const muted = "#6b7280";
  const border = "#e5e7eb";
  const boxBg = "#f8fafc";
  // Primary buttons mirror the app's main button: tenant brand color, falling
  // back to the same `--tenant-primary` default the booking UI uses.
  const primary = input.primaryColor || "#2563eb";
  const primaryText = "#ffffff";

  const heroBlock = input.heroUrl
    ? `<tr><td style="padding:0;"><img src="${escapeHtml(input.heroUrl)}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" /></td></tr>`
    : "";

  const logoBlock = input.logoUrl
    ? `<img src="${escapeHtml(input.logoUrl)}" alt="${escapeHtml(input.tenantName)}" height="56" style="display:block;height:56px;width:auto;border:0;margin:0 0 20px;" />`
    : `<div style="font-size:22px;font-weight:600;margin:0 0 20px;color:${text};">${escapeHtml(input.tenantName)}</div>`;

  const detailRows = input.details
    .map((d) => {
      const sub = d.sub
        ? `<div style="color:${muted};font-size:13px;font-weight:400;margin-top:2px;">${escapeHtml(d.sub)}</div>`
        : "";
      return `<tr>
        <td style="padding:14px 0;border-bottom:1px solid ${border};color:${muted};font-size:12px;letter-spacing:0.08em;text-transform:uppercase;vertical-align:top;">${escapeHtml(d.label)}</td>
        <td align="right" style="padding:14px 0;border-bottom:1px solid ${border};color:${text};font-size:15px;font-weight:600;">${escapeHtml(d.value)}${sub}</td>
      </tr>`;
    })
    .join("");

  const buttons = input.buttons ?? [];
  const buttonCells = buttons
    .map((b, i) => {
      const isPrimary = (b.variant ?? "primary") === "primary";
      const skin = isPrimary
        ? `background:${primary};color:${primaryText};border:1px solid ${primary};`
        : `background:transparent;color:${text};border:1px solid ${border};`;
      const gap =
        buttons.length > 1
          ? i === 0
            ? "padding-right:6px;"
            : i === buttons.length - 1
              ? "padding-left:6px;"
              : "padding:0 3px;"
          : "";
      const width = `${Math.floor(100 / buttons.length)}%`;
      return `<td width="${width}" style="${gap}"><a href="${escapeHtml(b.url)}" style="display:block;text-align:center;${skin}text-decoration:none;font-size:14px;font-weight:600;padding:14px 0;border-radius:8px;">${escapeHtml(b.label)}</a></td>`;
    })
    .join("");
  const buttonsBlock = buttons.length
    ? `<tr><td style="padding:20px 24px 4px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0;"><tr>${buttonCells}</tr></table></td></tr>`
    : "";

  const napomenaBlock = input.napomena
    ? `<tr><td style="padding:0 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${boxBg};border:1px solid ${border};border-radius:10px;margin:20px 0;"><tr><td style="padding:18px 20px;">
      <div style="color:${muted};font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px;">Napomena</div>
      <div style="color:${text};font-size:14px;line-height:1.7;">${input.napomena}</div>
    </td></tr></table></td></tr>`
    : "";

  const links = [
    ...Object.entries(input.socials ?? {})
      .filter(([, url]) => Boolean(url))
      .map(([key, url]) => ({
        label: socialLabel(key),
        url: normalizeUrl(url),
      })),
    ...(input.website
      ? [{ label: "Web", url: normalizeUrl(input.website) }]
      : []),
  ];
  const linksHtml = links.length
    ? `<div style="margin-top:14px;">${links
        .map(
          (l) =>
            `<a href="${escapeHtml(l.url)}" style="color:${muted};text-decoration:none;font-size:13px;margin:0 10px;">${escapeHtml(l.label)}</a>`,
        )
        .join("")}</div>`
    : "";

  const footerBlock = `<tr><td align="center" style="padding:28px 24px 36px;border-top:1px solid ${border};">
      ${input.logoUrl ? `<img src="${escapeHtml(input.logoUrl)}" alt="" height="40" style="height:40px;width:auto;border:0;opacity:0.85;margin-bottom:12px;" />` : ""}
      ${input.locationAddress ? `<div style="color:${muted};font-size:13px;">${escapeHtml(input.locationAddress)}</div>` : ""}
      ${input.locationPhone ? `<div style="color:${muted};font-size:13px;margin-top:2px;">${escapeHtml(input.locationPhone)}</div>` : ""}
      ${linksHtml}
    </td></tr>`;

  return `<!doctype html>
<html lang="hr"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:${bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};">
    <tr><td align="center" style="padding:0;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${bg};color:${text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        ${heroBlock}
        <tr><td style="padding:32px 24px 8px;">
          ${logoBlock}
          <div style="font-size:15px;line-height:1.6;color:${text};">Poštovani/a <strong>${escapeHtml(input.greetingName)}</strong>,<br/>${input.message}</div>
        </td></tr>
        <tr><td style="padding:8px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${detailRows}
          </table>
        </td></tr>
        ${buttonsBlock}
        ${napomenaBlock}
        ${footerBlock}
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function renderClientConfirmation(
  input: ClientConfirmationInput,
): string {
  const { date, weekday, time } = formatDateParts(
    input.startIso,
    input.timezone,
  );
  return renderBrandedEmail({
    tenantName: input.tenantName,
    heroUrl: input.heroUrl,
    logoUrl: input.logoUrl,
    primaryColor: input.primaryColor,
    greetingName: input.clientName,
    message: "Vaša rezervacija je potvrđena.",
    details: [
      { label: "Datum", value: date, sub: weekday },
      { label: "Vrijeme", value: time },
      {
        label: "Lokacija",
        value: input.locationName,
        sub: input.locationAddress ?? undefined,
      },
      { label: "Usluge", value: input.serviceNames.join(", ") },
    ],
    buttons: [
      {
        label: "Dodaj u kalendar",
        url: input.addToCalendarUrl,
        variant: "primary",
      },
      { label: "Otkaži", url: input.cancelUrl, variant: "secondary" },
    ],
    napomena:
      'Termin možete otkazati putem gumba „Otkaži" u ovom e-mailu.<br/>Molimo vas da dođete nekoliko minuta ranije.',
    locationAddress: input.locationAddress,
    locationPhone: input.locationPhone,
    website: input.website,
    socials: input.socials,
  });
}

export function renderClinicNotification(
  input: ClinicNotificationInput,
): string {
  const when = formatLocal(input.startIso, input.timezone);
  const services = input.serviceNames.map(escapeHtml).join(", ");
  const notesBlock = input.notes
    ? `<tr><td style="padding: 4px 12px 4px 0; color: #666; vertical-align: top;">Napomena</td><td>${escapeHtml(input.notes)}</td></tr>`
    : "";
  return `<!doctype html>
<html><body style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
  <h2 style="margin: 0 0 16px;">Nova rezervacija</h2>
  <table style="border-collapse: collapse; margin: 16px 0;">
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Klijent</td><td>${escapeHtml(input.clientName)}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Email</td><td>${escapeHtml(input.clientEmail)}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Telefon</td><td>${escapeHtml(input.clientPhone)}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Poslovnica</td><td>${escapeHtml(input.locationName)}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Termin</td><td>${escapeHtml(when)}</td></tr>
    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Usluge</td><td>${services}</td></tr>
    ${notesBlock}
  </table>
</body></html>`;
}

export function renderClientCancellation(
  input: ClientCancellationInput,
): string {
  const { date, weekday, time } = formatDateParts(
    input.startIso,
    input.timezone,
  );
  return renderBrandedEmail({
    tenantName: input.tenantName,
    heroUrl: input.heroUrl,
    logoUrl: input.logoUrl,
    primaryColor: input.primaryColor,
    greetingName: input.clientName,
    message:
      "Otkazali smo Vašu rezervaciju. Žao nam je što ne možete doći i nadamo se da ćemo se uskoro vidjeti. Novi termin možete rezervirati ispod za manje od minute.",
    details: [
      { label: "Datum", value: date, sub: weekday },
      { label: "Vrijeme", value: time },
    ],
    buttons: [
      {
        label: "Rezervirajte novi termin",
        url: input.rebookUrl,
        variant: "primary",
      },
    ],
    locationAddress: input.locationAddress,
    locationPhone: input.locationPhone,
    website: input.website,
    socials: input.socials,
  });
}

export interface ReviewRequestInput {
  tenantName: string;
  heroUrl: string | null;
  logoUrl: string | null;
  primaryColor?: string | null;
  clientName: string;
  locationAddress: string | null;
  locationPhone: string | null;
  website: string | null;
  socials: Record<string, string>;
  startIso: string;
  timezone: string;
  /** External review URL (locations.review_link), e.g. a Google review page. */
  reviewUrl: string;
}

// Admin-triggered "leave a review" email, sent after a finished appointment.
export function renderReviewRequest(input: ReviewRequestInput): string {
  const { date, weekday, time } = formatDateParts(
    input.startIso,
    input.timezone,
  );
  return renderBrandedEmail({
    tenantName: input.tenantName,
    heroUrl: input.heroUrl,
    logoUrl: input.logoUrl,
    primaryColor: input.primaryColor,
    greetingName: input.clientName,
    message: [
      "Bilo nam je istinsko zadovoljstvo ugostiti Vas danas u našoj ordinaciji. Vaše nam povjerenje mnogo znači i trudimo se da se kod nas uvijek osjećate ugodno i zbrinuto.",
      "Vaše nam je mišljenje izuzetno dragocjeno jer nam pomaže da budemo još bolji u onome što radimo. Ako imate trenutak i želite podijeliti svoje dojmove o našem radu, to bi nam puno značilo.",
      "Hvala Vam što ste odabrali baš nas. Stojimo Vam na raspolaganju za sve što trebate.",
    ].join("<br/><br/>"),
    details: [],
    buttons: [
      {
        label: "Ostavite recenziju",
        url: input.reviewUrl,
        variant: "primary",
      },
    ],
    locationAddress: input.locationAddress,
    locationPhone: input.locationPhone,
    website: input.website,
    socials: input.socials,
  });
}
