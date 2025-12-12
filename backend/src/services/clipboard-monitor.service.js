import clipboardy from 'clipboardy';
import aiService from './ai.service.js';
import imageProcessingService from './image-processing.service.js';
import logger from '../utils/logger.js';

const log = logger('ClipboardMonitor');

class ClipboardMonitorService {
  constructor(options = {}) {
    this.interval = options.interval || 300; // Check every 300ms
    this.lastContent = '';
    this.isRunning = false;
    this.onChange = options.onChange || this.defaultHandler;
    this.autoProcess = options.autoProcess !== false; // Auto-process by default
  }

  defaultHandler(content) {
    log.debug('Clipboard changed', { length: content.length });
  }

  async processClipboardContent(content) {
    try {
      // Check if context mode is enabled
      const useContextEnabled = imageProcessingService.getUseContextEnabled();

      if (useContextEnabled) {
        const lastResponse = imageProcessingService.getLastResponse();
        if (lastResponse) {
          log.info(
            'Processing clipboard content with AI (Context Mode: ENABLED)',
          );
        } else {
          log.info(
            'Processing clipboard content with AI (Context Mode: ENABLED, but no previous context)',
          );
        }
      } else {
        log.info(
          'Processing clipboard content with AI (Context Mode: DISABLED)',
        );
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

      // Create a processed data entry
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

      // Add to processed data
      imageProcessingService.addProcessedData(processedEntry);

      log.info('Clipboard content processed successfully', {
        responseLength: responseText.length,
      });

      return processedEntry;
    } catch (err) {
      log.error('Error processing clipboard content', err);
      throw err;
    }
  }

  async start() {
    if (this.isRunning) {
      log.warn('Clipboard monitor is already running');
      return;
    }

    this.isRunning = true;
    log.info('Clipboard monitor started', {
      interval: `${this.interval}ms`,
      autoProcess: this.autoProcess,
    });

    // Get initial clipboard content and set as baseline (ignore existing content)
    try {
      this.lastContent = await clipboardy.read();
      if (this.lastContent.trim() !== '') {
        log.debug('Existing clipboard content detected (will be ignored)');
      }
    } catch (error) {
      this.lastContent = '';
      log.warn('Could not read initial clipboard content', {
        error: error.message,
      });
    }

    // Start monitoring
    this.intervalId = setInterval(async () => {
      try {
        const currentContent = await clipboardy.read();

        // Check if clipboard content has changed
        if (
          currentContent !== this.lastContent &&
          currentContent.trim() !== ''
        ) {
          this.lastContent = currentContent;

          // Log the clipboard change
          this.onChange(currentContent);

          // Auto-process if enabled
          if (this.autoProcess) {
            try {
              await this.processClipboardContent(currentContent);
            } catch (error) {
              log.error('Error auto-processing clipboard', error);
            }
          }
        }
      } catch (error) {
        // Silently handle clipboard read errors (might be permission issues)
        // Only log if it's a different error than permission denied
        if (
          !error.message.includes('permission') &&
          !error.message.includes('denied')
        ) {
          log.warn('Error reading clipboard', { error: error.message });
        }
      }
    }, this.interval);
  }

  stop() {
    if (!this.isRunning) {
      log.warn('Clipboard monitor is not running');
      return;
    }

    clearInterval(this.intervalId);
    this.isRunning = false;
    log.info('Clipboard monitor stopped');
  }

  setAutoProcess(enabled) {
    this.autoProcess = enabled;
    log.info(`Auto-process ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }
}

export default new ClipboardMonitorService({
  interval: 300, // Check every 300ms
  autoProcess: true, // Auto-process clipboard content
});
