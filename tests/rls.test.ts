import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Tables that must be readable by anon (product catalog). Every other table
// in the public schema must have zero policies granted to anon/authenticated
// -- default deny. If you add a table and forget RLS, "every table has RLS
// enabled" below fails the build; if you add a table and forget to review
// its policies, "no unexpected anon-readable tables" below fails it too.
const PUBLIC_READ_TABLES = ["products", "variants"];

let db: Client;

beforeAll(async () => {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error("SUPABASE_DB_URL is not set (see .env.example)");
  }
  db = new Client({ connectionString });
  await db.connect();
});

afterAll(async () => {
  await db.end();
});

describe("Row Level Security", () => {
  it("is enabled on every table in the public schema", async () => {
    const { rows } = await db.query<{ tablename: string }>(
      `select tablename
       from pg_tables
       where schemaname = 'public'
         and rowsecurity = false`,
    );

    expect(
      rows.map((r) => r.tablename),
      "every table in the public schema must have RLS enabled -- run " +
        "`alter table <name> enable row level security;` in a new migration",
    ).toEqual([]);
  });

  it("has at least one table (sanity check the query above isn't vacuously passing)", async () => {
    const { rows } = await db.query<{ count: string }>(
      `select count(*)::text as count from pg_tables where schemaname = 'public'`,
    );
    expect(Number(rows[0].count)).toBeGreaterThan(0);
  });

  it("grants anon SELECT only on the public product catalog tables", async () => {
    const { rows } = await db.query<{ table_name: string }>(
      `select table_name
       from information_schema.role_table_grants
       where grantee = 'anon'
         and table_schema = 'public'
         and privilege_type = 'SELECT'`,
    );

    const grantedTables = rows.map((r) => r.table_name).sort();
    expect(grantedTables).toEqual([...PUBLIC_READ_TABLES].sort());
  });

  it("grants anon no INSERT/UPDATE/DELETE on anything", async () => {
    const { rows } = await db.query<{ table_name: string; privilege_type: string }>(
      `select table_name, privilege_type
       from information_schema.role_table_grants
       where grantee = 'anon'
         and table_schema = 'public'
         and privilege_type in ('INSERT', 'UPDATE', 'DELETE')`,
    );
    expect(rows).toEqual([]);
  });

  it("has a permissive SELECT policy for anon on the product catalog tables", async () => {
    for (const table of PUBLIC_READ_TABLES) {
      const { rows } = await db.query<{ policyname: string; roles: string[] }>(
        `select policyname, roles
         from pg_policies
         where schemaname = 'public'
           and tablename = $1
           and cmd = 'SELECT'`,
        [table],
      );
      expect(rows.length, `${table} should have a SELECT policy`).toBeGreaterThan(0);
      expect(rows.some((r) => r.roles.includes("anon"))).toBe(true);
    }
  });

  it("has zero policies on tables that must never be anon-readable", async () => {
    const { rows: allTables } = await db.query<{ tablename: string }>(
      `select tablename from pg_tables where schemaname = 'public'`,
    );
    const restrictedTables = allTables
      .map((r) => r.tablename)
      .filter((t) => !PUBLIC_READ_TABLES.includes(t));

    expect(restrictedTables).toContain("orders");
    expect(restrictedTables).toContain("order_items");
    expect(restrictedTables).toContain("stock_reservations");
    expect(restrictedTables).toContain("webhook_events");

    for (const table of restrictedTables) {
      const { rows: policies } = await db.query<{ policyname: string }>(
        `select policyname from pg_policies where schemaname = 'public' and tablename = $1`,
        [table],
      );
      expect(policies, `${table} must have no policies (default deny)`).toEqual([]);
    }
  });
});

describe("Row Level Security, enforced end-to-end through the Data API", () => {
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!apiUrl || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set (see .env.example)",
    );
  }

  const restRequest = (table: string) =>
    fetch(`${apiUrl}/rest/v1/${table}?select=*&limit=1`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });

  it("lets the anon key read products and variants", async () => {
    for (const table of PUBLIC_READ_TABLES) {
      const res = await restRequest(table);
      expect(res.status, `${table} should be readable by anon`).toBe(200);
    }
  });

  it("refuses the anon key on orders, order_items, stock_reservations, webhook_events", async () => {
    for (const table of ["orders", "order_items", "stock_reservations", "webhook_events"]) {
      const res = await restRequest(table);
      expect(res.status, `${table} must not be readable by anon`).not.toBe(200);
    }
  });
});
