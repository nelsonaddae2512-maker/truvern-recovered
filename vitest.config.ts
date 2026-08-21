import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    react(),
  ],
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
      "tests/**/*.spec.ts",
      "tests/**/*.spec.tsx",
    ],
    exclude: [
      "tests/integration/**",
      "node_modules/**",
      ".next/**",
      "tools/atlas/output/generated-tests/**",
    ],
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
