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
      const connectionInfo = {
        socketId: socket.id,
        connectedAt: new Date().toISOString(),
        ip: socket.handshake.address,
      };

      log.info('Client connected to data-updates', connectionInfo);

      // Send initial data on connection
      const initialData = imageProcessingService.getProcessedData();
      log.info('Sending initial data to client', {
        socketId: socket.id,
        dataCount: initialData.length,
      });

      socket.emit('data_update', {
        type: 'initial',
        data: initialData,
        timestamp: Date.now(),
      });

      socket.emit('connection_status', {
        status: 'connected',
        socketId: socket.id,
        dataCount: initialData.length,
        timestamp: Date.now(),
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        const disconnectInfo = {
          socketId: socket.id,
          reason,
          disconnectedAt: new Date().toISOString(),
        };

        log.info('Client disconnected from data-updates', disconnectInfo);

        socket.emit('connection_status', {
          status: 'disconnected',
          socketId: socket.id,
          reason,
          timestamp: Date.now(),
        });
      });

      // Handle errors
      socket.on('error', (error) => {
        log.error('Socket error', {
          socketId: socket.id,
          error: error.message || error,
          stack: error.stack,
        });
      });
    });
  }

  setupDataListener() {
    // Listen for data changes from the service
    this.on('data_changed', (data) => {
      // Broadcast to all connected clients
      const namespace = this.io.of('/data-updates');
      const allData = imageProcessingService.getProcessedData();

      log.info('Broadcasting data update to all clients', {
        newItemType: data.type,
        newItemFilename: data.filename,
        totalDataCount: allData.length,
        connectedClients: namespace.sockets.size,
      });

      namespace.emit('data_update', {
        type: 'update',
        data: allData,
        newItem: data,
        timestamp: Date.now(),
      });

      log.debug('Data update broadcasted successfully', {
        connectedClients: namespace.sockets.size,
      });
    });
  }

  notifyDataChanged(newItem) {
    log.info('Data changed event triggered', {
      itemType: newItem.type,
      itemFilename: newItem.filename,
    });
    this.emit('data_changed', newItem);
  }
}

export default DataHandler;
