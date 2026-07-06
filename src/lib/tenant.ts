import { cache } from "react";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type {
  CalendarIntegration,
  Location,
  Service,
  ServiceCategory,
  Tenant,
  TenantPublic,
} from "@/lib/supabase/types";

export interface TenantBundle {
  tenant: Tenant;
  locations: Location[];
  categories: ServiceCategory[];
  services: Service[];
  calendarIntegrations: CalendarIntegration[];
}

export interface TenantBundlePublic {
  tenant: TenantPublic;
  locations: Location[];
  categories: ServiceCategory[];
  services: Service[];
}

const fetchTenantBundle = cache(
  async (subdomain: string): Promise<TenantBundle | null> => {
    const supabase = getSupabaseServiceRoleClient();

    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("*")
      .eq("subdomain", subdomain)
      .maybeSingle();

    if (error) {
      console.error(
        `[fetchTenantBundle] Supabase error for subdomain="${subdomain}":`,
        error,
      );
      return null;
    }
    if (!tenant) {
      console.warn(
        `[fetchTenantBundle] No tenant found with subdomain="${subdomain}".`,
      );
      return null;
    }

    const [locationsRes, categoriesRes, servicesRes, integrationsRes] =
      await Promise.all([
        supabase
          .from("locations")
          .select("*")
          .eq("tenant_id", tenant.id)
          .order("name"),
        supabase
          .from("service_categories")
          .select("*")
          .eq("tenant_id", tenant.id)
          .order("display_order")
          .order("name"),
        supabase
          .from("services")
          .select("*")
          .eq("tenant_id", tenant.id)
          .is("deleted_at", null)
          .order("display_order")
          .order("name"),
        supabase
          .from("calendar_integrations")
          .select("*")
          .eq("tenant_id", tenant.id),
      ]);

    return {
      tenant: tenant as Tenant,
      locations: (locationsRes.data ?? []) as Location[],
      categories: (categoriesRes.data ?? []) as ServiceCategory[],
      services: (servicesRes.data ?? []) as Service[],
      calendarIntegrations: (integrationsRes.data ?? []) as CalendarIntegration[],
    };
  },
);

// Public bundle used by client components — strips per-row secrets.
// Even though calendar_integrations holds tokens, they never leave the server.
export async function getTenantBundlePublic(
  subdomain: string,
): Promise<TenantBundlePublic | null> {
  const bundle = await fetchTenantBundle(subdomain);
  if (!bundle) return null;

  const { id, name, subdomain: sub, logo_path, hero_path, config } =
    bundle.tenant;
  return {
    tenant: { id, name, subdomain: sub, logo_path, hero_path, config },
    locations: bundle.locations,
    categories: bundle.categories,
    services: bundle.services,
  };
}

// Server-only. Includes calendar_integrations with refresh/access tokens.
// Never pass the returned bundle as a prop to a client component.
export async function getTenantBundlePrivate(
  subdomain: string,
): Promise<TenantBundle | null> {
  return fetchTenantBundle(subdomain);
}
