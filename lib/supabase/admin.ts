import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses RLS entirely -- this is the ONLY client
 * allowed to write orders/order_items/stock_reservations/webhook_events,
 * per the project's "all writes to orders happen server-side with the
 * service-role key" rule. Never import this from a client component; the
 * runtime check below is a stopgap until the build-time assertion lands
 * (see the security-headers step).
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient() must never be called from client code");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
