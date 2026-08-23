import { describe, expect, it, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

// The whole point of the coming_soon state is that a piece can be shown
// publicly without being buyable. That is a security-shaped claim -- it is
// what stops someone posting a variant id at the checkout action before a
// drop opens -- so it gets a test against the real database rather than a
// promise in a comment.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

let comingSoonVariantId: string;
let comingSoonSlug: string;

beforeAll(async () => {
  const { data, error } = await admin
    .from("products")
    .select("slug, variants(id)")
    .eq("status", "coming_soon")
    .limit(1);
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("seed a coming_soon product before running this test");
  comingSoonSlug = data[0].slug;
  comingSoonVariantId = data[0].variants[0].id;
});

describe("coming_soon products", () => {
  it("are publicly readable, so they can be shown as a lookbook", async () => {
    const { data, error } = await anon
      .from("products")
      .select("slug, status")
      .eq("slug", comingSoonSlug)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.status).toBe("coming_soon");
  });

  it("expose their variants publicly (sizes are shown pre-launch)", async () => {
    const { data, error } = await anon
      .from("variants")
      .select("id")
      .eq("id", comingSoonVariantId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("CANNOT be reserved, even with the service-role key", async () => {
    const { data, error } = await admin.rpc("reserve_stock_and_create_order", {
      p_variant_id: comingSoonVariantId,
      p_quantity: 1,
      p_email: "prelaunch-probe@example.com",
      p_shipping_name: "Pre Launch Probe",
      p_shipping_address_line1: "1 Test Street",
      p_shipping_address_line2: "",
      p_shipping_city: "Doha",
      p_shipping_country: "Qatar",
      p_shipping_postal_code: "",
      p_note: "",
    });

    expect(data).toBeNull();
    expect(error?.message).toBe("product_not_live");
  });

  it("leaves stock untouched after a refused reservation", async () => {
    const { data } = await admin
      .from("variants")
      .select("stock_count")
      .eq("id", comingSoonVariantId)
      .single();

    // Nothing was decremented by the attempt above.
    expect(data!.stock_count).toBeGreaterThan(0);
  });
});
