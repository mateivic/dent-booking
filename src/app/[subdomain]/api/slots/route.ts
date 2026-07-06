import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getAvailabilityConnector } from "@/features/availability/connectors/factory";
import { dayWindowUtc, isClosedDate } from "@/features/booking/lib/working-hours";
import { weekdayKey } from "@/features/booking/lib/timezone";
import {
  generateSlots,
  resolveSlotIntervalMinutes,
} from "@/features/booking/lib/slots";
import type { WorkingHours } from "@/lib/supabase/types";

interface RouteContext {
  params: Promise<{ subdomain: string }>;
}

export async function GET(
  request: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  const { subdomain } = await ctx.params;
  const sp = request.nextUrl.searchParams;

  const locationId = sp.get("locationId");
  const date = sp.get("date");
  const serviceIdsRaw = sp.get("serviceIds");

  if (!locationId || !date || !serviceIdsRaw) {
    return NextResponse.json(
      { error: "locationId, date, serviceIds are required" },
      { status: 400 },
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date must be YYYY-MM-DD" },
      { status: 400 },
    );
  }
  const serviceIds = serviceIdsRaw.split(",").filter(Boolean);
  if (serviceIds.length === 0) {
    return NextResponse.json({ error: "serviceIds required" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRoleClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("subdomain", subdomain)
    .maybeSingle();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const [{ data: location }, { data: services }] = await Promise.all([
    supabase
      .from("locations")
      .select("id, tenant_id, timezone, working_hours, closed_dates")
      .eq("id", locationId)
      .maybeSingle(),
    supabase
      .from("services")
      .select("id, tenant_id, location_id, duration_minutes")
      .in("id", serviceIds),
  ]);

  if (!location || location.tenant_id !== tenant.id) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }
  if (!services || services.length !== serviceIds.length) {
    return NextResponse.json(
      { error: "One or more services not found" },
      { status: 404 },
    );
  }
  if (services.some((s) => s.tenant_id !== tenant.id)) {
    return NextResponse.json(
      { error: "Service does not belong to tenant" },
      { status: 400 },
    );
  }
  if (services.some((s) => s.location_id !== location.id)) {
    return NextResponse.json(
      { error: "Service is not offered at this location" },
      { status: 400 },
    );
  }

  const tz = location.timezone as string;
  const workingHours = location.working_hours as WorkingHours;
  const dayConfig = workingHours[weekdayKey(date, tz)];
  if (!dayConfig || isClosedDate(date, location.closed_dates as string[])) {
    return NextResponse.json({ date, timezone: tz, slots: [] });
  }

  const totalDurationMin = services.reduce(
    (sum, s) => sum + s.duration_minutes,
    0,
  );
  const dayWindow = dayWindowUtc(date, dayConfig.open, dayConfig.close, tz);

  const connector = await getAvailabilityConnector(supabase, location.id);

  let busy: Array<{ start: number; end: number }> = [];
  try {
    const windows = await connector.listBusyWindows(
      dayWindow.startUtc.toISOString(),
      dayWindow.endUtc.toISOString(),
      tz,
    );
    busy = windows.map((w) => ({
      start: new Date(w.start).getTime(),
      end: new Date(w.end).getTime(),
    }));
  } catch (err) {
    console.error("[/api/slots] availability lookup failed", err);
    return NextResponse.json(
      { error: "Could not verify availability" },
      { status: 502 },
    );
  }

  const slots = generateSlots({
    dayWindow,
    durationMin: totalDurationMin,
    intervalMin: resolveSlotIntervalMinutes(location),
    busy,
    nowMs: Date.now(),
    timezone: tz,
  });

  return NextResponse.json({ date, timezone: tz, slots });
}
