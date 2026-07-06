import { notFound } from "next/navigation";
import { getTenantBundlePublic } from "@/lib/tenant";
import { SettingsForm } from "@/features/admin/settings/components/settings-form";

interface PageProps {
  params: Promise<{ subdomain: string }>;
}

// UI languages we actually ship dictionaries for (see features/i18n).
const SHIPPED_LANGUAGES = ["hr", "en"];

export default async function SettingsPage({ params }: PageProps) {
  const { subdomain } = await params;

  const bundle = await getTenantBundlePublic(subdomain);
  if (!bundle) notFound();

  const configured = bundle.tenant.config.lang?.languages?.length
    ? bundle.tenant.config.lang.languages
    : ["hr"];
  const availableLanguages = configured.filter((l) =>
    SHIPPED_LANGUAGES.includes(l),
  );

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Settings</h2>
      <SettingsForm
        showPrices={bundle.tenant.config.showPrices ?? true}
        smsReminders={bundle.tenant.config.sms?.enabled ?? false}
        availableLanguages={
          availableLanguages.length ? availableLanguages : ["hr"]
        }
        servicesNote={bundle.tenant.config.servicesNote ?? {}}
      />
    </section>
  );
}
