import aiService from '../services/ai.service.js';
import imageProcessingService from '../services/image-processing.service.js';
import emailService from '../services/email.service.js';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

const log = logger('ClipboardController');

const EMAIL_CONFIG_FILE_PATH = path.join(
  process.cwd(),
  'backend',
  'config',
  'email-config.json',
);

class ClipboardController {
  async processClipboard(req, res) {
    try {
      const { content } = req.body;

      if (!content || typeof content !== 'string') {
        return res
          .status(400)
          .json({
            error: 'Clipboard content is required and must be a string',
          });
      }

      // Check if context mode is enabled
      const useContextEnabled = imageProcessingService.getUseContextEnabled();

      if (useContextEnabled) {
        const lastResponse = imageProcessingService.getLastResponse();
        if (lastResponse) {
          log.info('Processing clipboard content (Context Mode: ENABLED)');
        } else {
          log.info(
            'Processing clipboard content (Context Mode: ENABLED, but no previous context)',
          );
        }
      } else {
        log.info('Processing clipboard content (Context Mode: DISABLED)');
      }

      let aiResponse;

      if (useContextEnabled) {
        // Get the last processed response for context
        const lastResponse = imageProcessingService.getLastResponse();
        aiResponse = await aiService.askGptWithContext(content, lastResponse);
      } else {
        // Use clipboard-specific prompt
        aiResponse = await aiService.askGptClipboard(content);
      }

      const responseText = aiResponse.message.content;

      // Store the response for context mode
      imageProcessingService.setLastResponse(responseText);

      // Create a processed data entry similar to screenshot processing
      const processedEntry = {
        filename: 'clipboard',
        timestamp: new Date().toLocaleString(),
        extractedText:
          content.substring(0, 500) + (content.length > 500 ? '...' : ''),
        gptResponse:
          responseText.substring(0, 1000) +
          (responseText.length > 1000 ? '...' : ''),
        usedContext:
          useContextEnabled &&
          imageProcessingService.getLastResponse() !== null,
      };

      // Add to processed data (similar to how screenshots are handled)
      imageProcessingService.addProcessedData(processedEntry);

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
            'CodeSnapGPT - Processed Clipboard Content',
            responseText,
          );
        }
      } catch (emailErr) {
        log.error('Error sending email (non-fatal)', emailErr);
        // Don't throw - email failure shouldn't break the main flow
      }

      log.info('Clipboard content processed successfully');

      res.json({
        success: true,
        data: processedEntry,
      });
    } catch (err) {
      log.error('Error processing clipboard content', err);
      res.status(500).json({
        error: 'Failed to process clipboard content',
        details: err.message,
      });
    }
  }
}

export default new ClipboardController();
