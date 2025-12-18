/**
 * WebSocket handler for /data-updates namespace
 * Handles connection, error, and processing events
 */
import { EventEmitter } from 'events';
import logger from '../utils/logger.js';
import createMouse from 'osx-mouse';
import screenshot from 'screenshot-desktop';
import path from 'path';
import fs from 'fs';
import { CONFIG } from '../config/constants.js';
import aiService from '../services/ai.service.js';
import imageProcessingService from '../services/image-processing.service.js';

const log = logger('DataHandler');

class DataHandler extends EventEmitter {
  constructor(io) {
    super();
    this.io = io;
    this.namespace = null;
    this.storedCoordinates = null; // Store rectangle coordinates from capture events
    this.transcriptionChunks = new Map(); // Store transcription chunks per socket connection
    this.promptTypes = new Map(); // Store prompt type per socket connection (coding, theory, query, or null)
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

        // Clean up transcription chunks for this connection
        if (this.transcriptionChunks.has(socket.id)) {
          this.transcriptionChunks.delete(socket.id);
          log.info('Cleaned up transcription chunks for disconnected socket', {
            socketId: socket.id,
          });
        }

        // Clean up prompt type for this connection
        if (this.promptTypes.has(socket.id)) {
          this.promptTypes.delete(socket.id);
          log.info('Cleaned up prompt type for disconnected socket', {
            socketId: socket.id,
          });
        }

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

      // Handle capture event - monitor system mouse clicks for rectangle
      socket.on('capture', () => {
        log.info(
          'Capture event received, monitoring system mouse for 2 clicks (top-left and bottom-right)',
        );

        let clickCount = 0;
        const maxClicks = 2;
        let mouseStream = null;
        const clicks = []; // Store the two clicks

        // Helper function to take screenshot and save to monitored directory
        const takeScreenshot = async () => {
          try {
            // Ensure screenshots directory exists
            if (!fs.existsSync(CONFIG.SCREENSHOTS_PATH)) {
              fs.mkdirSync(CONFIG.SCREENSHOTS_PATH, { recursive: true });
            }

            // Generate timestamped filename
            const timestamp = Date.now();
            const filename = `screenshot_${timestamp}.png`;
            const filePath = path.join(CONFIG.SCREENSHOTS_PATH, filename);

            // Take screenshot
            const imgBuffer = await screenshot();

            // Save to monitored directory
            fs.writeFileSync(filePath, imgBuffer);

            log.info('Screenshot saved', {
              filename,
              filePath,
            });

            return filePath;
          } catch (error) {
            log.error('Error taking screenshot', error);
            throw error;
          }
        };

        try {
          // Start monitoring mouse clicks
          mouseStream = createMouse();

          const clickHandler = (x, y) => {
            try {
              clickCount++;
              clicks.push({ x, y }); // Store the click
              log.info(`Mouse Click ${clickCount}: x=${x}, y=${y}`, {
                clickNumber: clickCount,
                position:
                  clickCount === 1
                    ? 'First (should be top-left)'
                    : 'Second (should be bottom-right)',
              });

              if (clickCount >= maxClicks) {
                // Calculate rectangle corners from the two clicks
                // Normalize to handle clicks in any order
                // macOS coordinate system: (0,0) is top-left, Y increases downward
                const click1 = clicks[0];
                const click2 = clicks[1];
                const minX = Math.min(click1.x, click2.x);
                const maxX = Math.max(click1.x, click2.x);
                const minY = Math.min(click1.y, click2.y);
                const maxY = Math.max(click1.y, click2.y);

                log.info('Click analysis', {
                  click1: { x: click1.x, y: click1.y },
                  click2: { x: click2.x, y: click2.y },
                  calculatedBounds: { minX, maxX, minY, maxY },
                });

                // Define rectangle corners
                const topLeft = { x: minX, y: minY };
                const bottomRight = { x: maxX, y: maxY };
                const topRight = {
                  x: maxX, // Same x as bottom-right
                  y: minY, // Same y as top-left
                };
                const bottomLeft = {
                  x: minX, // Same x as top-left
                  y: maxY, // Same y as bottom-right
                };

                // Calculate rectangle dimensions
                const width = maxX - minX;
                const height = maxY - minY;
                const area = width * height;

                // Log all four corners
                log.info('=== Rectangle Corners ===');
                log.info(`Top-Left:     x=${topLeft.x}, y=${topLeft.y}`);
                log.info(`Top-Right:    x=${topRight.x}, y=${topRight.y}`);
                log.info(`Bottom-Left:  x=${bottomLeft.x}, y=${bottomLeft.y}`);
                log.info(
                  `Bottom-Right: x=${bottomRight.x}, y=${bottomRight.y}`,
                );
                log.info(
                  `Rectangle: width=${width}, height=${height}, area=${area}`,
                );

                // Store coordinates for OCR region extraction (overwrite if exists)
                this.storedCoordinates = {
                  x: minX,
                  y: minY,
                  width: width,
                  height: height,
                  topLeft,
                  topRight,
                  bottomLeft,
                  bottomRight,
                };
                log.info('Coordinates stored for next screenshot OCR');

                // Take screenshot automatically after coordinates are stored
                takeScreenshot()
                  .then(() => {
                    log.info(
                      'Screenshot taken and saved, monitor will process it',
                    );
                  })
                  .catch((error) => {
                    log.error('Error taking screenshot', error);
                  })
                  .finally(() => {
                    // Defer cleanup to avoid issues with destroying from within event handler
                    setImmediate(() => {
                      cleanupMouseStream();
                      log.info('Finished capturing rectangle');
                    });
                  });
              }
            } catch (error) {
              log.error(`Error in click handler: ${error.message}`);
            }
          };

          const cleanupMouseStream = () => {
            try {
              if (mouseStream) {
                // Remove the event listener first to stop processing clicks
                mouseStream.removeListener('left-down', clickHandler);

                // Try to destroy, but if it fails, just unref to allow process to continue
                try {
                  if (typeof mouseStream.destroy === 'function') {
                    mouseStream.destroy();
                  }
                } catch (destroyError) {
                  log.warn(
                    `Could not destroy mouse stream, using unref instead: ${destroyError.message}`,
                  );
                  if (typeof mouseStream.unref === 'function') {
                    mouseStream.unref();
                  }
                }
                mouseStream = null;
              }
            } catch (error) {
              log.error(`Error cleaning up mouse stream: ${error.message}`);
            }
          };

          // Listen for left mouse button down events (clicks)
          // osx-mouse emits: 'left-down', 'left-up', 'right-down', 'right-up', 'move', etc.
          mouseStream.on('left-down', clickHandler);

          // Handle cleanup on disconnect
          socket.once('disconnect', () => {
            cleanupMouseStream();
          });
        } catch (error) {
          log.error(`Error setting up mouse monitoring: ${error.message}`);
          socket.emit('error', {
            socketId: socket.id,
            error: `Failed to start mouse monitoring: ${error.message}`,
            timestamp: Date.now(),
          });
        }
      });

      // Handle transcription event - accumulate text chunks
      socket.on('transcription', async (data) => {
        const { textChunk } = data || {};
        console.log('data', data);
        console.log('textChunk', textChunk);
        if (!textChunk || typeof textChunk !== 'string') {
          log.warn('Invalid transcription chunk received', {
            socketId: socket.id,
            data,
          });
          return;
        }

        // Initialize array if it doesn't exist for this socket
        if (!this.transcriptionChunks.has(socket.id)) {
          this.transcriptionChunks.set(socket.id, []);
        }

        // Add chunk to the array
        const chunks = this.transcriptionChunks.get(socket.id);
        chunks.push(textChunk);

        log.debug('Transcription chunk received', {
          socketId: socket.id,
          chunkLength: textChunk.length,
          totalChunks: chunks.length,
        });
      });

      // Handle set_prompt_type event - set the prompt type for this socket
      socket.on('set_prompt_type', (data) => {
        const { promptType } = data || {};

        // Validate prompt type
        const validTypes = ['coding', 'theory', 'query', null, undefined, ''];
        if (promptType && !validTypes.includes(promptType.toLowerCase())) {
          log.warn('Invalid prompt type received', {
            socketId: socket.id,
            promptType,
            validTypes: ['coding', 'theory', 'query', null],
          });
          socket.emit('error', {
            socketId: socket.id,
            error: `Invalid prompt type: ${promptType}. Valid types: coding, theory, query, or null/empty to use default`,
            timestamp: Date.now(),
          });
          return;
        }

        // Store prompt type for this socket (null or empty means use default/system prompt)
        const normalizedType =
          promptType && promptType.trim() ? promptType.toLowerCase() : null;

        this.promptTypes.set(socket.id, normalizedType);

        log.info('Prompt type set', {
          socketId: socket.id,
          promptType: normalizedType || 'default (system-prompt)',
        });

        socket.emit('prompt_type_set', {
          socketId: socket.id,
          promptType: normalizedType,
          message: `Prompt type set to: ${
            normalizedType || 'default (system-prompt)'
          }`,
          timestamp: Date.now(),
        });
      });

      // Handle process_transcription event - process accumulated transcription
      socket.on('process_transcription', async () => {
        const chunks = this.transcriptionChunks.get(socket.id);

        if (!chunks || chunks.length === 0) {
          log.warn('No transcription chunks found for processing', {
            socketId: socket.id,
          });
          socket.emit('aiprocessing_error', {
            error: 'No transcription data available',
            message: 'Error during transcription processing',
          });
          return;
        }

        try {
          // Combine all chunks into full transcription
          const fullTranscription = chunks.join(' ');

          log.info('Processing transcription', {
            socketId: socket.id,
            chunkCount: chunks.length,
            transcriptionLength: fullTranscription.length,
          });

          // Emit AI processing started event
          this.emitAIStarted('transcription', fullTranscription, false);

          // Get prompt type for this socket
          const promptType = this.getPromptType(socket.id);
          if (promptType) {
            log.info('Using custom prompt type for transcription processing', {
              socketId: socket.id,
              promptType,
            });
          }

          const aiStartTime = Date.now();

          // Call AI service to process transcription
          const aiResponse = await aiService.askGptTranscription(
            fullTranscription,
            promptType,
          );

          const aiDuration = Date.now() - aiStartTime;
          const provider = aiResponse.provider || 'unknown';
          const responseContent = aiResponse.message.content;

          // Store the AI response in imageProcessingService
          const processedItem = {
            filename: 'transcription',
            timestamp: new Date().toLocaleString(),
            extractedText:
              fullTranscription.substring(0, 500) +
              (fullTranscription.length > 500 ? '...' : ''),
            gptResponse:
              responseContent.substring(0, 1000) +
              (responseContent.length > 1000 ? '...' : ''),
            usedContext: false,
            type: 'transcription',
          };
          imageProcessingService.addProcessedData(processedItem);

          // Update last response for potential context use
          imageProcessingService.setLastResponse(responseContent);

          // Clear transcription chunks after processing (don't store transcription)
          this.transcriptionChunks.delete(socket.id);

          log.info('Transcription processing completed successfully', {
            socketId: socket.id,
            provider,
            aiDuration: `${aiDuration}ms`,
            responseLength: responseContent.length,
          });

          // Emit AI processing complete event
          this.emitAIComplete(
            'transcription',
            responseContent,
            provider,
            aiDuration,
            false,
          );
        } catch (err) {
          log.error('Error processing transcription', {
            socketId: socket.id,
            error: err.message,
            stack: err.stack,
          });

          // Clear chunks even on error (don't store transcription)
          this.transcriptionChunks.delete(socket.id);

          // Emit processing error event
          this.emitProcessingError('transcription', 'transcription', err);
        }
      });
    });

    log.info('Namespace setup complete');
  }

  /**
   * Get stored coordinates for OCR region extraction
   * Returns null if no coordinates are stored
   */
  getStoredCoordinates() {
    return this.storedCoordinates;
  }

  /**
   * Clear stored coordinates
   */
  clearStoredCoordinates() {
    this.storedCoordinates = null;
  }

  /**
   * Get prompt type for a specific socket
   * Returns null if no prompt type is set (will use default/system prompt)
   */
  getPromptType(socketId) {
    return this.promptTypes.get(socketId) || null;
  }

  /**
   * Get prompt type for any active socket (used when socket ID is not available)
   * Returns the first available prompt type, or null if none set
   */
  getAnyPromptType() {
    if (this.promptTypes.size === 0) {
      return null;
    }
    // Return the first prompt type found
    return this.promptTypes.values().next().value || null;
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
    const hasCoordinates = this.storedCoordinates !== null;

    log.info(`Screenshot captured: ${filename}`, {
      hasCoordinates,
    });

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
