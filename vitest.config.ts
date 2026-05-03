import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    // forks pool fixes Windows worker-spawn timeouts in deep worktree paths
    pool: "forks",
    poolOptions: {
      forks: { singleFork: false },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    environment: "node",
    // Exclude Deno Edge Functions — they use https:// imports that Node can't resolve
    exclude: [
      "supabase/functions/**",
      "**/node_modules/**",
      "**/.next/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
