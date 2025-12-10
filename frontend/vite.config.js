import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

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

if (hasCertificates) {
  console.log('✅ HTTPS certificates found - Vite will serve over HTTPS');
} else {
  console.log('⚠️  HTTPS certificates not found - Vite will serve over HTTP');
  console.log(`   Looking for certificates at: ${certPath} and ${keyPath}`);
}

export default defineConfig({
  plugins: [react()],
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
          proxy.on('error', (err, _req, _res) => {
            console.error('[Vite Proxy] Socket.io proxy error:', err.message);
            console.error('[Vite Proxy] Error details:', err);
          });
          proxy.on('proxyReqWs', (proxyReq, req, socket) => {
            console.log('[Vite Proxy] Socket.io WebSocket upgrade:', req.url);
            // Ensure WebSocket headers are set correctly
            proxyReq.setHeader('Origin', 'http://localhost:4000');
          });
          proxy.on('open', (proxySocket) => {
            console.log('[Vite Proxy] Socket.io proxy connection opened');
          });
          proxy.on('close', (res, socket, head) => {
            console.log('[Vite Proxy] Socket.io proxy connection closed');
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
