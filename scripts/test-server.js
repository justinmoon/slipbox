#!/usr/bin/env bun
import { spawn } from 'child_process';
import net from 'net';

// Find an available port
async function getAvailablePort(startPort = 3000) {
  const checkPort = (port) => {
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

// Main
async function main() {
  try {
    const port = await getAvailablePort();
    console.log(`Starting test server on port ${port}...`);
    
    // Start the server with the found port
    const server = spawn('bun', ['src/index.ts'], {
      env: { ...process.env, PORT: port.toString() },
      stdio: 'inherit'
    });

    // Handle exit
    process.on('SIGINT', () => {
      server.kill();
      process.exit();
    });

    process.on('SIGTERM', () => {
      server.kill();
      process.exit();
    });

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();