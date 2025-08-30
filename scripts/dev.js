#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import net from "node:net";

// Find an available port
async function getAvailablePort(startPort = 3000) {
  const checkPort = (port) => {
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

// Main
async function main() {
  try {
    // Assert we're in development mode
    if (process.env.NODE_ENV === "production") {
      console.error("❌ This is a development script and should not be run in production!");
      process.exit(1);
    }

    // Ensure dist directory exists
    if (!existsSync("dist")) {
      mkdirSync("dist");
    }

    // Start Tailwind CSS watcher
    console.log("Starting Tailwind CSS watcher...");
    const tailwind = spawn(
      "bunx",
      ["tailwindcss", "-i", "./src/input.css", "-o", "./dist/style.css", "--watch"],
      {
        stdio: "inherit",
      },
    );

    // Wait a moment for initial CSS build
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const port = await getAvailablePort();
    console.log(`\n${"=".repeat(50)}`);
    console.log(`🚀 Starting Slipbox server on port ${port}`);
    console.log(`${"=".repeat(50)}\n`);

    // Start the server with the found port
    const server = spawn("bun", ["--watch", "src/index.ts"], {
      env: { ...process.env, PORT: port.toString(), DEV_MODE: "true" },
      stdio: "inherit",
    });

    // Wait a moment for server to start
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // This is a dev script - always go to auto-login
    const url = `http://localhost:${port}/auto-login`;
    console.log(`\n📱 Browser opening: ${url}`);
    console.log(`${"=".repeat(50)}\n`);

    const openCommand =
      process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";

    spawn(openCommand, [url], { detached: true });

    // Show port periodically in dev mode
    const portReminder = setInterval(() => {
      console.log(`\n[Slipbox] Server running on http://localhost:${port}`);
    }, 30000); // Every 30 seconds

    // Handle exit
    process.on("SIGINT", () => {
      clearInterval(portReminder);
      tailwind.kill();
      server.kill();
      process.exit();
    });
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
