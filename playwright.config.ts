import { defineConfig, devices } from '@playwright/test';
import net from 'net';

// Function to find an available port
async function getAvailablePort(startPort = 3000): Promise<number> {
  const checkPort = (port: number): Promise<number | null> => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.listen(port, () => {
        server.once('close', () => resolve(port));
        server.close();
      });
      server.on('error', () => resolve(null));
    });
  };

  let port = startPort;
  while (port < 65535) {
    const available = await checkPort(port);
    if (available) return available;
    port++;
  }
  throw new Error('No available ports found');
}

const port = 3003; // Use a fixed port for now to debug

export default defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `PORT=${port} bun src/index.ts`,
    port: port,
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
});