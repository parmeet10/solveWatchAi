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
import logger from './utils/logger.js';

const log = logger('Server');

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
        log.error(
          `Port ${CONFIG.HTTPS_PORT} is already in use. Please stop the other process or change HTTPS_PORT in .env`,
        );
      } else {
        log.error('HTTPS server error', error);
      }
    });

    httpsServer.on('clientError', (err, socket) => {
      // Handle SSL/TLS errors gracefully
      if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
        // Client disconnected, ignore
        return;
      }
      log.warn('HTTPS client error', { error: err.message });
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });

    httpsServer.listen(CONFIG.HTTPS_PORT, '0.0.0.0', () => {
      const localIP = getLocalIP();
      log.info(`HTTPS server is running on port ${CONFIG.HTTPS_PORT}`);
      log.info(`Access from MacBook: https://localhost:${CONFIG.HTTPS_PORT}`);
      log.info(`Access from iPhone: https://${localIP}:${CONFIG.HTTPS_PORT}`);
    });
  } catch (error) {
    log.error('Failed to start HTTPS server', error);
  }
} else {
  log.warn(
    'HTTPS certificates not found (cert.pem, key.pem). HTTPS server will not start. Run "./generate-cert.js" to generate certificates.',
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
  const localIP = getLocalIP();
  log.info(`HTTP server is running on port ${CONFIG.PORT}`);
  log.info(`Access from MacBook: http://localhost:${CONFIG.PORT}`);
  log.info(`Access from external device: http://${localIP}:${CONFIG.PORT}`);
});

// Graceful shutdown handlers
const gracefulShutdown = () => {
  log.info('Shutting down gracefully...');
  clipboardMonitorService.stop();
  screenshotMonitorService.stop && screenshotMonitorService.stop();

  if (httpServer) {
    httpServer.close(() => {
      log.info('HTTP server closed');
      process.exit(0);
    });
  }

  if (httpsServer) {
    httpsServer.close(() => {
      log.info('HTTPS server closed');
      process.exit(0);
    });
  }

  // Force exit after 5 seconds
  setTimeout(() => {
    log.warn('Forcing exit...');
    process.exit(1);
  }, 5000);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
