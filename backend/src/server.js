import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { Server } from 'socket.io';
import app from './app.js';
import screenshotMonitorService from './services/screenshot-monitor.service.js';
import clipboardMonitorService from './services/clipboard-monitor.service.js';
import streamHandler from './sockets/streamHandler.js';
import DataHandler from './sockets/dataHandler.js';
import imageProcessingService from './services/image-processing.service.js';
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
  try {
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };

    httpsServer = https.createServer(httpsOptions, app);

    // Add error handlers for HTTPS
    httpsServer.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(
          `\n❌ Port ${CONFIG.HTTPS_PORT} is already in use. Please stop the other process or change HTTPS_PORT in .env\n`,
        );
      } else {
        console.error('\n❌ HTTPS server error:', error.message);
      }
    });

    httpsServer.on('clientError', (err, socket) => {
      // Handle SSL/TLS errors gracefully
      if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
        // Client disconnected, ignore
        return;
      }
      console.error('HTTPS client error:', err.message);
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });

    httpsServer.listen(CONFIG.HTTPS_PORT, '0.0.0.0', () => {
      const localIP = getLocalIP();
      console.log(`\n✅ HTTPS server is running!`);
      console.log(
        `📱 Access from MacBook: https://localhost:${CONFIG.HTTPS_PORT}`,
      );
      console.log(
        `📱 Access from iPhone: https://${localIP}:${CONFIG.HTTPS_PORT}`,
      );
      console.log(
        `\n⚠️  iPhone Access Instructions:\n` +
          `   1. Open Safari on your iPhone\n` +
          `   2. Go to: https://${localIP}:${CONFIG.HTTPS_PORT}\n` +
          `   3. You'll see a security warning - tap "Show Details" or "Advanced"\n` +
          `   4. Tap "Visit Website" or "Proceed to ${localIP}"\n` +
          `   5. If page keeps reloading:\n` +
          `      - Clear Safari cache: Settings → Safari → Clear History\n` +
          `      - Try HTTP instead: http://${localIP}:${CONFIG.PORT}\n` +
          `      - Or use Chrome/Firefox on iPhone\n`,
      );
    });
  } catch (error) {
    console.error('\n❌ Failed to start HTTPS server:', error.message);
    console.error(
      '   Make sure cert.pem and key.pem are valid SSL certificates.\n',
    );
  }
} else {
  console.log(
    `\n⚠️  HTTPS certificates not found (cert.pem, key.pem).\n` +
      `   HTTPS server will not start. Run './generate-cert.js' to generate certificates.\n` +
      `   HTTP server will still be available on port ${CONFIG.PORT}.\n`,
  );
}

// HTTP server
httpServer = http.createServer(app);

// Initialize Socket.io for HTTP server
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Initialize Socket.io for HTTPS server (if available)
let ioHttps = null;
if (httpsServer) {
  ioHttps = new Server(httpsServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });
}

// Setup WebSocket handlers for both HTTP and HTTPS
new streamHandler(io);
if (ioHttps) {
  new streamHandler(ioHttps);
}

// Setup data update handlers for both HTTP and HTTPS
const dataHandler = new DataHandler(io);
if (ioHttps) {
  const dataHandlerHttps = new DataHandler(ioHttps);
  // Set both handlers - the service will notify all
  imageProcessingService.setDataHandlers([dataHandler, dataHandlerHttps]);
} else {
  imageProcessingService.setDataHandlers([dataHandler]);
}

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
