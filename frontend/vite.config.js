import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Check for HTTPS certificates in project root
// When running from frontend directory, go up one level to project root
const projectRoot = path.resolve(process.cwd(), '..');
const certPath = path.join(projectRoot, 'cert.pem');
const keyPath = path.join(projectRoot, 'key.pem');

const hasCertificates = fs.existsSync(certPath) && fs.existsSync(keyPath);
const httpsConfig = hasCertificates
  ? {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    }
  : false;

// Custom plugin to show startup banner
const startupBanner = () => {
  return {
    name: 'startup-banner',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const address = server.httpServer?.address();
        if (address && typeof address === 'object') {
          const protocol = hasCertificates ? 'https' : 'http';
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
          
          console.log('\n' + '='.repeat(60));
          console.log('  Frontend Development Server');
          console.log('='.repeat(60));
          console.log(`✅ Server running`);
          console.log(`   Port: ${address.port}`);
          console.log(`   Local:  ${protocol}://localhost:${address.port}`);
          if (localIP !== 'localhost') {
            console.log(`   Network: ${protocol}://${localIP}:${address.port}`);
          }
          console.log(`   Protocol: ${protocol.toUpperCase()}`);
          console.log('-'.repeat(60));
        }
      });
    }
  };
};

export default defineConfig({
  plugins: [react(), startupBanner()],
  server: {
    host: '0.0.0.0', // Allow access from network
    port: 3000,
    https: httpsConfig,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
        secure: false, // Allow self-signed certs
        rewrite: (path) => path, // Don't rewrite the path
        configure: (proxy, _options) => {
          // Only log errors, not every connection
          proxy.on('error', (err, _req, _res) => {
            console.error('❌ [Vite Proxy] Socket.io error:', err.message);
          });
          proxy.on('proxyReqWs', (proxyReq, req, socket) => {
            // Ensure WebSocket headers are set correctly
            proxyReq.setHeader('Origin', 'http://localhost:4000');
            proxyReq.setHeader('Host', 'localhost:4000');
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
