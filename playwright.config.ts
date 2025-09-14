import { defineConfig, devices } from "@playwright/test";

const port = 3003; // Use a fixed port for now

export default defineConfig({
  testDir: "./tests",
  timeout: 60 * 1000, // Increased timeout for tests with setup
  expect: {
    timeout: 10000, // Increased expect timeout
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "list" : [["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        headless: process.env.CI ? true : undefined,
      },
    },
    // Keep chromium as a fallback
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        headless: process.env.CI ? true : undefined,
      },
    },
  ],

  webServer: {
    command: `bun run build:client && PORT=${port} SLIPBOX_DATA_DIR=./test-data bun src/index.ts`,
    port: port,
    reuseExistingServer: !process.env.CI,
    timeout: 20000,
  },
});
