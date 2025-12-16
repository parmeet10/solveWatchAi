import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const log = logger('OCRService');

class OCRService {
  async extractText(imagePath, coordinates = null) {
    try {
      const startTime = Date.now();
      let imageToProcess = imagePath;
      let croppedImagePath = null;

      // If coordinates provided, crop the image first
      if (coordinates) {
        log.info('Cropping image to specified region');

        try {
          // Get screenshot dimensions to calculate scaling factor
          const imageMetadata = await sharp(imagePath).metadata();
          const screenshotWidth = imageMetadata.width;
          const screenshotHeight = imageMetadata.height;

          // Get screen dimensions using systeminformation
          const si = await import('systeminformation');
          const graphics = await si.default.graphics();

          // Find primary display (usually first one)
          const primaryDisplay = graphics.displays && graphics.displays[0];
          // Use current resolution if available, otherwise use max resolution
          let screenWidth =
            primaryDisplay?.currentResX || primaryDisplay?.resolutionX;
          let screenHeight =
            primaryDisplay?.currentResY || primaryDisplay?.resolutionY;

          // If screen dimensions not available, try to infer from screenshot
          // On Retina displays, screenshots are typically 2x resolution
          if (!screenWidth || !screenHeight) {
            // Assume Retina (2x) if screenshot is very large
            const likelyRetina =
              screenshotWidth > 2000 || screenshotHeight > 2000;
            screenWidth = likelyRetina ? screenshotWidth / 2 : screenshotWidth;
            screenHeight = likelyRetina
              ? screenshotHeight / 2
              : screenshotHeight;
            log.warn(
              'Screen dimensions not available, inferring from screenshot',
              {
                inferredWidth: screenWidth,
                inferredHeight: screenHeight,
                likelyRetina,
              },
            );
          }

          // Calculate scaling factor
          // On Retina displays, screenshot is typically 2x the logical screen size
          // Example: Screenshot 2880×1800, Display 1440×900 → scaleFactor = 2.0
          let scaleFactor = screenshotWidth / screenWidth;

          // Also check Y scale factor to ensure consistency
          const scaleFactorY = screenshotHeight / screenHeight;

          // Use the average if they differ slightly, or log a warning
          if (Math.abs(scaleFactor - scaleFactorY) > 0.1) {
            log.warn('X and Y scale factors differ significantly', {
              scaleFactorX: scaleFactor,
              scaleFactorY: scaleFactorY,
            });
            // Use average for consistency
            scaleFactor = (scaleFactor + scaleFactorY) / 2;
          }

          // Validate scale factor (should be between 1 and 4 typically)
          if (scaleFactor < 0.5 || scaleFactor > 4) {
            log.warn('Unusual scale factor detected', {
              scaleFactor: scaleFactor.toFixed(2),
            });
          }

          // Scale coordinates to match screenshot resolution
          const scaledX = coordinates.x * scaleFactor;
          const scaledY = coordinates.y * scaleFactor;
          const scaledWidth = coordinates.width * scaleFactor;
          const scaledHeight = coordinates.height * scaleFactor;

          // Round to integers (sharp requires integers)
          let x = Math.round(scaledX);
          let y = Math.round(scaledY);
          let w = Math.round(scaledWidth);
          let h = Math.round(scaledHeight);

          // Validate and clamp coordinates to image bounds
          x = Math.max(0, Math.min(x, screenshotWidth - 1));
          y = Math.max(0, Math.min(y, screenshotHeight - 1));
          w = Math.max(1, Math.min(w, screenshotWidth - x));
          h = Math.max(1, Math.min(h, screenshotHeight - y));

          // Create cropped image path with coordinates in filename for inspection
          const originalDir = path.dirname(imagePath);
          const originalName = path.basename(
            imagePath,
            path.extname(imagePath),
          );
          const ext = path.extname(imagePath);
          croppedImagePath = path.join(
            originalDir,
            `${originalName}_cropped_x${x}_y${y}_w${w}_h${h}${ext}`,
          );

          // Crop image using sharp with validated coordinates
          await sharp(imagePath)
            .extract({
              left: x,
              top: y,
              width: w,
              height: h,
            })
            .toFile(croppedImagePath);

          imageToProcess = croppedImagePath;
          log.info('Image cropped successfully');
        } catch (cropError) {
          log.error('Error cropping image, using full image', cropError);
          // Fall back to full image if cropping fails
          imageToProcess = imagePath;
        }
      }

      // Run OCR on the image (cropped or full)
      const textData = await Tesseract.recognize(imageToProcess, 'eng');
      const duration = Date.now() - startTime;

      log.info('OCR extraction complete', {
        textLength: textData.data.text.length,
        confidence: textData.data.confidence || 0,
        duration: `${duration}ms`,
        usedRegion: coordinates !== null,
      });

      return textData.data.text;
    } catch (err) {
      log.error('Error extracting text from image', err);
      throw err;
    }
  }
}

export default new OCRService();
