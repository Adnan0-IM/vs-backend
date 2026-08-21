import { defineConfig } from "vitest/config";

// Vitest configuration for non-Vite project
// https://vitest.dev/config/
export default defineConfig({
  test: {
    globals: true, // Enable global test variables like `describe`, `test`, `expect`
    environment: "node", // Use Node.js environment
    setupFiles: "./tests/setup.ts", // Setup file for global test configuration
    coverage: {
      provider: "v8", // or 'istanbul'
      reporter: ["text", "json", "html"],
    },
    // Test file patterns
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".vercel", "dist"],
  },
});