import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import os from 'os';

// Custom plugin to show startup info
const startupBanner = () => {
  return {
    name: 'startup-banner',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const address = server.httpServer?.address();
        if (address && typeof address === 'object') {
          const localIP = (() => {
            const interfaces = os.networkInterfaces();
            for (const name of Object.keys(interfaces)) {
              for (const iface of interfaces[name] || []) {
                if (iface.family === 'IPv4' && !iface.internal) {
                  return iface.address;
                }
              }
            }
            return 'localhost';
          })();

          console.log(
            `Frontend: http://localhost:${address.port} | http://${localIP}:${address.port}`,
          );
        }
      });
    },
  };
};

export default defineConfig({
  plugins: [react(), startupBanner()],
  server: {
    host: '0.0.0.0', // Allow access from network
    port: 3000,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
