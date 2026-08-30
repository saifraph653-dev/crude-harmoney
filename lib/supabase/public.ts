import { createClient } from "@supabase/supabase-js";

/**
 * Anon-key client for public, RLS-protected reads (products/variants only).
 * Safe to use in cached/prerendered code paths -- it can never see orders,
 * order_items, stock_reservations or webhook_events, RLS denies it outright.
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set",
    );
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}
