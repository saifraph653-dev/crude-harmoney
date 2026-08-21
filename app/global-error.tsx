"use client";

import "./globals.css";

// Custom, not Next's built-in global error UI -- same reason as
// app/not-found.tsx and app/error.tsx (no inline style attributes, to
// keep the CSP nonce-based with no unsafe-inline). global-error replaces
// the root layout entirely when it renders, so it needs its own
// <html>/<body> and its own import of the global stylesheet.
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-full flex-col">
        <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-zinc-500">Please try again.</p>
          <button onClick={() => retry()} className="mt-2 underline">
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
