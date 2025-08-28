import { test as base } from "@playwright/test";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawn, ChildProcess } from "child_process";
import net from "net";

// Find an available port - use random starting point to avoid conflicts
async function getAvailablePort(): Promise<number> {
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

  // Start with a random port between 4000-8000 to avoid conflicts
  const startPort = Math.floor(Math.random() * 4000) + 4000;

  for (let port = startPort; port < 65535; port++) {
    const available = await checkPort(port);
    if (available) return available;
  }

  // If we couldn't find a port in the high range, try lower
  for (let port = 3000; port < startPort; port++) {
    const available = await checkPort(port);
    if (available) return available;
  }

  throw new Error("No available ports found");
}

export interface TestContext {
  tmpDir: string;
  serverUrl: string;
  serverProcess: ChildProcess;
}

export const test = base.extend<{
  testContext: TestContext;
}>({
  testContext: async ({}, use) => {
    // Create a temporary directory for this test
    const tmpDir = mkdtempSync(join(tmpdir(), "slipbox-test-"));
    console.log("Using temp directory:", tmpDir);

    // Get an available port
    const port = await getAvailablePort();
    const serverUrl = `http://localhost:${port}`;

    // Start the server with the temp directory
    const serverProcess = spawn("bun", ["src/index.ts"], {
      env: {
        ...process.env,
        SLIPBOX_DATA_DIR: tmpDir,
        PORT: port.toString(),
        NODE_ENV: "test",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Wait for server to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        serverProcess.kill();
        reject(new Error("Server failed to start within timeout"));
      }, 20000); // Increased timeout

      const checkServer = async () => {
        try {
          const response = await fetch(serverUrl);
          if (response.ok || response.status === 404) {
            // Accept 404 as server is running
            clearTimeout(timeout);
            clearInterval(interval);
            console.log(`Server ready at ${serverUrl}`);
            resolve();
          }
        } catch (e) {
          // Server not ready yet
        }
      };

      const interval = setInterval(checkServer, 200); // Check less frequently

      // Log server output for debugging
      serverProcess.stdout?.on("data", (data) => {
        console.log("Server:", data.toString());
      });

      serverProcess.stderr?.on("data", (data) => {
        console.error("Server error:", data.toString());
      });

      serverProcess.on("error", (err) => {
        clearTimeout(timeout);
        clearInterval(interval);
        reject(err);
      });
    });

    // Use the test context
    await use({
      tmpDir,
      serverUrl,
      serverProcess,
    });

    // Cleanup
    serverProcess.kill();

    // Wait a bit for the process to fully exit
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Remove the temp directory
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      console.error("Failed to remove temp directory:", e);
    }
  },
});
