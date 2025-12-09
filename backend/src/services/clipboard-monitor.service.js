import clipboardy from 'clipboardy';
import aiService from './ai.service.js';
import imageProcessingService from './image-processing.service.js';

class ClipboardMonitorService {
  constructor(options = {}) {
    this.interval = options.interval || 300; // Check every 300ms
    this.lastContent = '';
    this.isRunning = false;
    this.onChange = options.onChange || this.defaultHandler;
    this.autoProcess = options.autoProcess !== false; // Auto-process by default
  }

  defaultHandler(content) {
    const timestamp = new Date().toLocaleTimeString();
    console.log('\n📋 Clipboard changed:');
    console.log('─'.repeat(50));
    console.log(content);
    console.log('─'.repeat(50));
    console.log(`[${timestamp}] Length: ${content.length} characters\n`);
  }

  async processClipboardContent(content) {
    try {
      // Check if context mode is enabled
      const useContextEnabled = imageProcessingService.getUseContextEnabled();
      
      if (useContextEnabled) {
        const lastResponse = imageProcessingService.getLastResponse();
        if (lastResponse) {
          console.log('🤖 Processing clipboard content with AI (Context Mode: ENABLED)...');
          console.log('📚 Using previous response as context');
        } else {
          console.log('🤖 Processing clipboard content with AI (Context Mode: ENABLED, but no previous context)...');
        }
      } else {
        console.log('🤖 Processing clipboard content with AI (Context Mode: DISABLED)...');
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
        usedContext: useContextEnabled && imageProcessingService.getLastResponse() !== null,
      };

      // Add to processed data
      imageProcessingService.addProcessedData(processedEntry);

      console.log('✅ Clipboard content processed successfully');
      console.log('📝 AI Response preview:', responseText.substring(0, 200) + '...\n');
      
      return processedEntry;
    } catch (err) {
      console.error('❌ Error processing clipboard content:', err.message);
      throw err;
    }
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️  Clipboard monitor is already running!');
      return;
    }

    this.isRunning = true;
    console.log('\n🚀 Clipboard monitor started!');
    console.log('👀 Watching for clipboard changes...');
    console.log(`⏱️  Check interval: ${this.interval}ms`);
    console.log(`🤖 Auto-process: ${this.autoProcess ? 'ENABLED' : 'DISABLED'}`);

    // Get initial clipboard content and set as baseline (ignore existing content)
    try {
      this.lastContent = await clipboardy.read();
      if (this.lastContent.trim() !== '') {
        console.log('📋 Existing clipboard content detected (will be ignored - only new changes will be processed)');
        console.log('');
      } else {
        console.log('📋 Clipboard is empty - ready to monitor for new content\n');
      }
    } catch (error) {
      this.lastContent = '';
      console.log('⚠️  Could not read initial clipboard content:', error.message);
      console.log('📋 Will monitor for new clipboard changes\n');
    }

    // Start monitoring
    this.intervalId = setInterval(async () => {
      try {
        const currentContent = await clipboardy.read();

        // Check if clipboard content has changed
        if (currentContent !== this.lastContent && currentContent.trim() !== '') {
          this.lastContent = currentContent;
          
          // Log the clipboard change
          this.onChange(currentContent);

          // Auto-process if enabled
          if (this.autoProcess) {
            try {
              await this.processClipboardContent(currentContent);
            } catch (error) {
              console.error('❌ Error auto-processing clipboard:', error.message);
            }
          }
        }
      } catch (error) {
        // Silently handle clipboard read errors (might be permission issues)
        // Only log if it's a different error than permission denied
        if (!error.message.includes('permission') && !error.message.includes('denied')) {
          console.error('⚠️  Error reading clipboard:', error.message);
        }
      }
    }, this.interval);
  }

  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Clipboard monitor is not running!');
      return;
    }

    clearInterval(this.intervalId);
    this.isRunning = false;
    console.log('\n👋 Clipboard monitor stopped!');
  }

  setAutoProcess(enabled) {
    this.autoProcess = enabled;
    console.log(`🔄 Auto-process ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }
}

export default new ClipboardMonitorService({
  interval: 300, // Check every 300ms
  autoProcess: true, // Auto-process clipboard content
});

