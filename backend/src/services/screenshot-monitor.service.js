import fs from 'fs';
import path from 'path';
import imageProcessingService from './image-processing.service.js';
import { CONFIG } from '../config/constants.js';

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
              console.error(`Error deleting file ${file}:`, err);
            }
          }
        });

        if (clearedCount > 0) {
          console.log(
            `🧹 Cleared ${clearedCount} screenshot(s) from directory on startup.`,
          );
        }
      } else {
        console.log(`📁 Screenshots directory does not exist: ${CONFIG.SCREENSHOTS_PATH}`);
        fs.mkdirSync(CONFIG.SCREENSHOTS_PATH, { recursive: true });
        console.log(`📁 Created screenshots directory: ${CONFIG.SCREENSHOTS_PATH}`);
      }
    } catch (err) {
      console.error('Error clearing screenshots directory:', err);
    }
  }

  async detectNewScreenshots() {
    try {
      const screenshots = fs.readdirSync(CONFIG.SCREENSHOTS_PATH);

      for (const shot of screenshots) {
        if (!this.blacklistedShots.includes(shot)) {
          this.blacklistedShots.push(shot);
          try {
            const useContextEnabled = imageProcessingService.getUseContextEnabled();
            await imageProcessingService.processImage(
              `${CONFIG.SCREENSHOTS_PATH}/${shot}`,
              shot,
              useContextEnabled
            );
          } catch (err) {
            console.log('Error processing screenshot:', err);
          }
        }
      }
    } catch (err) {
      console.log('Error detecting screenshots:', err);
    }

    setTimeout(() => this.detectNewScreenshots(), 1000);
  }

  start() {
    this.clearScreenshotsDirectory();
    this.detectNewScreenshots();
  }
}

export default new ScreenshotMonitorService();

