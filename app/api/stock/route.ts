import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public";

// Deliberately uncached: this is the one piece of a drop page that must
// always reflect the current row in Postgres. Called client-side from
// <LiveStock>, never from a cached/prerendered path.

const querySchema = z
  .object({
    variantIds: z
      .string()
      .min(1)
      .transform((value) => value.split(","))
      .pipe(z.array(z.string().uuid()).min(1).max(50)),
  })
  .strict();

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    variantIds: request.nextUrl.searchParams.get("variantIds") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid variantIds" }, { status: 400 });
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("variants")
    .select("id, stock_count")
    .in("id", parsed.data.variantIds);

  if (error) {
    return NextResponse.json({ error: "failed to load stock" }, { status: 500 });
  }

  const stock: Record<string, number> = {};
  for (const row of data ?? []) {
    stock[row.id] = row.stock_count;
  }

  return NextResponse.json(
    { stock },
    { headers: { "Cache-Control": "no-store" } },
  );
}
