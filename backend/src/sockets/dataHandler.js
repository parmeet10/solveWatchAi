/**
 * WebSocket handler for real-time data updates
 * Replaces polling mechanism with event-driven updates
 */
import { EventEmitter } from 'events';
import imageProcessingService from '../services/image-processing.service.js';

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
      console.log(`[DataHandler] Client connected: ${socket.id}`);

      // Send initial data on connection
      socket.emit('data_update', {
        type: 'initial',
        data: imageProcessingService.getProcessedData(),
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        console.log(
          `[DataHandler] Client disconnected: ${socket.id}, Reason: ${reason}`,
        );
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`[DataHandler] Error for client ${socket.id}:`, error);
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
      console.log('[DataHandler] Broadcasted data update to all clients');
    });
  }

  notifyDataChanged(newItem) {
    this.emit('data_changed', newItem);
  }
}

export default DataHandler;
