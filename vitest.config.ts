import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
    // Tests import server-only modules directly (route handlers, RPC
    // wrappers) to exercise them without a running server -- same
    // resolution condition Next's own server bundler uses, so
    // `import "server-only"` (the build-time client/server boundary
    // assertion, see lib/supabase/admin.ts) resolves to its no-op
    // variant here instead of throwing.
    conditions: ["react-server"],
  },
  ssr: {
    resolve: {
      conditions: ["react-server"],
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup-env.ts"],
    testTimeout: 30_000,
  },
});
