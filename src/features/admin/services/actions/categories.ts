"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getAuthedAdmin } from "@/features/admin/lib/auth";

export interface ActionResult {
    ok: boolean;
    error?: string;
}

export interface CreateCategoryResult {
    ok: true;
    data: {
        id: string;
        tenant_id: string;
        location_id: string;
        name: string;
        description: string | null;
        display_order: number;
        created_at: string;
    };
}

export async function createCategory(input: {
    locationId: string;
    name: string;
    description?: string;
}): Promise<CreateCategoryResult | { ok: false; error: string }> {
    const name = input.name.trim();
    if (!name) return { ok: false, error: "Name is required" };

    const admin = await getAuthedAdmin();
    if (!admin) return { ok: false, error: "Unauthorized" };

    const supabase = getSupabaseServiceRoleClient();

    // Verify the location belongs to the admin's tenant.
    const { data: location } = await supabase
        .from("locations")
        .select("id, tenant_id")
        .eq("id", input.locationId)
        .maybeSingle();
    if (!location || location.tenant_id !== admin.tenantId) {
        return { ok: false, error: "Location not found" };
    }

    const { data: maxRow } = await supabase
        .from("service_categories")
        .select("display_order")
        .eq("location_id", input.locationId)
        .order("display_order", { ascending: false })
        .limit(1)
        .maybeSingle();
    const nextOrder = (maxRow?.display_order ?? -1) + 1;

    const { data: created, error } = await supabase
        .from("service_categories")
        .insert({
            tenant_id: admin.tenantId,
            location_id: input.locationId,
            name,
            description: input.description?.trim() || null,
            display_order: nextOrder,
        })
        .select()
        .single();

    if (error) {
        if (error.code === "23505") {
            return { ok: false, error: "A category with this name already exists" };
        }
        return { ok: false, error: error.message };
    }

    revalidatePath("/admin/services");
    return { ok: true, data: created };
}

export async function updateCategory(input: {
    id: string;
    name: string;
    description?: string;
}): Promise<ActionResult> {
    const name = input.name.trim();
    if (!name) return { ok: false, error: "Name is required" };

    const admin = await getAuthedAdmin();
    if (!admin) return { ok: false, error: "Unauthorized" };

    const supabase = getSupabaseServiceRoleClient();

    const { error } = await supabase
        .from("service_categories")
        .update({
            name,
            description: input.description?.trim() || null,
        })
        .eq("id", input.id)
        .eq("tenant_id", admin.tenantId);

    if (error) {
        if (error.code === "23505") {
            return { ok: false, error: "A category with this name already exists" };
        }
        return { ok: false, error: error.message };
    }

    revalidatePath("/admin/services");
    return { ok: true };
}

export async function deleteCategory(input: { id: string }): Promise<ActionResult> {
    const admin = await getAuthedAdmin();
    if (!admin) return { ok: false, error: "Unauthorized" };

    const supabase = getSupabaseServiceRoleClient();

    const { count } = await supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("category_id", input.id)
        .eq("tenant_id", admin.tenantId)
        .is("deleted_at", null);

    if ((count ?? 0) > 0) {
        return {
            ok: false,
            error: "Delete all services in this category first.",
        };
    }

    const { error } = await supabase
        .from("service_categories")
        .delete()
        .eq("id", input.id)
        .eq("tenant_id", admin.tenantId);

    if (error) {
        // 23503 = FK violation: archived (soft-deleted) services still reference
        // this category (services → service_categories is ON DELETE RESTRICT).
        // Those rows are kept for reservation history, so the category can't go.
        if (error.code === "23503") {
            return {
                ok: false,
                error: "This category still has archived services from past bookings and can't be deleted.",
            };
        }
        return { ok: false, error: error.message };
    }

    revalidatePath("/admin/services");
    return { ok: true };
}

export async function reorderCategories(input: {
    locationId: string;
    orderedIds: string[];
}): Promise<ActionResult> {
    const admin = await getAuthedAdmin();
    if (!admin) return { ok: false, error: "Unauthorized" };

    const supabase = getSupabaseServiceRoleClient();

    const updates = input.orderedIds.map((id, idx) =>
        supabase
            .from("service_categories")
            .update({ display_order: idx })
            .eq("id", id)
            .eq("location_id", input.locationId)
            .eq("tenant_id", admin.tenantId),
    );

    const results = await Promise.all(updates);
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) return { ok: false, error: firstError.message };

    revalidatePath("/admin/services");
    return { ok: true };
}
