import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build/test config files — not application code
    "vitest.config.ts",
    // Deno Edge Functions — different runtime, different lint rules
    "supabase/functions/**",
    // Generated file — UTF-16 encoded by Supabase CLI, not parseable by ESLint
    "types/supabase.ts",
  ]),
]);

export default eslintConfig;
