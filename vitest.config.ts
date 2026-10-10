import { defineConfig } from "vitest/config";

// Vitest configuration for non-Vite project
// https://vitest.dev/config/
export default defineConfig({
  test: {
    globals: true, 
    environment: "node", 
    setupFiles: "./tests/setup.ts", 
    coverage: {
      provider: "v8", 
      reporter: ["text", "json", "html"],
    },
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".vercel", "dist"],
  },
});