import { NextResponse, type NextRequest } from "next/server";
import { sendDueReminders } from "@/features/booking/server/reminders";

// Internal cron endpoint that sends day-before reminders. Lives at the apex
// (outside [subdomain]) and is triggered once a day by Supabase Cron (pg_cron +
// pg_net POST). Guarded by a shared CRON_SECRET bearer token; the work itself is
// idempotent, so a retried/duplicated trigger is safe.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function authorize(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron/send-reminders] CRON_SECRET is not configured");
    return false;
  }
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token.length > 0 && timingSafeEqual(token, secret);
}

async function handle(request: NextRequest): Promise<NextResponse> {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await sendDueReminders();
  return NextResponse.json({ ok: true, ...summary });
}

// Supabase Cron uses POST.
export async function POST(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}
