import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";
import nextConfig from "@/next.config";

describe("Content-Security-Policy (proxy.ts)", () => {
  function runProxy(path = "/drops") {
    return proxy(new NextRequest(`http://localhost${path}`));
  }

  it("sets a CSP header with a nonce-based, non-unsafe-inline script-src", () => {
    const res = runProxy();
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toBeTruthy();
    expect(csp).toMatch(/script-src [^;]*'nonce-[A-Za-z0-9+/=]+'/);
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    // Directive-scoped: 'unsafe-inline' appears only in style-src, a
    // deliberate, narrow, documented exception (see proxy.ts) -- assert
    // it specifically does NOT appear in script-src.
    const scriptSrcDirective = csp?.match(/script-src [^;]+/)?.[0] ?? "";
    expect(scriptSrcDirective).not.toContain("unsafe-inline");
  });

  it("includes frame-ancestors 'none' and base-uri 'self'", () => {
    const csp = runProxy().headers.get("Content-Security-Policy");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("generates a fresh nonce on every request", () => {
    const csp1 = runProxy().headers.get("Content-Security-Policy");
    const csp2 = runProxy().headers.get("Content-Security-Policy");
    const nonce1 = csp1?.match(/nonce-([A-Za-z0-9+/=]+)/)?.[1];
    const nonce2 = csp2?.match(/nonce-([A-Za-z0-9+/=]+)/)?.[1];
    expect(nonce1).toBeTruthy();
    expect(nonce1).not.toBe(nonce2);
  });

  it("generates a well-formed base64 nonce", () => {
    // Whether Next actually threads this into every script tag isn't
    // observable from a unit-level proxy() call (that requires a real
    // render pass) -- verified empirically instead by curling every
    // route with a live server and diffing each <script>'s nonce
    // attribute against the response header's nonce (0 mismatches
    // across every route, including error/not-found pages). See the
    // "no unsafe-inline" section of SECURITY.md for that verification
    // procedure.
    const csp = runProxy().headers.get("Content-Security-Policy");
    const nonce = csp?.match(/nonce-([A-Za-z0-9+/=]+)/)?.[1];
    expect(nonce).toMatch(/^[A-Za-z0-9+/=]{20,}$/);
  });
});

describe("Static security headers (next.config.ts)", () => {
  async function getHeaderRules() {
    const headersFn = nextConfig.headers;
    if (!headersFn) throw new Error("next.config.ts has no headers() function");
    const rules = await headersFn();
    const catchAll = rules.find((r) => r.source === "/(.*)");
    if (!catchAll) throw new Error("no catch-all header rule found");
    return Object.fromEntries(catchAll.headers.map((h) => [h.key, h.value]));
  }

  it("sets HSTS with includeSubDomains and preload", async () => {
    const headers = await getHeaderRules();
    expect(headers["Strict-Transport-Security"]).toContain("includeSubDomains");
    expect(headers["Strict-Transport-Security"]).toContain("preload");
  });

  it("sets X-Content-Type-Options: nosniff", async () => {
    const headers = await getHeaderRules();
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("sets Referrer-Policy: strict-origin-when-cross-origin", async () => {
    const headers = await getHeaderRules();
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("sets Permissions-Policy denying camera, microphone, geolocation", async () => {
    const headers = await getHeaderRules();
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["Permissions-Policy"]).toContain("microphone=()");
    expect(headers["Permissions-Policy"]).toContain("geolocation=()");
  });

  it("sets X-Frame-Options: DENY", async () => {
    const headers = await getHeaderRules();
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });
});
