"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  updateShowPrices,
  updateSmsReminders,
  updateServicesNote,
  type UpdateSettingsResult,
} from "../actions/settings";

interface SettingsFormProps {
  showPrices: boolean;
  smsReminders: boolean;
  availableLanguages: string[];
  servicesNote: Record<string, string>;
}

export function SettingsForm({
  showPrices: initialShowPrices,
  smsReminders: initialSmsReminders,
  availableLanguages,
  servicesNote: initialServicesNote,
}: SettingsFormProps) {
  const [showPrices, setShowPrices] = useState(initialShowPrices);
  const [smsReminders, setSmsReminders] = useState(initialSmsReminders);
  const [servicesNote, setServicesNote] =
    useState<Record<string, string>>(initialServicesNote);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<UpdateSettingsResult | null>(null);

  function save() {
    startTransition(async () => {
      // Sequential, not parallel: all three actions read-merge-write
      // tenants.config, so running them concurrently would race and lose a
      // change.
      const priceResult = await updateShowPrices(showPrices);
      if (!priceResult.ok) {
        setResult(priceResult);
        return;
      }
      const smsResult = await updateSmsReminders(smsReminders);
      if (!smsResult.ok) {
        setResult(smsResult);
        return;
      }
      setResult(await updateServicesNote(servicesNote));
    });
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
        <span className="font-medium">Show prices on booking site</span>
        <Switch
          checked={showPrices}
          onCheckedChange={(v) => {
            setShowPrices(v);
            setResult(null);
          }}
          aria-label="Show prices on booking site"
        />
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
        <span>
          <span className="block font-medium">SMS reminders (day before)</span>
          <span className="mt-1 block text-sm text-ink-muted">
            Texts each client the day before their appointment. Sender is the
            clinic name; sent only to valid phone numbers. May use Brevo SMS
            credits.
          </span>
        </span>
        <Switch
          checked={smsReminders}
          onCheckedChange={(v) => {
            setSmsReminders(v);
            setResult(null);
          }}
          aria-label="Send SMS reminders the day before"
        />
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <div>
          <span className="block font-medium">Services page note</span>
          <span className="mt-1 block text-sm text-ink-muted">
            Optional note shown at the top of the services step. Shown only for
            the language it&apos;s written in.
          </span>
        </div>
        {availableLanguages.map((lang) => (
          <label key={lang} className="block space-y-1">
            <span className="text-sm font-medium uppercase text-ink-muted">
              {lang}
            </span>
            <textarea
              value={servicesNote[lang] ?? ""}
              onChange={(e) => {
                setServicesNote((prev) => ({ ...prev, [lang]: e.target.value }));
                setResult(null);
              }}
              rows={3}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            />
          </label>
        ))}
      </div>

      {result?.ok === false && result.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {result.error}
        </p>
      )}
      {result?.ok === true && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Saved.
        </p>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
