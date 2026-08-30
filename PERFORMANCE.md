# Performance

## Measured, on the production build

Rendered locally against a stand-in database, throttled to a slow mobile
connection (1.6 Mbps, 150 ms RTT) with a 4× CPU slowdown:

| | |
|---|---|
| TTFB | 8 ms (local server; not representative of production) |
| First Contentful Paint | 744 ms |
| DOMContentLoaded | 517 ms |
| Load | 1,853 ms |
| CLS | 0 |

Client JavaScript is 625 KB across all chunks after removing Zod from the
browser bundle (it was 902 KB). Fonts are two files, ~49 KB.

So the client is not what makes the site feel slow.

## Why it feels slow in Doha: the site renders in Washington DC

`crudeharmony.com` responds with `x-vercel-id: iad1` — Vercel's US East
region. Doha to Washington DC is roughly 11,000 km, and the round trip
includes a TCP and TLS handshake before the first byte of HTML.

That cost is paid on **every navigation**, because every page is
dynamically rendered. The CSP is nonce-based (see `proxy.ts`), a fresh
nonce per request cannot be baked into a static shell, so Partial
Prerendering is off for every route and nothing is served from the CDN
edge near the customer.

Two levers, in order of impact:

**1. Move the serverless region.** `vercel.json` sets no `regions`, so
Vercel defaults to `iad1`. Setting it to a region near both the customers
and the database would remove most of that distance.

This is deliberately not set here, because the right value depends on
where the Supabase project lives, and that is not visible from the
codebase — `NEXT_PUBLIC_SUPABASE_URL` never reaches the client bundle
(verified: zero occurrences of "supabase" in the deployed JavaScript, which
is the correct posture but does hide this). Setting a region far from the
database would move latency rather than remove it.

Check the Supabase project's region in its dashboard, then add the nearest
Vercel region — `fra1` (Frankfurt) for a European project, `bom1` (Mumbai)
for an Asian one:

```json
{ "regions": ["fra1"] }
```

**2. Serve a static shell.** This is the larger fix and it is a security
trade-off, not a bug: it means giving up the per-request CSP nonce so pages
can be prerendered and served from the edge. The nonce is what allows
`script-src` to run without `unsafe-inline`. Weakening it should be a
deliberate decision, not a performance tweak, so it has not been done here.
The trade-off is discussed in `SECURITY.md`.
