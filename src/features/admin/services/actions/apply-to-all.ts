"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getAuthedAdmin } from "@/features/admin/lib/auth";

export interface ApplyToAllPreviewTarget {
    locationId: string;
    locationName: string;
    categoriesToDelete: number;
    servicesToDelete: number;
    servicesWithFutureBookings: Array<{ id: string; name: string; bookingCount: number }>;
}

export interface ApplyToAllPreviewResult {
    ok: boolean;
    error?: string;
    sourceLocationName?: string;
    sourceCategoriesCount?: number;
    sourceServicesCount?: number;
    targets?: ApplyToAllPreviewTarget[];
}

export async function applyToAllPreview(input: {
    sourceLocationId: string;
}): Promise<ApplyToAllPreviewResult> {
    const admin = await getAuthedAdmin();
    if (!admin) return { ok: false, error: "Unauthorized" };

    const supabase = getSupabaseServiceRoleClient();

    const { data: sourceLocation } = await supabase
        .from("locations")
        .select("id, name")
        .eq("id", input.sourceLocationId)
        .eq("tenant_id", admin.tenantId)
        .maybeSingle();

    if (!sourceLocation) return { ok: false, error: "Source location not found" };

    const [{ data: sourceCategories }, { data: sourceServices }, { data: otherLocations }] =
        await Promise.all([
            supabase
                .from("service_categories")
                .select("id")
                .eq("location_id", input.sourceLocationId),
            supabase
                .from("services")
                .select("id")
                .eq("location_id", input.sourceLocationId)
                .is("deleted_at", null),
            supabase
                .from("locations")
                .select("id, name")
                .eq("tenant_id", admin.tenantId)
                .neq("id", input.sourceLocationId)
                .order("name"),
        ]);

    if (!otherLocations || otherLocations.length === 0) {
        return { ok: false, error: "No other locations to apply to" };
    }

    const targets: ApplyToAllPreviewTarget[] = [];
    const nowIso = new Date().toISOString();

    for (const loc of otherLocations) {
        const [{ data: targetCategories }, { data: targetServices }] = await Promise.all([
            supabase
                .from("service_categories")
                .select("id")
                .eq("location_id", loc.id),
            supabase
                .from("services")
                .select("id, name")
                .eq("location_id", loc.id),
        ]);

        const servicesWithBookings: Array<{ id: string; name: string; bookingCount: number }> = [];

        for (const svc of targetServices ?? []) {
            const { count } = await supabase
                .from("reservation_services")
                .select("reservation_id, reservations!inner(start_time, status)", {
                    count: "exact",
                    head: true,
                })
                .eq("service_id", svc.id)
                .gte("reservations.start_time", nowIso)
                .in("reservations.status", ["PENDING", "CONFIRMED"]);

            if ((count ?? 0) > 0) {
                servicesWithBookings.push({
                    id: svc.id,
                    name: svc.name,
                    bookingCount: count ?? 0,
                });
            }
        }

        targets.push({
            locationId: loc.id,
            locationName: loc.name,
            categoriesToDelete: targetCategories?.length ?? 0,
            servicesToDelete: targetServices?.length ?? 0,
            servicesWithFutureBookings: servicesWithBookings,
        });
    }

    return {
        ok: true,
        sourceLocationName: sourceLocation.name,
        sourceCategoriesCount: sourceCategories?.length ?? 0,
        sourceServicesCount: sourceServices?.length ?? 0,
        targets,
    };
}

export interface ApplyToAllCommitResult {
    ok: boolean;
    error?: string;
    targetsUpdated?: number;
}

export async function applyToAllCommit(input: {
    sourceLocationId: string;
}): Promise<ApplyToAllCommitResult> {
    const admin = await getAuthedAdmin();
    if (!admin) return { ok: false, error: "Unauthorized" };

    const supabase = getSupabaseServiceRoleClient();

    const { data: sourceLocation } = await supabase
        .from("locations")
        .select("id")
        .eq("id", input.sourceLocationId)
        .eq("tenant_id", admin.tenantId)
        .maybeSingle();

    if (!sourceLocation) return { ok: false, error: "Source location not found" };

    const [{ data: sourceCategories }, { data: sourceServices }, { data: otherLocations }] =
        await Promise.all([
            supabase
                .from("service_categories")
                .select("id, name, description, display_order")
                .eq("location_id", input.sourceLocationId)
                .order("display_order"),
            supabase
                .from("services")
                .select(
                    "id, category_id, name, description, duration_minutes, price, display_order",
                )
                .eq("location_id", input.sourceLocationId)
                .is("deleted_at", null)
                .order("display_order"),
            supabase
                .from("locations")
                .select("id")
                .eq("tenant_id", admin.tenantId)
                .neq("id", input.sourceLocationId),
        ]);

    if (!otherLocations || otherLocations.length === 0) {
        return { ok: false, error: "No other locations to apply to" };
    }

    let updated = 0;

    for (const target of otherLocations) {
        const { error: delSvcErr } = await supabase
            .from("services")
            .delete()
            .eq("location_id", target.id);
        if (delSvcErr) {
            return { ok: false, error: `Failed to clear services: ${delSvcErr.message}` };
        }

        const { error: delCatErr } = await supabase
            .from("service_categories")
            .delete()
            .eq("location_id", target.id);
        if (delCatErr) {
            return { ok: false, error: `Failed to clear categories: ${delCatErr.message}` };
        }

        const categoryIdMap = new Map<string, string>();
        for (const cat of sourceCategories ?? []) {
            const { data: created, error: catErr } = await supabase
                .from("service_categories")
                .insert({
                    tenant_id: admin.tenantId,
                    location_id: target.id,
                    name: cat.name,
                    description: cat.description,
                    display_order: cat.display_order,
                })
                .select("id")
                .single();
            if (catErr || !created) {
                return {
                    ok: false,
                    error: `Failed to create category at target: ${catErr?.message ?? "unknown"}`,
                };
            }
            categoryIdMap.set(cat.id, created.id);
        }

        const newServiceRows = (sourceServices ?? [])
            .map((svc) => {
                const newCategoryId = categoryIdMap.get(svc.category_id);
                if (!newCategoryId) return null;
                return {
                    tenant_id: admin.tenantId,
                    location_id: target.id,
                    category_id: newCategoryId,
                    name: svc.name,
                    description: svc.description,
                    duration_minutes: svc.duration_minutes,
                    price: svc.price,
                    display_order: svc.display_order,
                };
            })
            .filter((row): row is NonNullable<typeof row> => row !== null);

        if (newServiceRows.length > 0) {
            const { error: svcErr } = await supabase.from("services").insert(newServiceRows);
            if (svcErr) {
                return {
                    ok: false,
                    error: `Failed to create services at target: ${svcErr.message}`,
                };
            }
        }

        updated += 1;
    }

    revalidatePath("/admin/services");
    return { ok: true, targetsUpdated: updated };
}
