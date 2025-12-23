import fs from 'fs';
import path from 'path';
import imageProcessingService from './image-processing.service.js';
import { CONFIG } from '../config/constants.js';
import logger from '../utils/logger.js';
import createMouse from 'osx-mouse';
import sharp from 'sharp';

const log = logger('ScreenshotMonitor');

class ScreenshotMonitorService {
  constructor() {
    this.blacklistedShots = [...CONFIG.BLACKLISTED_FILES];
    this.watcher = null;
    this.processingFiles = new Set(); // Track files currently being processed
  }

  /**
   * Monitor mouse clicks with throttled timeout
   * - Waits 2 seconds for first click
   * - If first click received, resets timer to 2 more seconds for second click
   * - If no click in first 2 seconds, returns null immediately
   * Returns coordinates object or null if no clicks within timeout
   */
  async waitForCoordinates(timeoutMs = 2000) {
    return new Promise((resolve) => {
      let clickCount = 0;
      const maxClicks = 2;
      let mouseStream = null;
      const clicks = [];
      let timeoutHandle = null;
      let cleanedUp = false;
      let resolved = false;
      let firstClickReceived = false;

      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;

        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }

        if (mouseStream) {
          setImmediate(() => {
            try {
              if (
                mouseStream &&
                typeof mouseStream.removeListener === 'function'
              ) {
                mouseStream.removeListener('left-down', clickHandler);
              }
            } catch (err) {
              log.warn(`Error removing listener: ${err.message}`);
            }

            try {
              if (mouseStream) {
                if (typeof mouseStream.destroy === 'function') {
                  mouseStream.destroy();
                } else if (typeof mouseStream.unref === 'function') {
                  mouseStream.unref();
                }
              }
            } catch (err) {
              log.warn(`Error destroying mouse stream: ${err.message}`);
            }
            mouseStream = null;
          });
        }
      };

      const resetTimeout = () => {
        // Clear existing timeout
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }

        // Set new timeout for second click
        if (!resolved) {
          timeoutHandle = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              // Only one click received, timeout waiting for second
              log.info(
                'Timeout waiting for second click, will process full image',
              );
              cleanup();
              resolve(null);
            }
          }, timeoutMs);
        }
      };

      const clickHandler = (x, y) => {
        if (resolved || cleanedUp) return;

        try {
          clickCount++;
          clicks.push({ x, y });
          log.info(`Mouse Click ${clickCount}: x=${x}, y=${y}`, {
            clickNumber: clickCount,
            position:
              clickCount === 1 ? 'First (top-left)' : 'Second (bottom-right)',
          });

          if (clickCount === 1) {
            // First click received - reset timer to 2 more seconds
            firstClickReceived = true;
            log.info('First click received, resetting timer for second click');
            resetTimeout();
          } else if (clickCount >= maxClicks && !resolved) {
            // Both clicks received
            resolved = true;

            const click1 = clicks[0];
            const click2 = clicks[1];
            const minX = Math.min(click1.x, click2.x);
            const maxX = Math.max(click1.x, click2.x);
            const minY = Math.min(click1.y, click2.y);
            const maxY = Math.max(click1.y, click2.y);

            const coordinates = {
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
              topLeft: { x: minX, y: minY },
              bottomRight: { x: maxX, y: maxY },
              topRight: { x: maxX, y: minY },
              bottomLeft: { x: minX, y: maxY },
            };

            log.info('Coordinates captured', {
              x: coordinates.x,
              y: coordinates.y,
              width: coordinates.width,
              height: coordinates.height,
            });

            setImmediate(() => {
              cleanup();
              resolve(coordinates);
            });
          }
        } catch (error) {
          log.error(`Error in click handler: ${error.message}`);
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve(null);
          }
        }
      };

      try {
        mouseStream = createMouse();
        mouseStream.on('left-down', clickHandler);

        // Initial timeout: wait 2 seconds for first click
        timeoutHandle = setTimeout(() => {
          if (!resolved && !firstClickReceived) {
            // No first click received within initial 2 seconds
            resolved = true;
            log.info(
              'Timeout waiting for first click, will process full image',
            );
            cleanup();
            resolve(null);
          }
          // If firstClickReceived is true, the timeout was already reset
          // and we'll wait for the second click
        }, timeoutMs);
      } catch (error) {
        log.error(`Error setting up mouse monitoring: ${error.message}`);
        cleanup();
        resolve(null);
      }
    });
  }

  /**
   * Crop image using coordinates
   * Returns path to cropped image or null if cropping fails
   */
  async cropImage(imagePath, coordinates) {
    try {
      const imageMetadata = await sharp(imagePath).metadata();
      const screenshotWidth = imageMetadata.width;
      const screenshotHeight = imageMetadata.height;

      const si = await import('systeminformation');
      const graphics = await si.default.graphics();
      const primaryDisplay = graphics.displays && graphics.displays[0];
      let screenWidth =
        primaryDisplay?.currentResX || primaryDisplay?.resolutionX;
      let screenHeight =
        primaryDisplay?.currentResY || primaryDisplay?.resolutionY;

      if (!screenWidth || !screenHeight) {
        const likelyRetina = screenshotWidth > 2000 || screenshotHeight > 2000;
        screenWidth = likelyRetina ? screenshotWidth / 2 : screenshotWidth;
        screenHeight = likelyRetina ? screenshotHeight / 2 : screenshotHeight;
      }

      let scaleFactor = screenshotWidth / screenWidth;
      const scaleFactorY = screenshotHeight / screenHeight;
      if (Math.abs(scaleFactor - scaleFactorY) > 0.1) {
        scaleFactor = (scaleFactor + scaleFactorY) / 2;
      }

      const scaledX = coordinates.x * scaleFactor;
      const scaledY = coordinates.y * scaleFactor;
      const scaledWidth = coordinates.width * scaleFactor;
      const scaledHeight = coordinates.height * scaleFactor;

      let x = Math.round(scaledX);
      let y = Math.round(scaledY);
      let w = Math.round(scaledWidth);
      let h = Math.round(scaledHeight);

      x = Math.max(0, Math.min(x, screenshotWidth - 1));
      y = Math.max(0, Math.min(y, screenshotHeight - 1));
      w = Math.max(1, Math.min(w, screenshotWidth - x));
      h = Math.max(1, Math.min(h, screenshotHeight - y));

      const originalDir = path.dirname(imagePath);
      const originalName = path.basename(imagePath, path.extname(imagePath));
      const ext = path.extname(imagePath);
      const croppedImagePath = path.join(
        originalDir,
        `${originalName}_cropped_x${x}_y${y}_w${w}_h${h}${ext}`,
      );

      await sharp(imagePath)
        .extract({ left: x, top: y, width: w, height: h })
        .toFile(croppedImagePath);

      log.info('Image cropped successfully', { croppedPath: croppedImagePath });
      return croppedImagePath;
    } catch (error) {
      log.error('Error cropping image', { error: error.message });
      return null;
    }
  }

  clearScreenshotsDirectory() {
    try {
      if (!fs.existsSync(CONFIG.SCREENSHOTS_PATH)) {
        log.info(
          `Screenshots directory does not exist: ${CONFIG.SCREENSHOTS_PATH}`,
        );
        fs.mkdirSync(CONFIG.SCREENSHOTS_PATH, { recursive: true });
        log.info(`Created screenshots directory: ${CONFIG.SCREENSHOTS_PATH}`);
        return;
      }

      const files = fs.readdirSync(CONFIG.SCREENSHOTS_PATH);
      let clearedCount = 0;
      let skippedCount = 0;

      files.forEach((file) => {
        // Skip blacklisted files (like .DS_Store)
        if (CONFIG.BLACKLISTED_FILES.includes(file)) {
          skippedCount++;
          return;
        }

        const filePath = path.join(CONFIG.SCREENSHOTS_PATH, file);

        try {
          // Check if it's a file (not a directory)
          const stats = fs.statSync(filePath);
          if (!stats.isFile()) {
            log.debug(`Skipping non-file: ${file}`);
            skippedCount++;
            return;
          }

          // Delete all files (including cropped images)
          fs.unlinkSync(filePath);
          clearedCount++;
          log.debug(`Deleted file: ${file}`);
        } catch (err) {
          log.error(`Error deleting file ${file}`, {
            error: err.message,
            code: err.code,
          });
        }
      });

      if (clearedCount > 0) {
        log.info(
          `Cleared ${clearedCount} screenshot(s) from directory on startup${
            skippedCount > 0 ? ` (${skippedCount} skipped)` : ''
          }`,
        );
      } else if (files.length === 0) {
        log.info('Screenshots directory is already empty');
      } else {
        log.info(
          `No files cleared (${skippedCount} blacklisted/skipped, ${files.length} total)`,
        );
      }
    } catch (err) {
      log.error('Error clearing screenshots directory', {
        error: err.message,
        stack: err.stack,
      });
    }
  }

  async processScreenshot(filename) {
    // Skip if already processing, blacklisted, or is a cropped image
    if (
      this.processingFiles.has(filename) ||
      this.blacklistedShots.includes(filename) ||
      filename.includes('_cropped_')
    ) {
      return;
    }

    this.blacklistedShots.push(filename);
    this.processingFiles.add(filename);

    const filePath = `${CONFIG.SCREENSHOTS_PATH}/${filename}`;

    log.info('New screenshot detected, waiting 2 seconds for coordinates', {
      filename: filename,
      filePath: filePath,
    });

    try {
      // Small delay to ensure file is fully written to disk
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify file exists and is readable before processing
      try {
        await fs.promises.access(
          filePath,
          fs.constants.F_OK | fs.constants.R_OK,
        );
      } catch (accessErr) {
        log.warn('File not accessible, skipping', {
          filename,
          error: accessErr.message,
        });
        return;
      }

      // Wait 2 seconds for mouse clicks to capture coordinates
      const coordinates = await this.waitForCoordinates(2000);

      let imageToProcess = filePath;
      let filenameToProcess = filename;

      // If coordinates received, crop the image first
      if (coordinates) {
        log.info('Coordinates received, cropping image before processing');
        const croppedImagePath = await this.cropImage(filePath, coordinates);

        if (croppedImagePath) {
          // Use cropped image for processing
          imageToProcess = croppedImagePath;
          filenameToProcess = path.basename(croppedImagePath);
          // Blacklist the cropped image so it's not processed again
          this.blacklistedShots.push(filenameToProcess);
          log.info('Will process cropped image only, original skipped', {
            original: filename,
            cropped: filenameToProcess,
          });
        } else {
          // If cropping failed, fall back to original
          log.warn('Cropping failed, will process original image');
        }
      } else {
        log.info('No coordinates received, processing original image');
      }

      const useContextEnabled = imageProcessingService.getUseContextEnabled();
      const result = await imageProcessingService.processImage(
        imageToProcess,
        filenameToProcess,
        useContextEnabled,
      );

      // After processing, check if there are pending prompts waiting for this screenshot
      // Check all data handlers for pending prompts
      const dataHandlers = imageProcessingService.dataHandlers || [];
      for (const handler of dataHandlers) {
        if (handler && handler.pendingPrompts) {
          // Check all sockets for pending prompts
          const pendingSockets = Array.from(handler.pendingPrompts.keys());
          for (const socketId of pendingSockets) {
            const pendingPrompt = handler.getPendingPrompt(socketId);
            if (pendingPrompt && pendingPrompt.screenshotRequired) {
              log.info('Found pending prompt for screenshot', {
                socketId,
                messageId: pendingPrompt.messageId,
                promptType: pendingPrompt.promptType,
              });

              // Get socket from namespace
              const socket = handler.namespace?.sockets?.get(socketId) || null;

              // Process the prompt with the extracted text from screenshot
              const screenshotText = result?.extractedText || '';
              await handler.processPromptWithQuestion(
                socket,
                pendingPrompt.promptType,
                pendingPrompt.messageId,
                pendingPrompt.question,
                pendingPrompt.answer,
                screenshotText,
              );

              // Clear the pending prompt
              handler.clearPendingPrompt(socketId);
              break; // Only process one pending prompt per screenshot
            }
          }
        }
      }
    } catch (err) {
      log.error('Error processing screenshot', {
        filename: filename,
        error: err.message,
        stack: err.stack,
      });
    } finally {
      // Remove from processing set after completion
      this.processingFiles.delete(filename);
    }
  }

  setupDirectoryWatcher() {
    try {
      // Ensure directory exists
      if (!fs.existsSync(CONFIG.SCREENSHOTS_PATH)) {
        fs.mkdirSync(CONFIG.SCREENSHOTS_PATH, { recursive: true });
      }

      // Watch the directory for file changes
      this.watcher = fs.watch(
        CONFIG.SCREENSHOTS_PATH,
        (eventType, filename) => {
          if (!filename) {
            return;
          }

          // Only process on 'rename' events (file created/moved)
          // Note: Some platforms use 'rename' for both create and delete
          if (eventType === 'rename') {
            const filePath = path.join(CONFIG.SCREENSHOTS_PATH, filename);

            // Small delay to ensure file is fully written, then check if it exists
            setTimeout(() => {
              fs.access(
                filePath,
                fs.constants.F_OK | fs.constants.R_OK,
                (err) => {
                  if (!err) {
                    // Skip cropped images - they're temporary files created during processing
                    if (filename.includes('_cropped_')) {
                      log.debug('Skipping cropped image file', { filename });
                      return;
                    }

                    // File exists and is readable, process it
                    this.processScreenshot(filename).catch((error) => {
                      log.error('Error in processScreenshot', {
                        filename,
                        error: error.message,
                        stack: error.stack,
                      });
                    });
                  }
                },
              );
            }, 200); // 200ms delay to ensure file is fully written
          }
        },
      );

      this.watcher.on('error', (error) => {
        log.error('Directory watcher error', {
          error: error.message,
          stack: error.stack,
        });
      });

      log.info('Directory watcher setup complete', {
        path: CONFIG.SCREENSHOTS_PATH,
      });
    } catch (err) {
      log.error('Error setting up directory watcher', {
        error: err.message,
        stack: err.stack,
      });
      throw err; // Re-throw to indicate watcher setup failure
    }
  }

  start() {
    this.clearScreenshotsDirectory();
    this.setupDirectoryWatcher();
    log.info('Screenshot monitor started - watching for new screenshots only');
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      log.info('Directory watcher stopped');
    }
  }
}

export default new ScreenshotMonitorService();
