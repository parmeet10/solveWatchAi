import Tesseract from 'tesseract.js';
import logger from '../utils/logger.js';

const log = logger('OCRService');

class OCRService {
  async extractText(imagePath) {
    try {
      const startTime = Date.now();
      const textData = await Tesseract.recognize(imagePath, 'eng');
      const duration = Date.now() - startTime;

      log.info('OCR extraction complete', {
        textLength: textData.data.text.length,
        confidence: textData.data.confidence || 0,
        duration: `${duration}ms`,
      });

      return textData.data.text;
    } catch (err) {
      log.error('Error extracting text from image', err);
      throw err;
    }
  }
}

export default new OCRService();
