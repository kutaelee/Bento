import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    mainFields: ["module", "main"],
  },
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
  },
});
