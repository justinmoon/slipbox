import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Function to find an available port
async function _getAvailablePort(startPort = 3000): Promise<number> {
  const checkPort = (port: number): Promise<number | null> => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.listen(port, () => {
        server.once("close", () => resolve(port));
        server.close();
      });
      server.on("error", () => resolve(null));
    });
  };

  let port = startPort;
  while (port < 65535) {
    const available = await checkPort(port);
    if (available) return available;
    port++;
  }
  throw new Error("No available ports found");
}

const port = 3003; // Use a fixed port for now to debug

function resolveHeadlessShellExecutable(): string | undefined {
  // Prefer explicit override if provided
  if (
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH &&
    fs.existsSync(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)
  ) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !fs.existsSync(base)) return undefined;
  try {
    const entries = fs.readdirSync(base, { withFileTypes: true });
    const candidates = entries
      .filter(
        (e) =>
          e.isDirectory() &&
          (e.name.startsWith("chromium_headless_shell-") ||
            e.name.startsWith("chromium-headless-shell-")),
      )
      .map((e) => path.join(base, e.name, "chrome-linux", "headless_shell"));
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  } catch {}
  return undefined;
}

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
        headless: process.env.CI ? true : undefined,
        launchOptions: (() => {
          const exe = resolveHeadlessShellExecutable();
          return exe
            ? {
                executablePath: exe,
                args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
              }
            : {
                args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
              };
        })(),
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
