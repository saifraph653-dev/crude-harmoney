import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Correctness does NOT depend on this running promptly -- every checkout
// attempt already reclaims its own variant's expired reservations inline
// (see reserve_stock_and_create_order() in supabase/migrations). This job
// just keeps *displayed* stock accurate for people who are browsing but
// not currently trying to buy that size, and expires abandoned pending
// orders. See README's "Vercel Cron" section for the Hobby-plan caveat
// (once-per-day minimum) this design works around.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("release_expired_reservations");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ released: data });
}
