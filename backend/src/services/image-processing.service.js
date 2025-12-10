import ocrService from './ocr.service.js';
import aiService from './ai.service.js';
import emailService from './email.service.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const EMAIL_CONFIG_FILE_PATH = path.join(
  process.cwd(),
  'backend',
  'config',
  'email-config.json',
);

class ImageProcessingService {
  constructor() {
    this.processedData = [];
    this.lastResponse = null;
    this.useContextEnabled = false;
    this.dataHandlers = []; // Array of handlers for HTTP and HTTPS
  }

  setDataHandlers(handlers) {
    this.dataHandlers = handlers;
  }

  getProcessedData() {
    return this.processedData;
  }

  getUseContextEnabled() {
    return this.useContextEnabled;
  }

  setUseContextEnabled(enabled) {
    this.useContextEnabled = enabled;
  }

  getLastResponse() {
    return this.lastResponse;
  }

  setLastResponse(response) {
    this.lastResponse = response;
  }

  addProcessedData(data) {
    this.processedData.push(data);
    // Notify WebSocket clients about the new data
    this.dataHandlers.forEach((handler) => {
      if (handler) {
        handler.notifyDataChanged(data);
      }
    });
  }

  async processImage(imagePath, filename, useContext = false) {
    try {
      const extractedText = await ocrService.extractText(imagePath);
      let gptResponse;

      const actuallyUsedContext = useContext && this.lastResponse !== null;

      if (actuallyUsedContext) {
        gptResponse = await aiService.askGptWithContext(
          extractedText,
          this.lastResponse,
        );
      } else {
        gptResponse = await aiService.askGpt(extractedText);
      }

      this.lastResponse = gptResponse.message.content;

      const processedItem = {
        filename: filename,
        timestamp: new Date().toLocaleString(),
        extractedText:
          extractedText.substring(0, 500) +
          (extractedText.length > 500 ? '...' : ''),
        gptResponse:
          gptResponse.message.content.substring(0, 1000) +
          (gptResponse.message.content.length > 1000 ? '...' : ''),
        usedContext: actuallyUsedContext,
      };

      this.processedData.push(processedItem);

      // Notify WebSocket clients about the new data
      this.dataHandlers.forEach((handler) => {
        if (handler) {
          handler.notifyDataChanged(processedItem);
        }
      });

      // Send email if enabled
      try {
        let emailConfig = { enabled: false, email: '' };
        if (fs.existsSync(EMAIL_CONFIG_FILE_PATH)) {
          const configData = fs.readFileSync(EMAIL_CONFIG_FILE_PATH, 'utf8');
          emailConfig = JSON.parse(configData);
        }

        if (emailConfig.enabled && emailConfig.email) {
          await emailService.sendMail(
            process.env.EMAIL_FROM || 'sparmeet162000@gmail.com',
            emailConfig.email,
            'CodeSnapGPT - Processed Screenshot',
            gptResponse.message.content,
          );
        }
      } catch (emailErr) {
        console.error('Error sending email (non-fatal):', emailErr);
        // Don't throw - email failure shouldn't break the main flow
      }

      return {
        success: true,
        extractedText,
        gptResponse: gptResponse.message.content,
        usedContext: actuallyUsedContext,
      };
    } catch (err) {
      console.error('Error processing image:', err);

      const errorItem = {
        filename: filename,
        timestamp: new Date().toLocaleString(),
        extractedText: 'Error extracting text',
        gptResponse: `Error: ${err.message || err}`,
        usedContext: false,
      };
      this.processedData.push(errorItem);

      // Notify WebSocket clients about the error data
      this.dataHandlers.forEach((handler) => {
        if (handler) {
          handler.notifyDataChanged(errorItem);
        }
      });

      throw err;
    }
  }
}

export default new ImageProcessingService();
