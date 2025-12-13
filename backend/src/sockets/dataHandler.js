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

  /**
   * Emit screenshot captured event
   */
  emitScreenshotCaptured(filename, filePath) {
    const namespace = this.io.of('/data-updates');
    const eventData = {
      filename,
      filePath,
      capturedAt: new Date().toISOString(),
      timestamp: Date.now(),
      status: 'captured',
      message: `Screenshot captured: ${filename}`,
    };

    log.info('📸 Screenshot captured', {
      filename,
      filePath,
      timestamp: new Date().toISOString(),
    });
    namespace.emit('screenshot_captured', eventData);
  }

  /**
   * Emit OCR processing started event
   */
  emitOCRStarted(filename, filePath) {
    const namespace = this.io.of('/data-updates');
    const eventData = {
      filename,
      filePath,
      startedAt: new Date().toISOString(),
      timestamp: Date.now(),
      status: 'processing',
      stage: 'ocr',
      message: `OCR processing started for: ${filename}`,
    };

    log.info('🔍 OCR processing started', {
      filename,
      filePath,
      timestamp: new Date().toISOString(),
    });
    namespace.emit('ocr_started', eventData);
  }

  /**
   * Emit OCR processing completed event
   */
  emitOCRComplete(filename, extractedText, duration) {
    const namespace = this.io.of('/data-updates');
    const eventData = {
      filename,
      extractedText: extractedText.substring(0, 500),
      extractedTextLength: extractedText.length,
      textPreview: extractedText.substring(0, 200),
      completedAt: new Date().toISOString(),
      timestamp: Date.now(),
      duration: duration,
      durationMs: duration,
      status: 'completed',
      stage: 'ocr',
      message: `OCR completed for: ${filename} (${extractedText.length} chars in ${duration}ms)`,
    };

    log.info('✅ OCR processing completed', {
      filename,
      textLength: extractedText.length,
      duration: `${duration}ms`,
      textPreview: extractedText.substring(0, 100),
    });
    namespace.emit('ocr_complete', eventData);
  }

  /**
   * Emit AI processing started event
   */
  emitAIStarted(filename, extractedText, useContext) {
    const namespace = this.io.of('/data-updates');
    const eventData = {
      filename,
      extractedTextLength: extractedText.length,
      useContext,
      startedAt: new Date().toISOString(),
      timestamp: Date.now(),
      status: 'processing',
      stage: 'ai',
      message: `AI processing started for: ${filename}${
        useContext ? ' (with context)' : ''
      }`,
    };

    log.info('🤖 AI processing started', {
      filename,
      useContext,
      textLength: extractedText.length,
      timestamp: new Date().toISOString(),
    });
    namespace.emit('ai_processing_started', eventData);
  }

  /**
   * Emit AI processing completed event
   * Sends only the AI response to the client (as requested)
   */
  emitAIComplete(filename, response, provider, duration, useContext) {
    const namespace = this.io.of('/data-updates');

    // Log detailed information in terminal
    log.info('AI processing completed', {
      filename,
      responseLength: response.length,
      provider,
      duration: `${duration}ms`,
      useContext,
      responsePreview: response.substring(0, 200),
    });

    // Emit only the response to client (simple format)
    namespace.emit('ai_processing_complete', {
      response: response,
    });
  }

  /**
   * Emit processing error event
   */
  emitProcessingError(filename, stage, error) {
    const namespace = this.io.of('/data-updates');
    const eventData = {
      filename,
      stage,
      error: {
        message: error.message || 'Unknown error',
        code: error.code || 'PROCESSING_ERROR',
      },
      occurredAt: new Date().toISOString(),
      timestamp: Date.now(),
      status: 'error',
      message: `Error during ${stage} processing for: ${filename}`,
    };

    log.error('❌ Processing error', {
      filename,
      stage,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    namespace.emit('processing_error', eventData);
  }
}

export default DataHandler;
