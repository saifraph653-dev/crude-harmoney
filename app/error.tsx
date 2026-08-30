"use client";

import { useEffect } from "react";

// Custom, not Next's built-in error UI -- see app/not-found.tsx for why
// (inline style attributes conflict with a strict nonce-based CSP).
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="section-title">Something went wrong</h1>
      <p className="text-muted">Please try again.</p>
      <button onClick={() => retry()} className="mt-2 underline">
        Try again
      </button>
    </main>
  );
}
