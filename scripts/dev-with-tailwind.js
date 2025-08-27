#!/usr/bin/env bun
import { spawn } from 'child_process';
import net from 'net';
import { existsSync, mkdirSync } from 'fs';

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
    // Ensure dist directory exists
    if (!existsSync('dist')) {
      mkdirSync('dist');
    }

    // Start Tailwind CSS watcher
    console.log('Starting Tailwind CSS watcher...');
    const tailwind = spawn('bunx', ['tailwindcss', '-i', './src/input.css', '-o', './dist/style.css', '--watch'], {
      stdio: 'inherit'
    });

    // Wait a moment for initial CSS build
    await new Promise(resolve => setTimeout(resolve, 2000));

    const port = await getAvailablePort();
    console.log(`Starting server on port ${port}...`);
    
    // Start the server with the found port
    const server = spawn('bun', ['--watch', 'src/index.ts'], {
      env: { ...process.env, PORT: port.toString() },
      stdio: 'inherit'
    });

    // Wait a moment for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Open browser
    const url = `http://localhost:${port}`;
    console.log(`Opening ${url} in browser...`);
    
    const openCommand = process.platform === 'darwin' ? 'open' :
                       process.platform === 'win32' ? 'start' : 'xdg-open';
    
    spawn(openCommand, [url], { detached: true });

    // Handle exit
    process.on('SIGINT', () => {
      tailwind.kill();
      server.kill();
      process.exit();
    });

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();