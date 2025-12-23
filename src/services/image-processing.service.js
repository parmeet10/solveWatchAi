import ocrService from './ocr.service.js';
import aiService from './ai.service.js';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const log = logger('ImageProcessingService');

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
    // COMMENTED OUT: Frontend removed - no longer needed
    // // Notify WebSocket clients about the new data
    // this.dataHandlers.forEach((handler) => {
    //   if (handler) {
    //     handler.notifyDataChanged(data);
    //   }
    // });
  }

  async processImage(imagePath, filename, useContext = false) {
    const processId = `process-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const startTime = Date.now();

    try {
      log.info('Starting image processing', {
        processId,
        filename,
        imagePath,
        useContext,
      });

      // Emit screenshot captured event (if not already emitted by monitor)
      this.dataHandlers.forEach((handler) => {
        if (handler && handler.emitScreenshotCaptured) {
          handler.emitScreenshotCaptured(filename, imagePath);
        }
      });

      // Emit OCR started event
      this.dataHandlers.forEach((handler) => {
        if (handler && handler.emitOCRStarted) {
          handler.emitOCRStarted(filename, imagePath);
        }
      });

      const ocrStartTime = Date.now();
      // Image is already cropped by screenshot monitor if coordinates were received
      // Pass null for coordinates since cropping is handled before this step
      const extractedText = await ocrService.extractText(imagePath, null);
      const ocrDuration = Date.now() - ocrStartTime;

      // Emit OCR complete event
      this.dataHandlers.forEach((handler) => {
        if (handler && handler.emitOCRComplete) {
          handler.emitOCRComplete(filename, extractedText, ocrDuration);
        }
      });

      log.info('OCR completed, starting AI processing', {
        processId,
        filename,
        extractedTextLength: extractedText.length,
        ocrDuration: `${ocrDuration}ms`,
      });

      // Emit AI started event
      const actuallyUsedContext = useContext && this.lastResponse !== null;
      this.dataHandlers.forEach((handler) => {
        if (handler && handler.emitAIStarted) {
          handler.emitAIStarted(filename, extractedText, actuallyUsedContext);
        }
      });

      const aiStartTime = Date.now();
      let gptResponse;

      // Always use default 'system' prompt for initial screenshot processing
      // Other prompt types (theory, coding, debug) are used via use_prompt event
      const promptType = 'system';

      if (actuallyUsedContext) {
        log.info('Using context for AI processing', {
          processId,
          filename,
          contextLength: this.lastResponse.length,
          promptType: 'context',
        });
        gptResponse = await aiService.askGptWithContext(
          extractedText,
          this.lastResponse,
          'context',
        );
      } else {
        log.info('Using system prompt for AI processing', {
          processId,
          filename,
          promptType: 'system',
        });
        gptResponse = await aiService.askGpt(extractedText, 'system');
      }

      const aiDuration = Date.now() - aiStartTime;
      const provider = gptResponse.provider || 'unknown';

      // Generate messageId for this processing
      const messageId = `msg-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Store question (extracted text) and answer (AI response) with messageId
      // Try to get socketId from any active socket (for pending prompts)
      let socketIdForMessage = null;
      this.dataHandlers.forEach((handler) => {
        if (handler && handler.namespace) {
          // Get first active socket if available
          const sockets = handler.namespace.sockets;
          if (sockets && sockets.size > 0) {
            socketIdForMessage = Array.from(sockets.keys())[0];
          }
        }
        if (handler && handler.storeMessageData) {
          handler.storeMessageData(
            messageId,
            extractedText, // question = extracted text from screenshot
            gptResponse.message.content, // answer = AI response
            'system', // Always 'system' for initial screenshot processing
            socketIdForMessage,
          );
        }
      });

      // Emit AI complete event with messageId
      this.dataHandlers.forEach((handler) => {
        if (handler && handler.emitAIComplete) {
          handler.emitAIComplete(
            filename,
            gptResponse.message.content,
            provider,
            aiDuration,
            actuallyUsedContext,
            messageId,
          );
        }
      });

      this.lastResponse = gptResponse.message.content;

      const totalDuration = Date.now() - startTime;
      log.info('Image processing completed successfully', {
        processId,
        filename,
        totalDuration: `${totalDuration}ms`,
        ocrDuration: `${ocrDuration}ms`,
        aiDuration: `${aiDuration}ms`,
        provider,
        useContext: actuallyUsedContext,
      });

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

      // COMMENTED OUT: Frontend removed - no longer needed
      // // Notify WebSocket clients about the new data
      // this.dataHandlers.forEach((handler) => {
      //   if (handler) {
      //     handler.notifyDataChanged(processedItem);
      //   }
      // });

      return {
        success: true,
        extractedText,
        gptResponse: gptResponse.message.content,
        usedContext: actuallyUsedContext,
      };
    } catch (err) {
      log.error('Error processing image', {
        processId,
        filename,
        error: err.message,
        stack: err.stack,
      });

      // Determine which stage failed
      let failedStage = 'unknown';
      if (err.message && err.message.includes('OCR')) {
        failedStage = 'ocr';
      } else if (err.message && err.message.includes('AI')) {
        failedStage = 'ai';
      }

      // Emit processing error event
      this.dataHandlers.forEach((handler) => {
        if (handler && handler.emitProcessingError) {
          handler.emitProcessingError(filename, failedStage, err);
        }
      });

      const errorItem = {
        filename: filename,
        timestamp: new Date().toLocaleString(),
        extractedText: 'Error extracting text',
        gptResponse: `Error: ${err.message || err}`,
        usedContext: false,
        type: 'image',
      };
      this.processedData.push(errorItem);

      // COMMENTED OUT: Frontend removed - no longer needed
      // // Notify WebSocket clients about the error data
      // this.dataHandlers.forEach((handler) => {
      //   if (handler) {
      //     handler.notifyDataChanged(errorItem);
      //   }
      // });

      throw err;
    }
  }
}

export default new ImageProcessingService();
