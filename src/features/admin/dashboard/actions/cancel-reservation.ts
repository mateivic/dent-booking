"use server";

import { revalidatePath } from "next/cache";
import { getAuthedAdmin } from "@/features/admin/lib/auth";
import { cancelReservationAsTenantAdmin } from "@/features/booking/server/cancel-booking";

export interface CancelReservationState {
  ok: boolean;
  error?: string;
}

// Cancels a reservation on the admin's behalf; the admin chooses whether the
// client receives the cancellation email. Authorization is code-level
// (mirrors the other admin actions): the tenant scope comes from the signed-in
// admin's profile, so a forged reservationId from another tenant matches
// nothing.
export async function cancelReservation(input: {
  reservationId: string;
  notifyClient: boolean;
}): Promise<CancelReservationState> {
  const admin = await getAuthedAdmin();
  if (!admin) return { ok: false, error: "Unauthorized" };

  const result = await cancelReservationAsTenantAdmin({
    tenantId: admin.tenantId,
    reservationId: input.reservationId,
    notifyClient: input.notifyClient,
  });

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/admin/dashboard");
  return { ok: true };
}
