// Load test for the full checkout path (product page -> live stock check
// -> checkout page -> submit reservation), 200 concurrent buyers against
// a single variant, per the brief. Reports p95 latency for each step,
// especially the checkout submission itself (the atomic reservation
// path -- see supabase/migrations and tests/no-oversell.test.ts for the
// separate, DB-level correctness test this does NOT duplicate; this
// test is about real HTTP performance under load, not correctness).
//
// Setup: node scripts/seed-load-test.mjs
// Run:   k6 run -e BASE_URL=http://localhost:3000 -e VARIANT_ID=<uuid> load-test/checkout.js

import http from "k6/http";
import { check } from "k6";
import { Trend, Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const VARIANT_ID = __ENV.VARIANT_ID;
const PRODUCT_SLUG = "k6-load-test";

if (!VARIANT_ID) {
  throw new Error(
    "Set -e VARIANT_ID=<uuid>. Run `node scripts/seed-load-test.mjs` first, it prints the exact command.",
  );
}

const dropPageDuration = new Trend("drop_page_duration", true);
const stockCheckDuration = new Trend("stock_check_duration", true);
const checkoutPageDuration = new Trend("checkout_page_duration", true);
const checkoutSubmitDuration = new Trend("checkout_submit_duration", true);

const reserved = new Counter("checkout_reserved");
const soldOut = new Counter("checkout_sold_out");
const unexpected = new Counter("checkout_unexpected_outcome");

export const options = {
  scenarios: {
    drop_stampede: {
      executor: "per-vu-iterations",
      vus: 200,
      iterations: 1,
      maxDuration: "2m",
    },
  },
};

function extractActionField(html) {
  const match = html.match(/\$ACTION_ID_[a-f0-9]+/);
  return match ? match[0] : null;
}

function buildMultipartBody(fields) {
  const boundary = "----k6boundary" + Math.random().toString(16).slice(2);
  const parts = [];
  for (const key of Object.keys(fields)) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${fields[key]}\r\n`,
    );
  }
  parts.push(`--${boundary}--\r\n`);
  return { body: parts.join(""), contentType: `multipart/form-data; boundary=${boundary}` };
}

export default function checkoutAttempt() {
  const email = `k6-${__VU}-${__ITER}-${Date.now()}@example.com`;

  // 1. View the product page.
  const dropRes = http.get(`${BASE_URL}/drops/${PRODUCT_SLUG}`);
  dropPageDuration.add(dropRes.timings.duration);
  check(dropRes, { "drop page: 200": (r) => r.status === 200 });

  // 2. Check live stock (what <ProductBuyBox> polls client-side).
  const stockRes = http.get(`${BASE_URL}/api/stock?variantIds=${VARIANT_ID}`);
  stockCheckDuration.add(stockRes.timings.duration);
  check(stockRes, { "stock check: 200": (r) => r.status === 200 });

  // 3. Load the checkout page and extract the Server Action's field name
  //    -- Next.js's progressive-enhancement form protocol requires this
  //    exact multipart field (see README's checkout curl recipe).
  const checkoutUrl = `${BASE_URL}/checkout?variant=${VARIANT_ID}&qty=1`;
  const checkoutPageRes = http.get(checkoutUrl);
  checkoutPageDuration.add(checkoutPageRes.timings.duration);
  const actionField = extractActionField(checkoutPageRes.body);
  const gotActionField = check(checkoutPageRes, {
    "checkout page: 200": (r) => r.status === 200,
    "checkout page: action field found": () => actionField !== null,
  });
  if (!gotActionField) {
    unexpected.add(1);
    return;
  }

  // 4. Submit the checkout -- the core measured step. This is what
  //    invokes reserve_stock_and_create_order() server-side.
  const fields = {
    [actionField]: "",
    variantId: VARIANT_ID,
    quantity: "1",
    email,
    shippingName: "K6 Load Test",
    shippingAddressLine1: "1 Load Test St",
    shippingAddressLine2: "",
    shippingCity: "Doha",
    shippingCountry: "Qatar",
    shippingPostalCode: "",
    note: "",
  };
  const { body, contentType } = buildMultipartBody(fields);

  const submitRes = http.post(checkoutUrl, body, {
    headers: { "Content-Type": contentType },
    redirects: 0,
  });
  checkoutSubmitDuration.add(submitRes.timings.duration);

  const location = submitRes.headers["Location"] || submitRes.headers["location"] || "";
  const gotRedirect = check(submitRes, {
    "checkout submit: got a redirect": (r) => r.status === 303,
  });

  if (!gotRedirect) {
    unexpected.add(1);
  } else if (location.includes("/checkout/mock/")) {
    reserved.add(1);
  } else if (location.includes("error=insufficient_stock")) {
    soldOut.add(1);
  } else {
    unexpected.add(1);
  }
}

export function handleSummary(data) {
  const p95 = (name) => data.metrics[name]?.values["p(95)"];
  const count = (name) => data.metrics[name]?.values.count ?? 0;

  const lines = [
    "",
    "=== Checkout load test summary ===",
    `Virtual users: 200 (one checkout attempt each)`,
    "",
    "p95 latency by step (ms):",
    `  drop page (GET /drops/[slug]):        ${p95("drop_page_duration")?.toFixed(1)}`,
    `  live stock (GET /api/stock):          ${p95("stock_check_duration")?.toFixed(1)}`,
    `  checkout page (GET /checkout):        ${p95("checkout_page_duration")?.toFixed(1)}`,
    `  checkout submit (POST /checkout):     ${p95("checkout_submit_duration")?.toFixed(1)}`,
    "",
    "Outcomes:",
    `  reserved (got a size):     ${count("checkout_reserved")}`,
    `  sold out:                  ${count("checkout_sold_out")}`,
    `  unexpected:                ${count("checkout_unexpected_outcome")}`,
    "",
  ];

  return {
    stdout: lines.join("\n"),
    "load-test/summary.json": JSON.stringify(data, null, 2),
  };
}
