import { getTenantBundlePublic } from "@/lib/tenant";
import { getTenantLogoUrl } from "@/lib/supabase/storage";
import { LanguageSwitcher } from "@/features/i18n/language-switcher";

interface CancelShellProps {
    subdomain: string;
    children: React.ReactNode;
}

// Shared centered shell for the cancellation flow. Mirrors the booking wizard
// header (tenant logo + language switcher) so the cancel pages match the rest
// of the public site instead of looking like a bare form.
export async function CancelShell({ subdomain, children }: CancelShellProps) {
    const bundle = await getTenantBundlePublic(subdomain);
    const logoUrl = bundle ? getTenantLogoUrl(bundle.tenant.logo_path) : null;

    return (
        <main className="relative mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-12 font-display text-center">
            <LanguageSwitcher className="absolute right-6 top-6 text-ink-muted" />
            {logoUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                    src={logoUrl}
                    alt={bundle?.tenant.name ?? ""}
                    className="mb-8 h-20 w-auto object-contain animate-fade-up motion-reduce:animate-none"
                />
            )}
            {children}
        </main>
    );
}
