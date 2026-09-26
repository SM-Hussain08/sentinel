import {
  defineConfig,
  devices,
} from "@playwright/test";


const baseURL =
  process.env.SENTINEL_E2E_BASE_URL
  ?? "http://127.0.0.1:18080";


export default defineConfig({
  testDir: "./e2e",

  fullyParallel: false,

  workers: 1,

  forbidOnly: Boolean(
    process.env.CI,
  ),

  retries:
    process.env.CI
      ? 2
      : 0,

  timeout: 30_000,

  expect: {
    timeout: 10_000,
  },

  reporter: [
    [
      "list",
    ],
    [
      "html",
      {
        outputFolder: "playwright-report",
        open: "never",
      },
    ],
  ],

  use: {
    baseURL,

    trace: "retain-on-failure",

    screenshot: "only-on-failure",

    video: "retain-on-failure",
  },

  outputDir:
    "test-results",

  projects: [
    {
      name: "chromium",

      use: {
        ...devices[
          "Desktop Chrome"
        ],
      },
    },
  ],
});