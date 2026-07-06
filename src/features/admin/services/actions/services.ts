"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getAuthedAdmin } from "@/features/admin/lib/auth";
import type { ActionResult } from "./categories";

export interface CreateServiceResult {
    ok: true;
    data: {
        id: string;
        tenant_id: string;
        location_id: string;
        category_id: string;
        name: string;
        description: string | null;
        duration_minutes: number;
        price: number;
        display_order: number;
        created_at: string;
    };
}

export interface CreateServiceInput {
    categoryId: string;
    locationId: string;
    name: string;
    description?: string;
    durationMinutes: number;
    price: number;
}

export async function createService(input: CreateServiceInput): Promise<CreateServiceResult | { ok: false; error: string }> {
    const name = input.name.trim();
    if (!name) return { ok: false, error: "Name is required" };
    if (!Number.isFinite(input.durationMinutes) || input.durationMinutes <= 0) {
        return { ok: false, error: "Duration must be a positive number" };
    }
    if (!Number.isFinite(input.price) || input.price < 0) {
        return { ok: false, error: "Price must be zero or positive" };
    }

    const admin = await getAuthedAdmin();
    if (!admin) return { ok: false, error: "Unauthorized" };

    const supabase = getSupabaseServiceRoleClient();

    // Verify the category belongs to the admin's tenant + the supplied location.
    const { data: category } = await supabase
        .from("service_categories")
        .select("id, tenant_id, location_id")
        .eq("id", input.categoryId)
        .maybeSingle();
    if (
        !category ||
        category.tenant_id !== admin.tenantId ||
        category.location_id !== input.locationId
    ) {
        return { ok: false, error: "Category not found" };
    }

    const { data: maxRow } = await supabase
        .from("services")
        .select("display_order")
        .eq("category_id", input.categoryId)
        .order("display_order", { ascending: false })
        .limit(1)
        .maybeSingle();
    const nextOrder = (maxRow?.display_order ?? -1) + 1;

    const { data: created, error } = await supabase
        .from("services")
        .insert({
            tenant_id: admin.tenantId,
            location_id: input.locationId,
            category_id: input.categoryId,
            name,
            description: input.description?.trim() || null,
            duration_minutes: Math.round(input.durationMinutes),
            price: input.price,
            display_order: nextOrder,
        })
        .select()
        .single();

    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/services");
    return { ok: true, data: created };
}

export interface UpdateServiceInput {
    id: string;
    name: string;
    description?: string;
    durationMinutes: number;
    price: number;
}

export async function updateService(input: UpdateServiceInput): Promise<ActionResult> {
    const name = input.name.trim();
    if (!name) return { ok: false, error: "Name is required" };
    if (!Number.isFinite(input.durationMinutes) || input.durationMinutes <= 0) {
        return { ok: false, error: "Duration must be a positive number" };
    }
    if (!Number.isFinite(input.price) || input.price < 0) {
        return { ok: false, error: "Price must be zero or positive" };
    }

    const admin = await getAuthedAdmin();
    if (!admin) return { ok: false, error: "Unauthorized" };

    const supabase = getSupabaseServiceRoleClient();
    const { error } = await supabase
        .from("services")
        .update({
            name,
            description: input.description?.trim() || null,
            duration_minutes: Math.round(input.durationMinutes),
            price: input.price,
        })
        .eq("id", input.id)
        .eq("tenant_id", admin.tenantId);

    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/services");
    return { ok: true };
}

export async function deleteService(input: { id: string }): Promise<ActionResult> {
    const admin = await getAuthedAdmin();
    if (!admin) return { ok: false, error: "Unauthorized" };

    const supabase = getSupabaseServiceRoleClient();

    // Soft-delete (archive) instead of hard-deleting: a hard delete cascade-drops
    // reservation_services rows, which erases the service from existing bookings
    // and hides those bookings from the dashboard's inner-join queries. Archiving
    // keeps the row for history while removing it from booking + admin listings.
    // `.select()` turns a forged/foreign id (0 rows matched) into an error rather
    // than a silent success.
    const { data: updated, error } = await supabase
        .from("services")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", input.id)
        .eq("tenant_id", admin.tenantId)
        .is("deleted_at", null)
        .select("id");

    if (error) return { ok: false, error: error.message };
    if (!updated || updated.length === 0) {
        return { ok: false, error: "Service not found" };
    }

    revalidatePath("/admin/services");
    return { ok: true };
}

export async function reorderServices(input: {
    categoryId: string;
    orderedIds: string[];
}): Promise<ActionResult> {
    const admin = await getAuthedAdmin();
    if (!admin) return { ok: false, error: "Unauthorized" };

    const supabase = getSupabaseServiceRoleClient();

    const updates = input.orderedIds.map((id, idx) =>
        supabase
            .from("services")
            .update({ display_order: idx })
            .eq("id", id)
            .eq("category_id", input.categoryId)
            .eq("tenant_id", admin.tenantId),
    );

    const results = await Promise.all(updates);
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) return { ok: false, error: firstError.message };

    revalidatePath("/admin/services");
    return { ok: true };
}
