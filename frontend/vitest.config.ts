import {
  defineConfig,
} from "vitest/config";

import react from "@vitejs/plugin-react";


export default defineConfig({
  plugins: [
    react(),
  ],

  test: {
    environment: "jsdom",

    setupFiles: [
      "./src/test/setup.ts",
    ],

    include: [
      "src/**/*.test.{ts,tsx}",
    ],

    clearMocks: true,
    restoreMocks: true,
    mockReset: true,

    coverage: {
      provider: "v8",

      reporter: [
        "text",
        "html",
        "json-summary",
      ],

      include: [
        "src/**/*.{ts,tsx}",
      ],

      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/main.tsx",
        "src/**/*.d.ts",
        "src/types/**",
      ],

      thresholds: {
        statements: 90,
        branches: 80,
        functions: 90,
        lines: 90,
      },
    },
  },
});
