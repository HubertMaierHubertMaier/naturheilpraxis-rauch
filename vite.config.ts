import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Public, client-safe fallback values for the Supabase publishable config.
// These are NOT secrets — the anon/publishable key and project URL are designed
// to be exposed in the browser bundle. They exist only to prevent the production
// bundle from being built with `undefined` (which causes a hard crash in
// `createClient` and a blank white page) if the build environment ever lacks
// the VITE_SUPABASE_* variables. See doc/20260607-white-page-after-phase-4-merge-analysis-pr-4.md
const FALLBACK_SUPABASE_URL = "https://jmebqjadlpltnqawoipb.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptZWJxamFkbHBsdG5xYXdvaXBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NjkwNTcsImV4cCI6MjA4NDI0NTA1N30.l9fm-vpCmz2FUOCxTV7amUP-IE11InHgJHA9hDdRmzY";
const FALLBACK_SUPABASE_PROJECT_ID = "jmebqjadlpltnqawoipb";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const supabasePublishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY;
  const supabaseProjectId =
    env.VITE_SUPABASE_PROJECT_ID || FALLBACK_SUPABASE_PROJECT_ID;

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        supabasePublishableKey,
      ),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(supabaseProjectId),
    },
  };
});
