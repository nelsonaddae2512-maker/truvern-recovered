import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: "truvern-integration",
    environment: "node",
    globals: false,
    include: [
      "tests/integration/**/*.test.ts",
      "tests/integration/**/*.spec.ts",
    ],
    exclude: [
      "node_modules/**",
      ".next/**",
      "tools/atlas/output/generated-tests/**",
    ],
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    teardownTimeout: 30_000,
  },
});