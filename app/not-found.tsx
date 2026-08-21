import { connection } from "next/server";
import Link from "next/link";

// Custom, not Next's built-in 404 -- the default one renders an inline
// `style="..."` attribute, which a strict nonce-based CSP with no
// unsafe-inline can't allow (nonces don't cover inline style/script
// attributes, only <script>/<style> tags carrying a matching nonce).
// Forced dynamic (connection()) so the CSP nonce (proxy.ts) reaches this
// page's own script tags too -- see app/drops/page.tsx.
export const instant = false;

export default async function NotFound() {
  await connection();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-zinc-500">That page doesn&apos;t exist.</p>
      <Link href="/" className="mt-2 underline">
        Back home
      </Link>
    </main>
  );
}
