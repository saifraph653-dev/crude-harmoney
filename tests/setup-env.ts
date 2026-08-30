import { config } from "dotenv";

// Local dev / CI: DB and Supabase connection details live in .env.local,
// same file Next.js itself reads. Never loaded in production builds.
// `quiet` suppresses dotenv's own stdout ad/tip banner (a "feature" of
// dotenv >=17, see node_modules/dotenv/lib/main.js) -- not a secret leak,
// just noise we don't want in test output.
config({ path: ".env.local", quiet: true });
