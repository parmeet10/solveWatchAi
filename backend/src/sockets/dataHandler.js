/**
 * WebSocket handler for /data-updates namespace
 * Handles connection, error, and processing events
 */
import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

const log = logger('DataHandler');

class DataHandler extends EventEmitter {
  constructor(io) {
    super();
    this.io = io;
    this.namespace = null;
    this.setupNamespace();
  }

  setupNamespace() {
    this.namespace = this.io.of('/data-updates');

    log.info('Setting up /data-updates namespace');

    this.namespace.on('connection', (socket) => {
      log.info('Client connected');

      // Emit connected event
      socket.emit('connected', {
        socketId: socket.id,
        connectedAt: new Date().toISOString(),
        timestamp: Date.now(),
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        log.info('Client disconnected');

        socket.emit('connection_status', {
          status: 'disconnected',
          socketId: socket.id,
          reason,
          timestamp: Date.now(),
        });
      });

      // Handle errors
      socket.on('error', (error) => {
        const errorMessage = error.message || 'Unknown error';
        log.error(`Socket error: ${errorMessage}`);

        // Emit error event to client
        socket.emit('error', {
          socketId: socket.id,
          error: errorMessage,
          timestamp: Date.now(),
        });
      });
    });

    log.info('Namespace setup complete');
  }

  /**
   * Emit screenshot captured event
   */
  emitScreenshotCaptured(filename, filePath) {
    if (!this.namespace) {
      log.warn('Namespace not initialized, skipping emit');
      return;
    }
    
    const message = `Screenshot captured: ${filename}`;

    log.info(`Screenshot captured: ${filename}`);

    this.namespace.emit('screenshot_captured', { message });
  }

  /**
   * Emit OCR processing started event
   */
  emitOCRStarted(filename, filePath) {
    if (!this.namespace) {
      log.warn('Namespace not initialized, skipping emit');
      return;
    }

    const message = 'OCR started';

    log.info('OCR started');

    this.namespace.emit('ocr_started', { message });
  }

  /**
   * Emit OCR processing completed event
   */
  emitOCRComplete(filename, extractedText, duration) {
    if (!this.namespace) {
      log.warn('Namespace not initialized, skipping emit');
      return;
    }

    const message = 'OCR completed';

    log.info(`OCR completed: ${extractedText}`);

    this.namespace.emit('ocr_complete', { message });
  }

  /**
   * Emit AI processing started event
   */
  emitAIStarted(filename, extractedText, useContext) {
    if (!this.namespace) {
      log.warn('Namespace not initialized, skipping emit');
      return;
    }

    const message = 'AI processing started';

    log.info('AI processing started');

    this.namespace.emit('ai_processing_started', { message });
  }

  /**
   * Emit AI processing completed event
   */
  emitAIComplete(filename, response, provider, duration, useContext) {
    if (!this.namespace) {
      log.warn('Namespace not initialized, skipping emit');
      return;
    }

    const message = 'AI processing completed';

    log.info(`AI processing completed: ${response}`);

    this.namespace.emit('ai_processing_complete', {
      response,
      message,
    });
  }

  /**
   * Emit processing error event
   */
  emitProcessingError(filename, stage, error) {
    if (!this.namespace) {
      log.warn('Namespace not initialized, skipping emit');
      return;
    }

    const errorMessage = error.message || 'Unknown error';
    const message = `Error during ${stage} processing`;

    log.error(`Error during ${stage} processing: ${errorMessage}`);

    this.namespace.emit('aiprocessing_error', {
      error: errorMessage,
      message,
    });
  }
}

export default DataHandler;
