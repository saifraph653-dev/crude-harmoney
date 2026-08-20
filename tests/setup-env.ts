import { config } from "dotenv";

// Local dev / CI: DB and Supabase connection details live in .env.local,
// same file Next.js itself reads. Never loaded in production builds.
config({ path: ".env.local" });
