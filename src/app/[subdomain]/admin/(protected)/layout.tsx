import { notFound, redirect } from "next/navigation";
import { getTenantBundlePrivate } from "@/lib/tenant";
import { getTenantLogoUrl } from "@/lib/supabase/storage";
import { getAuthedAdmin } from "@/features/admin/lib/auth";
import { signOut } from "@/features/admin/auth/actions";
import { AdminNav } from "@/features/admin/components/admin-nav";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ subdomain: string }>;
}

export default async function ProtectedAdminLayout({
  children,
  params,
}: LayoutProps) {
  const { subdomain } = await params;
  const bundle = await getTenantBundlePrivate(subdomain);

  if (!bundle) notFound();

  const admin = await getAuthedAdmin();
  if (!admin) redirect("/admin/login");

  if (admin.tenantId !== bundle.tenant.id) {
    notFound();
  }

  const totalLocations = bundle.locations.length;
  const connectedLocations = bundle.calendarIntegrations.filter((i) =>
    bundle.locations.some((l) => l.id === i.location_id),
  ).length;

  const logoUrl = getTenantLogoUrl(bundle.tenant.logo_path);

  const navItems = [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/services", label: "Services" },
    { href: "/admin/working-hours", label: "Working hours" },
    {
      href: "/admin/connect-google",
      label: "Calendar",
      badge: `(${connectedLocations}/${totalLocations})`,
    },
    { href: "/admin/settings", label: "Settings" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur">
        <AdminNav
          items={navItems}
          signOutAction={signOut.bind(null, subdomain)}
          logoUrl={logoUrl}
          tenantName={bundle.tenant.name}
        />
      </header>
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </div>
    </div>
  );
}
