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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-5 py-24 sm:px-6">
      <p className="eyebrow">404</p>
      <h1 className="display mt-4">
        Nothing here,
        <br />
        <span className="serif italic">try the collection.</span>
      </h1>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link href="/drops" className="btn-primary">
          See the collection
        </Link>
        <Link href="/" className="btn-ghost">
          Home
        </Link>
      </div>
    </main>
  );
}
