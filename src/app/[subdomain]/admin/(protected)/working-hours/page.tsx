import { notFound } from "next/navigation";
import { getTenantBundlePublic } from "@/lib/tenant";
import { WorkingHoursForm } from "@/features/admin/components/working-hours-form";
import { LocationFilter } from "@/features/admin/shared/location-filter";
import { resolveLocation } from "@/features/admin/shared/resolve-location";

interface PageProps {
    params: Promise<{ subdomain: string }>;
    searchParams: Promise<{ location?: string }>;
}

export default async function WorkingHoursPage({ params, searchParams }: PageProps) {
    const [{ subdomain }, { location: locationParam }] = await Promise.all([
        params,
        searchParams,
    ]);

    const bundle = await getTenantBundlePublic(subdomain);
    if (!bundle) notFound();

    const resolved = resolveLocation(bundle.locations, locationParam);

    return (
        <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">Working hours</h2>
                {bundle.locations.length > 0 && (
                    <LocationFilter locations={bundle.locations} />
                )}
            </div>

            {resolved.kind === "empty" && (
                <p className="text-ink-muted">No locations configured.</p>
            )}

            {resolved.kind === "one" && (
                <WorkingHoursForm
                    key={resolved.location.id}
                    locationId={resolved.location.id}
                    locationName={resolved.location.name}
                    workingHours={resolved.location.working_hours}
                    timezone={resolved.location.timezone}
                    closedDates={resolved.location.closed_dates}
                />
            )}
        </section>
    );
}
