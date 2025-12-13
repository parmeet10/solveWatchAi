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

    log.info('🔌 Setting up /data-updates namespace');

    this.namespace.on('connection', (socket) => {
      const connectionInfo = {
        socketId: socket.id,
        connectedAt: new Date().toISOString(),
        ip: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
        totalConnections: this.namespace.sockets.size,
      };

      log.info('✅ [DATA-UPDATES] Client connected', connectionInfo);

      // Emit connected event
      socket.emit('connected', {
        socketId: socket.id,
        connectedAt: connectionInfo.connectedAt,
        timestamp: Date.now(),
      });

      log.debug('📤 [DATA-UPDATES] Emitted: connected', {
        socketId: socket.id,
        event: 'connected',
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        const disconnectInfo = {
          socketId: socket.id,
          reason,
          disconnectedAt: new Date().toISOString(),
          remainingConnections: this.namespace.sockets.size - 1,
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
        log.error('⚠️ [DATA-UPDATES] Socket error', {
          socketId: socket.id,
          error: error.message || error,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        });

        // Emit error event to client
        socket.emit('error', {
          socketId: socket.id,
          error: error.message || 'Unknown error',
          timestamp: Date.now(),
        });
      });
    });

    log.info('✅ [DATA-UPDATES] Namespace setup complete');
  }

  /**
   * Emit screenshot captured event
   */
  emitScreenshotCaptured(filename, filePath) {
    if (!this.namespace) {
      log.warn('⚠️ [DATA-UPDATES] Namespace not initialized, skipping emit');
      return;
    }

    const eventData = {
      filename,
      filePath,
      capturedAt: new Date().toISOString(),
      timestamp: Date.now(),
      status: 'captured',
      message: `Screenshot captured: ${filename}`,
    };

    log.info('📸 [DATA-UPDATES] Screenshot captured', {
      filename,
      filePath,
      connectedClients: this.namespace.sockets.size,
    });

    this.namespace.emit('screenshot_captured', eventData);

    log.debug('📤 [DATA-UPDATES] Emitted: screenshot_captured', {
      event: 'screenshot_captured',
      filename,
      connectedClients: this.namespace.sockets.size,
    });
  }

  /**
   * Emit OCR processing started event
   */
  emitOCRStarted(filename, filePath) {
    if (!this.namespace) {
      log.warn('⚠️ [DATA-UPDATES] Namespace not initialized, skipping emit');
      return;
    }

    const eventData = {
      filename,
      filePath,
      startedAt: new Date().toISOString(),
      timestamp: Date.now(),
      status: 'processing',
      stage: 'ocr',
      message: `OCR processing started for: ${filename}`,
    };

    log.info('🔍 [DATA-UPDATES] OCR processing started', {
      filename,
      filePath,
      connectedClients: this.namespace.sockets.size,
    });

    this.namespace.emit('ocr_started', eventData);

    log.debug('📤 [DATA-UPDATES] Emitted: ocr_started', {
      event: 'ocr_started',
      filename,
      connectedClients: this.namespace.sockets.size,
    });
  }

  /**
   * Emit OCR processing completed event
   */
  emitOCRComplete(filename, extractedText, duration) {
    if (!this.namespace) {
      log.warn('⚠️ [DATA-UPDATES] Namespace not initialized, skipping emit');
      return;
    }

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

    log.info('✅ [DATA-UPDATES] OCR processing completed', {
      filename,
      textLength: extractedText.length,
      duration: `${duration}ms`,
      connectedClients: this.namespace.sockets.size,
    });

    this.namespace.emit('ocr_complete', eventData);

    log.debug('📤 [DATA-UPDATES] Emitted: ocr_complete', {
      event: 'ocr_complete',
      filename,
      textLength: extractedText.length,
      duration: `${duration}ms`,
      connectedClients: this.namespace.sockets.size,
    });
  }

  /**
   * Emit AI processing started event
   */
  emitAIStarted(filename, extractedText, useContext) {
    if (!this.namespace) {
      log.warn('⚠️ [DATA-UPDATES] Namespace not initialized, skipping emit');
      return;
    }

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

    log.info('🤖 [DATA-UPDATES] AI processing started', {
      filename,
      useContext,
      textLength: extractedText.length,
      connectedClients: this.namespace.sockets.size,
    });

    this.namespace.emit('ai_processing_started', eventData);

    log.debug('📤 [DATA-UPDATES] Emitted: ai_processing_started', {
      event: 'ai_processing_started',
      filename,
      useContext,
      connectedClients: this.namespace.sockets.size,
    });
  }

  /**
   * Emit AI processing completed event
   */
  emitAIComplete(filename, response, provider, duration, useContext) {
    if (!this.namespace) {
      log.warn('⚠️ [DATA-UPDATES] Namespace not initialized, skipping emit');
      return;
    }

    const payload = {
      filename,
      response: response,
      provider,
      duration,
      useContext,
      completedAt: new Date().toISOString(),
      timestamp: Date.now(),
    };

    log.info('✅ [DATA-UPDATES] AI processing completed', {
      filename,
      responseLength: response.length,
      provider,
      duration: `${duration}ms`,
      useContext,
      connectedClients: this.namespace.sockets.size,
    });

    this.namespace.emit('ai_processing_complete', payload);

    log.debug('📤 [DATA-UPDATES] Emitted: ai_processing_complete', {
      event: 'ai_processing_complete',
      filename,
      provider,
      responseLength: response.length,
      duration: `${duration}ms`,
      connectedClients: this.namespace.sockets.size,
    });
  }

  /**
   * Emit processing error event
   */
  emitProcessingError(filename, stage, error) {
    if (!this.namespace) {
      log.warn('⚠️ [DATA-UPDATES] Namespace not initialized, skipping emit');
      return;
    }

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

    log.error('❌ [DATA-UPDATES] Processing error', {
      filename,
      stage,
      error: error.message,
      connectedClients: this.namespace.sockets.size,
    });

    this.namespace.emit('aiprocessing_error', eventData);

    log.debug('📤 [DATA-UPDATES] Emitted: aiprocessing_error', {
      event: 'aiprocessing_error',
      filename,
      stage,
      error: error.message,
      connectedClients: this.namespace.sockets.size,
    });
  }
}

export default DataHandler;
