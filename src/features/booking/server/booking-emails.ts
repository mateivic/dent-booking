import "server-only";
import { sendEmail, type SendEmailResult } from "@/lib/email/send-email";
import { buildSubdomainUrl } from "@/lib/url";
import { getTenantHeroUrl, getTenantLogoUrl } from "@/lib/supabase/storage";
import { buildGoogleCalendarUrl } from "@/features/booking/lib/calendar-link";
import {
  renderClientCancellation,
  renderClientConfirmation,
  renderClinicNotification,
  renderReviewRequest,
} from "@/features/booking/lib/email-templates";

// Booking-specific email orchestration: render the existing templates and hand
// them to the generic transport. Every send is best-effort — these are called
// after the reservation is already persisted (via `after()`), so a mail failure
// must never surface as a booking failure. We log and move on.

export interface BookingConfirmationEmailsArgs {
  subdomain: string;
  tenantName: string;
  tenantLogoPath: string | null;
  tenantHeroPath: string | null;
  primaryColor: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  locationName: string;
  locationContactEmail: string | null;
  locationAddress: string | null;
  locationPhone: string | null;
  website: string | null;
  socials: Record<string, string>;
  serviceNames: string[];
  startIso: string;
  endIso: string;
  timezone: string;
  cancellationToken: string;
  notes?: string;
}

export async function sendBookingConfirmationEmails(
  args: BookingConfirmationEmailsArgs,
): Promise<void> {
  const cancelUrl = buildSubdomainUrl(
    args.subdomain,
    `/cancel/${args.cancellationToken}`,
  );

  const addToCalendarUrl = buildGoogleCalendarUrl({
    title: `${args.tenantName} — ${args.serviceNames.join(", ")}`,
    startIso: args.startIso,
    endIso: args.endIso,
    details: args.serviceNames.join(", "),
    location: args.locationAddress ?? args.locationName,
  });

  const clientHtml = renderClientConfirmation({
    tenantName: args.tenantName,
    heroUrl: getTenantHeroUrl(args.tenantHeroPath),
    logoUrl: getTenantLogoUrl(args.tenantLogoPath),
    primaryColor: args.primaryColor,
    clientName: args.clientName,
    locationName: args.locationName,
    locationContactEmail: args.locationContactEmail,
    locationAddress: args.locationAddress,
    locationPhone: args.locationPhone,
    website: args.website,
    socials: args.socials,
    serviceNames: args.serviceNames,
    startIso: args.startIso,
    timezone: args.timezone,
    cancelUrl,
    addToCalendarUrl,
  });

  const sends: Promise<unknown>[] = [
    sendEmail({
      to: { email: args.clientEmail, name: args.clientName },
      subject: `Potvrda rezervacije – ${args.tenantName}`,
      html: clientHtml,
      senderName: args.tenantName,
    }),
  ];

  if (args.locationContactEmail) {
    const clinicHtml = renderClinicNotification({
      clientName: args.clientName,
      clientEmail: args.clientEmail,
      clientPhone: args.clientPhone,
      locationName: args.locationName,
      serviceNames: args.serviceNames,
      startIso: args.startIso,
      timezone: args.timezone,
      notes: args.notes,
    });
    sends.push(
      sendEmail({
        to: { email: args.locationContactEmail, name: args.locationName },
        subject: `Nova rezervacija – ${args.clientName}`,
        html: clinicHtml,
        senderName: args.tenantName,
      }),
    );
  }

  await Promise.allSettled(sends);
}

export interface BookingCancellationEmailArgs {
  subdomain: string;
  tenantName: string;
  tenantLogoPath: string | null;
  tenantHeroPath: string | null;
  primaryColor: string | null;
  clientName: string;
  clientEmail: string;
  locationName: string;
  locationAddress: string | null;
  locationPhone: string | null;
  website: string | null;
  socials: Record<string, string>;
  serviceNames: string[];
  startIso: string;
  timezone: string;
}

export async function sendBookingCancellationEmail(
  args: BookingCancellationEmailArgs,
): Promise<void> {
  const html = renderClientCancellation({
    tenantName: args.tenantName,
    heroUrl: getTenantHeroUrl(args.tenantHeroPath),
    logoUrl: getTenantLogoUrl(args.tenantLogoPath),
    primaryColor: args.primaryColor,
    clientName: args.clientName,
    locationName: args.locationName,
    locationAddress: args.locationAddress,
    locationPhone: args.locationPhone,
    website: args.website,
    socials: args.socials,
    serviceNames: args.serviceNames,
    startIso: args.startIso,
    timezone: args.timezone,
    rebookUrl: buildSubdomainUrl(args.subdomain, "/"),
  });

  await sendEmail({
    to: { email: args.clientEmail, name: args.clientName },
    subject: `Rezervacija je otkazana – ${args.locationName}`,
    html,
    senderName: args.tenantName,
  });
}

export interface ReviewRequestEmailArgs {
  tenantName: string;
  tenantLogoPath: string | null;
  tenantHeroPath: string | null;
  primaryColor: string | null;
  clientName: string;
  clientEmail: string;
  locationName: string;
  locationAddress: string | null;
  locationPhone: string | null;
  website: string | null;
  socials: Record<string, string>;
  startIso: string;
  timezone: string;
  /** External review URL (locations.review_link). */
  reviewUrl: string;
}

// Admin-triggered review request. Unlike the fire-and-forget senders above,
// this RETURNS the transport result (sendEmail never throws) so the caller can
// stamp reservations.review_email_sent_at only after a successful send.
export async function sendReviewRequestEmail(
  args: ReviewRequestEmailArgs,
): Promise<SendEmailResult> {
  const html = renderReviewRequest({
    tenantName: args.tenantName,
    heroUrl: getTenantHeroUrl(args.tenantHeroPath),
    logoUrl: getTenantLogoUrl(args.tenantLogoPath),
    primaryColor: args.primaryColor,
    clientName: args.clientName,
    locationAddress: args.locationAddress,
    locationPhone: args.locationPhone,
    website: args.website,
    socials: args.socials,
    startIso: args.startIso,
    timezone: args.timezone,
    reviewUrl: args.reviewUrl,
  });

  return sendEmail({
    to: { email: args.clientEmail, name: args.clientName },
    subject: `Podijelite svoje iskustvo – ${args.locationName}`,
    html,
    senderName: args.tenantName,
  });
}
