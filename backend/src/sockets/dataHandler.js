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

const log = logger('DataHandler');

class DataHandler extends EventEmitter {
  constructor(io) {
    super();
    this.io = io;
    this.namespace = null;
    this.storedCoordinates = null; // Store rectangle coordinates from capture events
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
