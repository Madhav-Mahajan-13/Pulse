import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test/browser",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node examples/basic-app.mjs",
    url: "http://127.0.0.1:3100/nodepulse",
    env: { PORT: "3100", NODEPULSE_BUCKET_SIZE_SECONDS: "1" },
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
