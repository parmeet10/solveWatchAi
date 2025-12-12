/**
 * WebSocket handler for real-time data updates
 * Replaces polling mechanism with event-driven updates
 */
import { EventEmitter } from 'events';
import imageProcessingService from '../services/image-processing.service.js';
import logger from '../utils/logger.js';

const log = logger('DataHandler');

class DataHandler extends EventEmitter {
  constructor(io) {
    super();
    this.io = io;
    this.setupNamespace();
    this.setupDataListener();
  }

  setupNamespace() {
    const namespace = this.io.of('/data-updates');

    namespace.on('connection', (socket) => {
      log.info(`Client connected`, { socketId: socket.id });

      // Send initial data on connection
      socket.emit('data_update', {
        type: 'initial',
        data: imageProcessingService.getProcessedData(),
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        log.info(`Client disconnected`, { socketId: socket.id, reason });
      });

      // Handle errors
      socket.on('error', (error) => {
        log.error(`Error for client ${socket.id}`, error);
      });
    });
  }

  setupDataListener() {
    // Listen for data changes from the service
    this.on('data_changed', (data) => {
      // Broadcast to all connected clients
      const namespace = this.io.of('/data-updates');
      namespace.emit('data_update', {
        type: 'update',
        data: imageProcessingService.getProcessedData(),
        newItem: data,
      });
      log.debug('Broadcasted data update to all clients');
    });
  }

  notifyDataChanged(newItem) {
    this.emit('data_changed', newItem);
  }
}

export default DataHandler;
