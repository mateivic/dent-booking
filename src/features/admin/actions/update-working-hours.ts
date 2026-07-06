'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { getAuthedAdmin } from '@/features/admin/lib/auth';
import type { WorkingHours } from '@/lib/supabase/types';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface UpdateWorkingHoursState {
    ok: boolean | null;
    error?: string;
}

export async function updateWorkingHours(
    _prev: UpdateWorkingHoursState,
    formData: FormData,
): Promise<UpdateWorkingHoursState> {
    // Authorize in code — the app does not rely on RLS (tables have RLS enabled
    // but no policies). Mirrors the settings/services admin actions.
    const admin = await getAuthedAdmin();
    if (!admin) return { ok: false, error: 'Unauthorized' };

    const locationId = String(formData.get('locationId') ?? '');
    if (!locationId) return { ok: false, error: 'Missing location' };

    const working_hours: WorkingHours = {};
    for (const day of WEEKDAYS) {
        const closed = formData.get(`${day}_closed`) === 'on';
        if (closed) {
            working_hours[day] = null;
            continue;
        }
        const open = String(formData.get(`${day}_open`) ?? '').trim();
        const close = String(formData.get(`${day}_close`) ?? '').trim();
        if (!HHMM_RE.test(open) || !HHMM_RE.test(close)) {
            return { ok: false, error: `Invalid time for ${day}` };
        }
        if (open >= close) {
            return { ok: false, error: `Open time must be before close time for ${day}` };
        }
        working_hours[day] = { open, close };
    }

    // One-off closed dates: comma-separated YYYY-MM-DD from the hidden input.
    // Validate format, drop blanks, dedupe, sort.
    const closedRaw = String(formData.get('closed_dates') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    for (const d of closedRaw) {
        if (!ISO_DATE_RE.test(d)) {
            return { ok: false, error: `Invalid date: ${d}` };
        }
    }
    const closed_dates = [...new Set(closedRaw)].sort();

    const supabase = getSupabaseServiceRoleClient();

    // Scope the write to the admin's tenant: a forged locationId from another
    // tenant matches 0 rows. `.select()` makes a 0-row write surface as an error
    // instead of a silent "success".
    const { data: updated, error } = await supabase
        .from('locations')
        .update({ working_hours, closed_dates })
        .eq('id', locationId)
        .eq('tenant_id', admin.tenantId)
        .select('id');

    if (error) return { ok: false, error: error.message };
    if (!updated || updated.length === 0) {
        return { ok: false, error: 'Location not found' };
    }

    revalidatePath('/admin/working-hours');
    return { ok: true };
}
