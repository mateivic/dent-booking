"use client";

import Image from "next/image";
import { useTenant } from "@/features/tenant-theme/theme-provider";
import { useT } from "@/features/i18n/language-provider";
import { LanguageSwitcher } from "@/features/i18n/language-switcher";
import { getTenantHeroUrl, getTenantLogoUrl } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";

interface IntroStepProps {
  onStart: () => void;
}

export function IntroStep({ onStart }: IntroStepProps) {
  const { tenant } = useTenant();
  const t = useT();
  const heroUrl = getTenantHeroUrl(tenant.hero_path);
  const logoUrl = getTenantLogoUrl(tenant.logo_path);
  const tagline = tenant.config.tagline;

  return (
    <main className="relative flex min-h-screen w-full flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <LanguageSwitcher className="absolute right-1/2 translate-x-1/2 top-5 z-10 text-white/90" />
      {/* Background: hero photo with a slow Ken-Burns drift, or a branded gradient fallback */}
      <div className="absolute inset-0 -z-10">
        {heroUrl ? (
          <Image
            src={heroUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover animate-ken-burns motion-reduce:animate-none"
          />
        ) : (
          <div className="size-full bg-linear-to-br from-brand to-brand-accent" />
        )}
        {/* Bottom-weighted dark overlay for legibility */}
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/45 to-black/30" />
      </div>

      <div className="flex flex-col items-center gap-16 text-white">
        {logoUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={logoUrl}
            alt={tenant.name}
            className="h-30 w-auto object-contain animate-fade-up motion-reduce:animate-none"
          />
        )}

        {tagline && (
          <p
            className=" font-display max-w-md text-sm font-light tracking-wide text-white/80 animate-fade-up motion-reduce:animate-none"
            style={{ animationDelay: "180ms" }}
          >
            {tagline}
          </p>
        )}

        <button
          type="button"
          onClick={onStart}
          className={cn(
            "mt-4 font-display rounded-brand bg-white/95 px-10 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-ink shadow-xl",
            "transition hover:bg-white active:scale-[0.98] motion-reduce:active:scale-100",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40",
            "animate-fade-up motion-reduce:animate-none",
          )}
          style={{ animationDelay: "260ms" }}
        >
          {t.intro.cta}
        </button>
      </div>
    </main>
  );
}
