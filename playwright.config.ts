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
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        headless: true, // Always headless in CI
        launchOptions: {
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-zygote", // Critical: bypass zygote process that fails in systemd
            "--single-process", // Run in single process mode
            "--disable-web-security",
            "--disable-features=IsolateOrigins,site-per-process",
            "--disable-blink-features=AutomationControlled",
          ],
          // Add timeout for slow launches
          timeout: 30000,
        },
      },
    },
    // Firefox as fallback
    // {
    //   name: "firefox",
    //   use: {
    //     ...devices["Desktop Firefox"],
    //     headless: process.env.CI ? true : undefined,
    //   },
    // },
  ],

  webServer: {
    command: `bun run build:client && PORT=${port} SLIPBOX_DATA_DIR=./test-data bun src/index.ts`,
    port: port,
    reuseExistingServer: !process.env.CI,
    timeout: 20000,
  },
});
