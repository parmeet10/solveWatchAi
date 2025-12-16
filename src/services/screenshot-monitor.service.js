import fs from 'fs';
import path from 'path';
import imageProcessingService from './image-processing.service.js';
import { CONFIG } from '../config/constants.js';
import logger from '../utils/logger.js';

const log = logger('ScreenshotMonitor');

class ScreenshotMonitorService {
  constructor() {
    this.blacklistedShots = [...CONFIG.BLACKLISTED_FILES];
  }

  clearScreenshotsDirectory() {
    try {
      if (fs.existsSync(CONFIG.SCREENSHOTS_PATH)) {
        const files = fs.readdirSync(CONFIG.SCREENSHOTS_PATH);
        let clearedCount = 0;

        files.forEach((file) => {
          if (!CONFIG.BLACKLISTED_FILES.includes(file)) {
            const filePath = path.join(CONFIG.SCREENSHOTS_PATH, file);
            try {
              fs.unlinkSync(filePath);
              clearedCount++;
            } catch (err) {
              log.error(`Error deleting file ${file}`, err);
            }
          }
        });

        if (clearedCount > 0) {
          log.info(
            `Cleared ${clearedCount} screenshot(s) from directory on startup`,
          );
        }
      } else {
        log.info(
          `Screenshots directory does not exist: ${CONFIG.SCREENSHOTS_PATH}`,
        );
        fs.mkdirSync(CONFIG.SCREENSHOTS_PATH, { recursive: true });
        log.info(`Created screenshots directory: ${CONFIG.SCREENSHOTS_PATH}`);
      }
    } catch (err) {
      log.error('Error clearing screenshots directory', err);
    }
  }

  async detectNewScreenshots() {
    try {
      const screenshots = fs.readdirSync(CONFIG.SCREENSHOTS_PATH);

      for (const shot of screenshots) {
        if (!this.blacklistedShots.includes(shot)) {
          this.blacklistedShots.push(shot);
          const filePath = `${CONFIG.SCREENSHOTS_PATH}/${shot}`;

          log.info('New screenshot detected', {
            filename: shot,
            filePath: filePath,
          });

          try {
            const useContextEnabled =
              imageProcessingService.getUseContextEnabled();
            await imageProcessingService.processImage(
              filePath,
              shot,
              useContextEnabled,
            );
          } catch (err) {
            log.error('Error processing screenshot', {
              filename: shot,
              error: err.message,
              stack: err.stack,
            });
          }
        }
      }
    } catch (err) {
      log.error('Error detecting screenshots', {
        error: err.message,
        stack: err.stack,
      });
    }

    setTimeout(() => this.detectNewScreenshots(), 1000);
  }

  start() {
    this.clearScreenshotsDirectory();
    this.detectNewScreenshots();
  }
}

export default new ScreenshotMonitorService();
