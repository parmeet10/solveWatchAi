import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { Server } from 'socket.io';
import app from './app.js';
import screenshotMonitorService from './services/screenshot-monitor.service.js';
import clipboardMonitorService from './services/clipboard-monitor.service.js';
import streamHandler from './sockets/streamHandler.js';
import { CONFIG, getLocalIP } from './config/constants.js';

// Start screenshot monitoring
screenshotMonitorService.start();

// Start clipboard monitoring
clipboardMonitorService.start();

// Try to enable HTTPS for Speech Recognition API
const certPath = path.join(process.cwd(), 'cert.pem');
const keyPath = path.join(process.cwd(), 'key.pem');

let httpServer;
let httpsServer;

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };

  httpsServer = https.createServer(httpsOptions, app);
  httpsServer.listen(CONFIG.HTTPS_PORT, '0.0.0.0', () => {
    console.log(`\n✅ HTTPS server is running!`);
    console.log(
      `📱 Access from MacBook: https://localhost:${CONFIG.HTTPS_PORT}`,
    );
    console.log(
      `📱 Access from iPhone: https://${getLocalIP()}:${CONFIG.HTTPS_PORT}`,
    );
    console.log(
      `⚠️  Note: You may see a security warning. Click "Advanced" and "Proceed anyway" (it's safe - self-signed cert).\n`,
    );
  });
}

// HTTP server
httpServer = http.createServer(app);

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Setup WebSocket handlers
new streamHandler(io);

httpServer.listen(CONFIG.PORT, '0.0.0.0', () => {
  console.log(`\n✅ HTTP server is running!`);
  console.log(`📱 Access from MacBook: http://localhost:${CONFIG.PORT}`);
  console.log(
    `📱 Access from external device: http://${getLocalIP()}:${CONFIG.PORT}`,
  );
  console.log(`\nMake sure both devices are on the same WiFi network.\n`);
});

// Graceful shutdown handlers
const gracefulShutdown = () => {
  console.log('\n🛑 Shutting down gracefully...');
  clipboardMonitorService.stop();
  screenshotMonitorService.stop && screenshotMonitorService.stop();

  if (httpServer) {
    httpServer.close(() => {
      console.log('✅ HTTP server closed');
      process.exit(0);
    });
  }

  if (httpsServer) {
    httpsServer.close(() => {
      console.log('✅ HTTPS server closed');
      process.exit(0);
    });
  }

  // Force exit after 5 seconds
  setTimeout(() => {
    console.log('⚠️  Forcing exit...');
    process.exit(1);
  }, 5000);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
