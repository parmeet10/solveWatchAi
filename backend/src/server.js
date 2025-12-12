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

// Startup banner
const printStartupBanner = () => {
  const banner = `
╔══════════════════════════════════════════════════════════════╗
║                  SolveWatchAI Server Starting                ║
╚══════════════════════════════════════════════════════════════╝
`;
  console.log(banner);
  log.info('='.repeat(60));
  log.info('Server initialization started');
  log.info('='.repeat(60));

  // Environment info
  log.info('Environment Information', {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    env: process.env.NODE_ENV || 'development',
  });

  // Configuration summary
  log.info('Configuration', {
    httpPort: CONFIG.PORT,
    httpsPort: CONFIG.HTTPS_PORT,
    pythonServiceUrl: CONFIG.PYTHON_SERVICE_URL,
    pythonServiceWsUrl: CONFIG.PYTHON_SERVICE_WS_URL,
    uploadDir: CONFIG.UPLOAD_DIR,
    screenshotsPath: CONFIG.SCREENSHOTS_PATH,
  });

  log.info('─'.repeat(60));
};

// Print startup banner
printStartupBanner();

// Initialize services
log.info('Initializing services...');

// Start screenshot monitoring
try {
  screenshotMonitorService.start();
  log.info('✅ Screenshot monitoring service started');
} catch (error) {
  log.error('❌ Failed to start screenshot monitoring service', error);
}

// Start clipboard monitoring
try {
  clipboardMonitorService.start();
  log.info('✅ Clipboard monitoring service started');
} catch (error) {
  log.error('❌ Failed to start clipboard monitoring service', error);
}

// Initialize servers
log.info('─'.repeat(60));
log.info('Initializing servers...');

// Try to enable HTTPS for Speech Recognition API
const certPath = path.join(process.cwd(), 'cert.pem');
const keyPath = path.join(process.cwd(), 'key.pem');

let httpServer;
let httpsServer;

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  try {
    log.info('📜 HTTPS certificates found, initializing HTTPS server...');
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };

    httpsServer = https.createServer(httpsOptions, app);

    // Add error handlers for HTTPS
    httpsServer.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        log.error(
          `❌ Port ${CONFIG.HTTPS_PORT} is already in use. Please stop the other process or change HTTPS_PORT in .env`,
        );
      } else {
        log.error('❌ HTTPS server error', error);
      }
    });

    httpsServer.on('clientError', (err, socket) => {
      // Handle SSL/TLS errors gracefully
      if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
        // Client disconnected, ignore
        return;
      }
      log.warn('⚠️  HTTPS client error', { error: err.message });
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });

    httpsServer.listen(CONFIG.HTTPS_PORT, '0.0.0.0', () => {
      const localIP = getLocalIP();
      log.info('─'.repeat(60));
      log.info('✅ HTTPS server is running');
      log.info(`   Port: ${CONFIG.HTTPS_PORT}`);
      log.info(`   Local:  https://localhost:${CONFIG.HTTPS_PORT}`);
      log.info(`   Network: https://${localIP}:${CONFIG.HTTPS_PORT}`);
      log.info('─'.repeat(60));
    });
  } catch (error) {
    log.error('❌ Failed to start HTTPS server', error);
  }
} else {
  log.warn('⚠️  HTTPS certificates not found (cert.pem, key.pem)');
  log.warn('   HTTPS server will not start');
  log.warn('   Run "./generate-cert.js" to generate certificates');
}

// HTTP server
log.info('Initializing HTTP server...');
httpServer = http.createServer(app);

// Initialize Socket.io for HTTP server
log.info('Setting up WebSocket connections...');
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket'], // WebSocket only, no polling
  allowEIO3: true, // Allow Engine.IO v3 clients
});
log.info('✅ Socket.io initialized for HTTP server');

// Initialize Socket.io for HTTPS server (if available)
let ioHttps = null;
if (httpsServer) {
  ioHttps = new Server(httpsServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket'], // WebSocket only, no polling
    allowEIO3: true, // Allow Engine.IO v3 clients
  });
  log.info('✅ Socket.io initialized for HTTPS server');
}

// Setup WebSocket handlers for both HTTP and HTTPS
log.info('Registering WebSocket handlers...');
new streamHandler(io);
if (ioHttps) {
  new streamHandler(ioHttps);
}
log.info('✅ Stream handler registered');

// Setup data update handlers for both HTTP and HTTPS
const dataHandler = new DataHandler(io);
if (ioHttps) {
  const dataHandlerHttps = new DataHandler(ioHttps);
  // Set both handlers - the service will notify all
  imageProcessingService.setDataHandlers([dataHandler, dataHandlerHttps]);
  log.info('✅ Data handlers registered for HTTP and HTTPS');
} else {
  imageProcessingService.setDataHandlers([dataHandler]);
  log.info('✅ Data handler registered for HTTP');
}

httpServer.listen(CONFIG.PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  log.info('─'.repeat(60));
  log.info('✅ HTTP server is running');
  log.info(`   Port: ${CONFIG.PORT}`);
  log.info(`   Local:  http://localhost:${CONFIG.PORT}`);
  log.info(`   Network: http://${localIP}:${CONFIG.PORT}`);
  log.info('─'.repeat(60));
  log.info('='.repeat(60));
  log.info('🚀 Server startup complete! All services are ready.');
  log.info('='.repeat(60));
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
