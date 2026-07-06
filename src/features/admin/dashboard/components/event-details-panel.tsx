"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { formatPrice, sumPrices } from "@/features/booking/lib/money";
import { cn } from "@/lib/utils";
import type { ReservationStatus } from "@/lib/supabase/types";
import { cancelReservation } from "../actions/cancel-reservation";
import { sendReviewRequest } from "../actions/send-review-request";
import type { CalendarEventVM } from "../types";

type PanelMode = "details" | "confirm-cancel" | "confirm-review";

interface EventDetailsPanelProps {
  event: CalendarEventVM | null;
  connectedLocationIds: string[];
  onClose: () => void;
}

// Mirrors the status-pill style map in features/admin/components/reservations-table.tsx.
const statusStyles: Record<ReservationStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-rose-50 text-rose-700",
  COMPLETED: "bg-sky-50 text-sky-700",
};

// Reservation details: side panel on desktop, bottom sheet on mobile. The
// trash icon starts a confirm step for cancelling (with the email choice); the
// star icon starts a confirm step for the one-time review-request email,
// available only for finished, non-cancelled reservations.
export function EventDetailsPanel({
  event,
  connectedLocationIds,
  onClose,
}: EventDetailsPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<PanelMode>("details");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Reset the confirm step when the selection changes or the panel reopens —
  // state adjustment during render (not an effect), per react.dev guidance.
  const eventId = event?.id ?? null;
  const [prevEventId, setPrevEventId] = useState(eventId);
  if (prevEventId !== eventId) {
    setPrevEventId(eventId);
    setMode("details");
    setError(null);
  }

  useEffect(() => {
    if (!event) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [event, pending, onClose]);

  if (!event) return null;

  function submitCancel(notifyClient: boolean) {
    if (!event) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelReservation({
        reservationId: event.id,
        notifyClient,
      });
      if (!result.ok) {
        setError(result.error ?? "Failed to cancel reservation.");
        return;
      }
      router.refresh();
      onClose();
    });
  }

  function submitReview() {
    if (!event) return;
    setError(null);
    startTransition(async () => {
      const result = await sendReviewRequest({ reservationId: event.id });
      if (!result.ok) {
        setError(result.error ?? "Failed to send review email.");
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center md:items-center md:justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Reservation details for ${event.clientName}`}
    >
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        disabled={pending}
        className="absolute inset-0 bg-black/20"
      />
      <Card
        className={cn(
          "relative m-0 w-full max-w-lg rounded-b-none p-5",
          "md:m-6 md:w-80 md:rounded-lg",
          "animate-fade-up motion-reduce:animate-none",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-base font-semibold text-ink">
              {event.clientName}
            </h4>
            <p className="mt-0.5 text-sm text-ink-muted">
              {event.dateLabel} · {event.timeLabel}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {mode === "details" &&
            event.status !== "CANCELLED" &&
            event.isFinished &&
            !event.reviewEmailSentAt ? (
              <button
                type="button"
                onClick={() => setMode("confirm-review")}
                aria-label="Send review request"
                className="rounded-md p-1 text-ink-muted transition-colors hover:bg-amber-50 hover:text-amber-600 motion-reduce:transition-none"
              >
                <SendIcon />
              </button>
            ) : null}
            {mode === "details" && event.status !== "CANCELLED" ? (
              <button
                type="button"
                onClick={() => setMode("confirm-cancel")}
                aria-label="Cancel reservation"
                className="rounded-md p-1 text-ink-muted transition-colors hover:bg-rose-50 hover:text-rose-600 motion-reduce:transition-none"
              >
                <TrashIcon />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              aria-label="Close"
              className="rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink motion-reduce:transition-none"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {mode === "confirm-cancel" ? (
          <div className="mt-4 space-y-3 text-sm">
            <p className="font-medium text-ink">Cancel this reservation?</p>
            <p className="text-ink-muted">
              {event.clientName} · {event.dateLabel} · {event.timeLabel}
            </p>
            {event.clientEmail ? (
              <p className="text-ink">
                Do you want to send a cancellation email to the client?
              </p>
            ) : (
              <p className="text-ink-muted">
                This client has no email address — no notice can be sent.
              </p>
            )}
            {error ? <p className="text-rose-700">{error}</p> : null}
            <div className="flex flex-col gap-2 pt-1">
              {event.clientEmail ? (
                <>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => submitCancel(true)}
                  >
                    {pending ? <Spinner className="h-4 w-4" /> : null}
                    Cancel &amp; email client
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => submitCancel(false)}
                  >
                    Cancel without email
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => submitCancel(false)}
                >
                  {pending ? <Spinner className="h-4 w-4" /> : null}
                  Cancel reservation
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setMode("details");
                  setError(null);
                }}
              >
                Keep reservation
              </Button>
            </div>
          </div>
        ) : mode === "confirm-review" ? (
          <div className="mt-4 space-y-3 text-sm">
            <p className="font-medium text-ink">
              Send a review request email to the client?
            </p>
            <p className="text-ink-muted">
              {event.clientName} · {event.dateLabel} · {event.timeLabel}
            </p>
            {event.clientEmail && event.hasReviewLink ? (
              <p className="text-ink">
                The client receives an email at{" "}
                <span className="font-medium">{event.clientEmail}</span> with a
                link to leave a review. This can only be sent once.
              </p>
            ) : null}
            {!event.clientEmail ? (
              <p className="text-ink-muted">
                This client has no email address — the review request cannot be
                sent.
              </p>
            ) : null}
            {event.clientEmail && !event.hasReviewLink ? (
              <p className="text-ink-muted">
                This location has no review link set — add one to
                locations.review_link first.
              </p>
            ) : null}
            {error ? <p className="text-rose-700">{error}</p> : null}
            <div className="flex flex-col gap-2 pt-1">
              {event.clientEmail && event.hasReviewLink ? (
                <Button
                  type="button"
                  variant="primary"
                  disabled={pending}
                  onClick={submitReview}
                >
                  {pending ? <Spinner className="h-4 w-4" /> : null}
                  Send review email
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setMode("details");
                  setError(null);
                }}
              >
                Back
              </Button>
            </div>
          </div>
        ) : (
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-muted">
                Status
              </dt>
              <dd className="mt-1 flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                    statusStyles[event.status],
                  )}
                >
                  {event.status}
                </span>
                <span className="text-xs text-ink-muted">
                  {syncLabel(event, connectedLocationIds)}
                </span>
              </dd>
              {event.reviewEmailSentAt ? (
                <dd className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
                  <StarIcon className="h-3 w-3 text-amber-500" />
                  Review email sent {formatSentDate(event.reviewEmailSentAt)}
                </dd>
              ) : null}
            </div>

            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-muted">
                Services
              </dt>
              <dd className="mt-1 space-y-1">
                {event.services.map((service, i) => (
                  <div
                    key={`${service.name}-${i}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="truncate">{service.name}</span>
                    <span className="shrink-0 text-ink-muted">
                      {formatPrice(service.price)}
                    </span>
                  </div>
                ))}
                {event.services.length > 1 ? (
                  <div className="flex items-center justify-between gap-3 border-t border-border pt-1 font-medium">
                    <span>Total</span>
                    <span>{formatPrice(sumPrices(event.services))}</span>
                  </div>
                ) : null}
              </dd>
            </div>

            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-muted">
                Contact
              </dt>
              <dd className="mt-1 space-y-0.5">
                {event.clientPhone ? (
                  <a
                    href={`tel:${event.clientPhone}`}
                    className="block text-brand hover:underline"
                  >
                    {event.clientPhone}
                  </a>
                ) : null}
                {event.clientEmail ? (
                  <a
                    href={`mailto:${event.clientEmail}`}
                    className="block truncate text-brand hover:underline"
                  >
                    {event.clientEmail}
                  </a>
                ) : null}
                {!event.clientPhone && !event.clientEmail ? (
                  <span className="text-ink-muted">No contact details</span>
                ) : null}
              </dd>
            </div>

            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-muted">
                Location
              </dt>
              <dd className="mt-1">{event.locationName}</dd>
            </div>

            {event.notes ? (
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-muted">
                  Notes
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-ink">
                  {event.notes}
                </dd>
              </div>
            ) : null}
          </dl>
        )}
      </Card>
    </div>
  );
}

function syncLabel(
  event: CalendarEventVM,
  connectedLocationIds: string[],
): string {
  if (!connectedLocationIds.includes(event.locationId)) {
    return "No calendar connected for this location";
  }
  switch (event.googleSyncStatus) {
    case "SYNCED":
      return "Synced to Google Calendar";
    case "FAILED":
      return "Not synced to Google Calendar";
    case "PENDING":
      return "Google Calendar sync pending";
    case "NOT_APPLICABLE":
      return "No calendar connected for this location";
  }
}

function formatSentDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

// Paper-plane "send" icon — the ACTION. The star is reserved for the
// "review email sent" indicator so a visible star always means "sent".
function SendIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.5 2.5L2.8 8.4l6 2.8 2.8 6 5.9-14.7zM8.8 11.2l8.7-8.7" />
    </svg>
  );
}

function StarIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path d="M10 1.8l2.47 5 5.53.8-4 3.9.94 5.5L10 14.4 5.06 17l.94-5.5-4-3.9 5.53-.8 2.47-5z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5l.7 10a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4l.7-10M8.2 9v5M11.8 9v5" />
    </svg>
  );
}
