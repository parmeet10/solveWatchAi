import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import screenshotMonitorService from './services/screenshot-monitor.service.js';
import TextStreamHandler from './sockets/textStreamHandler.js';
import DataHandler from './sockets/dataHandler.js';
import imageProcessingService from './services/image-processing.service.js';
import { CONFIG, getLocalIP } from './config/constants.js';
import logger from './utils/logger.js';

const log = logger('Server');

// Initialize services
try {
  screenshotMonitorService.start();
  log.debug('Screenshot monitoring service started');
} catch (error) {
  log.error('Failed to start screenshot monitoring service', error);
}

// HTTP server
const httpServer = http.createServer(app);

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket'],
  allowEIO3: true,
});

// Setup WebSocket handlers
new TextStreamHandler(io);
const dataHandler = new DataHandler(io);
imageProcessingService.setDataHandlers([dataHandler]);

httpServer.listen(CONFIG.PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  log.info('Server started');
  log.info(
    `API: http://localhost:${CONFIG.PORT} | http://${localIP}:${CONFIG.PORT}`,
  );
  log.info(
    `WebSocket: ws://localhost:${CONFIG.PORT}/text-stream | ws://${localIP}:${CONFIG.PORT}/text-stream`,
  );
  log.info(
    `Data Updates: ws://localhost:${CONFIG.PORT}/data-updates | ws://${localIP}:${CONFIG.PORT}/data-updates`,
  );
});

// Graceful shutdown handlers
const gracefulShutdown = () => {
  log.info('Shutting down...');
  screenshotMonitorService.stop && screenshotMonitorService.stop();

  if (httpServer) {
    httpServer.close(() => {
      log.info('Server closed');
      process.exit(0);
    });
  }

  setTimeout(() => {
    log.warn('Force exit');
    process.exit(1);
  }, 5000);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
