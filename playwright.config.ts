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

export default defineConfig({
  testDir: './tests',
  testIgnore: '**/worktrees/**',
  timeout: 60 * 1000, // Increased timeout for tests with setup
  expect: {
    timeout: 10000  // Increased expect timeout
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'list' : [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `bun run build:client && NODE_ENV=development PORT=3000 SLIPBOX_DATA_DIR=./test-data bun src/index.ts`,
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 20000,
  },
});