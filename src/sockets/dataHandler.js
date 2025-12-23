/**
 * WebSocket handler for /data-updates namespace
 * Handles connection, error, and processing events
 *
 * Two main processing flows:
 * 1. Screenshot Flow:
 *    - Screenshot captured → OCR extraction → AI processing with 'system' prompt
 *    - Generates messageId and stores question/answer
 *
 * 2. Transcription Flow:
 *    - Receives text_chunk events → Accumulates chunks → process_transcription event
 *    - AI processing with 'transcription' prompt
 *    - Generates messageId and stores question/answer
 */
import { EventEmitter } from 'events';
import logger from '../utils/logger.js';
import aiService from '../services/ai.service.js';
import imageProcessingService from '../services/image-processing.service.js';

const log = logger('DataHandler');

// Constants
const VALID_PROMPT_TYPES = ['debug', 'theory', 'coding'];
const DEFAULT_PROMPT_TYPE = 'transcription'; // Default for transcription flow
const SCREENSHOT_PROMPT_TYPE = 'system'; // Default for screenshot flow

class DataHandler extends EventEmitter {
  constructor(io) {
    super();
    this.io = io;
    this.namespace = null;
    this.transcriptionChunks = new Map(); // Store transcription chunks per socket connection
    this.selectedPrompts = new Map(); // Store selected prompt type per socket connection
    this.messageData = new Map(); // Store messageId -> {question, answer, promptType, socketId, timestamp}
    this.pendingPrompts = new Map(); // Store pending prompts waiting for screenshots: socketId -> {promptType, messageId, screenshotRequired, question, answer}
    this.setupNamespace();
  }

  setupNamespace() {
    this.namespace = this.io.of('/data-updates');
    log.info('Setting up /data-updates namespace');

    this.namespace.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    log.info('Namespace setup complete');
  }

  /**
   * Handle new socket connection
   */
  handleConnection(socket) {
    log.info('Client connected', { socketId: socket.id });

    // Emit connected event
    this.emitToSocket(socket, 'connected', {
      socketId: socket.id,
      connectedAt: new Date().toISOString(),
      timestamp: Date.now(),
    });

    // Register event handlers
    socket.on('disconnect', (reason) => this.handleDisconnect(socket, reason));
    socket.on('error', (error) => this.handleError(socket, error));
    socket.on('use_prompt', (data) => this.handleUsePrompt(socket, data));
    socket.on('transcription', (data) =>
      this.handleTranscription(socket, data),
    );
    socket.on('process_transcription', () =>
      this.handleProcessTranscription(socket),
    );
  }

  /**
   * Handle socket disconnect
   */
  handleDisconnect(socket, reason) {
    log.info('Client disconnected', { socketId: socket.id, reason });

    // Clean up socket-specific data
    this.cleanupSocketData(socket.id);

    this.emitToSocket(socket, 'connection_status', {
      status: 'disconnected',
      socketId: socket.id,
      reason,
      timestamp: Date.now(),
    });
  }

  /**
   * Clean up all data associated with a socket
   */
  cleanupSocketData(socketId) {
    const cleanupActions = [
      {
        map: this.transcriptionChunks,
        name: 'transcription chunks',
      },
      {
        map: this.selectedPrompts,
        name: 'selected prompt',
      },
      {
        map: this.pendingPrompts,
        name: 'pending prompt',
      },
    ];

    cleanupActions.forEach(({ map, name }) => {
      if (map.has(socketId)) {
        map.delete(socketId);
        log.info(`Cleaned up ${name} for disconnected socket`, { socketId });
      }
    });
  }

  /**
   * Handle socket errors
   */
  handleError(socket, error) {
    const errorMessage = error.message || 'Unknown error';
    log.error('Socket error', { socketId: socket.id, error: errorMessage });

    this.emitToSocket(socket, 'error', {
      socketId: socket.id,
      error: errorMessage,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle use_prompt event
   */
  async handleUsePrompt(socket, data) {
    const { promptType, screenshotRequired = false, messageId } = data || {};

    // Validate input
    const validationError = this.validateUsePromptInput(
      socket,
      promptType,
      messageId,
    );
    if (validationError) {
      return; // Error already emitted
    }

    // Get stored message data
    const messageData = this.messageData.get(messageId);
    if (!messageData) {
      log.warn('Message data not found for messageId', {
        socketId: socket.id,
        messageId,
      });
      this.emitToSocket(socket, 'use_prompt_error', {
        error: 'Message data not found for the provided messageId',
        messageId,
      });
      return;
    }

    const { question, answer } = messageData;

    // Handle screenshot required case
    if (screenshotRequired) {
      this.handleScreenshotRequired(socket, {
        promptType,
        messageId,
        question,
        answer,
      });
      return;
    }

    // Process immediately without screenshot
    this.emitToSocket(socket, 'use_prompt_set', {
      promptType,
      messageId,
      screenshotRequired: false,
      message: `Processing with ${promptType} prompt`,
      timestamp: Date.now(),
    });

    await this.processPromptWithQuestion(
      socket,
      promptType,
      messageId,
      question,
      answer,
      null, // No screenshot text
    );
  }

  /**
   * Validate use_prompt input
   */
  validateUsePromptInput(socket, promptType, messageId) {
    // Validate prompt type
    if (!promptType || !VALID_PROMPT_TYPES.includes(promptType)) {
      log.warn('Invalid prompt type received', {
        socketId: socket.id,
        promptType,
        validTypes: VALID_PROMPT_TYPES,
      });
      this.emitToSocket(socket, 'use_prompt_error', {
        error: `Invalid prompt type. Must be one of: ${VALID_PROMPT_TYPES.join(
          ', ',
        )}`,
        received: promptType,
      });
      return true; // Error occurred
    }

    // Validate messageId
    if (!messageId) {
      log.warn('Missing messageId in use_prompt', { socketId: socket.id });
      this.emitToSocket(socket, 'use_prompt_error', {
        error: 'messageId is required',
      });
      return true; // Error occurred
    }

    return false; // No error
  }

  /**
   * Handle screenshot required case
   */
  handleScreenshotRequired(
    socket,
    { promptType, messageId, question, answer },
  ) {
    log.info('Screenshot required, waiting for screenshot', {
      socketId: socket.id,
      messageId,
      promptType,
    });

    // Store pending prompt
    this.pendingPrompts.set(socket.id, {
      promptType,
      messageId,
      screenshotRequired: true,
      question,
      answer,
    });

    this.emitToSocket(socket, 'use_prompt_set', {
      promptType,
      messageId,
      screenshotRequired: true,
      message: `Waiting for screenshot to process with ${promptType} prompt`,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle transcription chunk event
   */
  handleTranscription(socket, data) {
    const { textChunk } = data || {};

    if (!textChunk || typeof textChunk !== 'string') {
      log.warn('Invalid transcription chunk received', {
        socketId: socket.id,
        data,
      });
      return;
    }

    // Initialize array if it doesn't exist for this socket
    if (!this.transcriptionChunks.has(socket.id)) {
      this.transcriptionChunks.set(socket.id, []);
    }

    // Add chunk to the array
    const chunks = this.transcriptionChunks.get(socket.id);
    chunks.push(textChunk);

    log.debug('Transcription chunk received', {
      socketId: socket.id,
      chunkLength: textChunk.length,
      totalChunks: chunks.length,
    });
  }

  /**
   * Handle process_transcription event (Transcription Flow)
   * Processes accumulated transcription chunks with 'transcription' prompt
   * Generates messageId and stores question/answer for use_prompt functionality
   */
  async handleProcessTranscription(socket) {
    const chunks = this.transcriptionChunks.get(socket.id);

    if (!chunks || chunks.length === 0) {
      log.warn('No transcription chunks found for processing', {
        socketId: socket.id,
      });
      this.emitToSocket(socket, 'aiprocessing_error', {
        error: 'No transcription data available',
        message: 'Error during transcription processing',
      });
      return;
    }

    try {
      // Combine all chunks into full transcription
      const fullTranscription = chunks.join(' ');

      log.info('Processing transcription', {
        socketId: socket.id,
        chunkCount: chunks.length,
        transcriptionLength: fullTranscription.length,
      });

      // Emit AI processing started event
      this.emitAIStarted('transcription', fullTranscription, false);

      const aiStartTime = Date.now();

      // Get selected prompt type for this socket (default to 'transcription')
      const promptType =
        this.selectedPrompts.get(socket.id) || DEFAULT_PROMPT_TYPE;

      // Call AI service to process transcription
      const aiResponse = await aiService.askGptTranscription(
        fullTranscription,
        promptType,
      );

      const aiDuration = Date.now() - aiStartTime;
      const provider = aiResponse.provider || 'unknown';
      const responseContent = aiResponse.message.content;

      // Generate messageId for this transcription processing
      const messageId = this.generateMessageId();

      // Store question (transcription text) and answer (AI response) with messageId
      this.storeMessageData(
        messageId,
        fullTranscription, // question = transcription text
        responseContent, // answer = AI response
        promptType, // 'transcription' prompt type
        socket.id,
      );

      // Store the AI response in imageProcessingService
      const processedItem = {
        filename: 'transcription',
        timestamp: new Date().toLocaleString(),
        extractedText:
          fullTranscription.substring(0, 500) +
          (fullTranscription.length > 500 ? '...' : ''),
        gptResponse:
          responseContent.substring(0, 1000) +
          (responseContent.length > 1000 ? '...' : ''),
        usedContext: false,
        type: 'transcription',
      };
      imageProcessingService.addProcessedData(processedItem);

      // Update last response for potential context use
      imageProcessingService.setLastResponse(responseContent);

      // Clear transcription chunks after processing
      this.transcriptionChunks.delete(socket.id);

      log.info('Transcription processing completed successfully', {
        socketId: socket.id,
        messageId,
        provider,
        aiDuration: `${aiDuration}ms`,
        responseLength: responseContent.length,
      });

      // Emit AI processing complete event with messageId
      this.emitAIComplete(
        'transcription',
        responseContent,
        provider,
        aiDuration,
        false,
        messageId,
      );
    } catch (err) {
      log.error('Error processing transcription', {
        socketId: socket.id,
        error: err.message,
        stack: err.stack,
      });

      // Clear chunks even on error
      this.transcriptionChunks.delete(socket.id);

      // Emit processing error event
      this.emitProcessingError('transcription', 'transcription', err);
    }
  }

  /**
   * Process prompt with question and optional screenshot text
   * Generates a new messageId for the response and stores question/answer
   */
  async processPromptWithQuestion(
    socket,
    promptType,
    sourceMessageId,
    question,
    answer,
    screenshotText,
  ) {
    try {
      const socketId = socket?.id || 'unknown';
      log.info('Processing prompt with question', {
        socketId,
        promptType,
        sourceMessageId,
        hasScreenshotText: !!screenshotText,
      });

      // Emit AI processing started event
      this.emitAIStarted('prompt', question, false);

      const aiStartTime = Date.now();

      // Build prompt text based on prompt type
      const promptText = this.buildPromptText(
        promptType,
        question,
        answer,
        screenshotText,
      );

      // Call AI service with appropriate prompt type
      const gptResponse = await aiService.askGpt(promptText, promptType);

      const aiDuration = Date.now() - aiStartTime;
      const provider = gptResponse.provider || 'unknown';
      const responseContent = gptResponse.message.content;

      // Generate NEW messageId for this response
      const newMessageId = this.generateMessageId();

      // Store question and answer with the NEW messageId
      this.storeMessageData(
        newMessageId,
        question, // Store the question from source
        responseContent,
        promptType,
        socketId,
      );

      log.info('Prompt processing completed successfully', {
        socketId,
        sourceMessageId,
        newMessageId,
        promptType,
        provider,
        aiDuration: `${aiDuration}ms`,
        responseLength: responseContent.length,
      });

      // Emit AI processing complete event with NEW messageId
      this.emitAIComplete(
        'prompt',
        responseContent,
        provider,
        aiDuration,
        false,
        newMessageId,
      );
    } catch (err) {
      log.error('Error processing prompt with question', {
        socketId: socket?.id || 'unknown',
        sourceMessageId,
        promptType,
        error: err.message,
        stack: err.stack,
      });

      // Emit processing error event
      this.emitProcessingError('prompt', 'prompt', err);
    }
  }

  /**
   * Build prompt text based on prompt type
   */
  buildPromptText(promptType, question, answer, screenshotText) {
    switch (promptType) {
      case 'debug':
        // For debug: pass question, answer, and screenshot text if available
        let promptText = `Question: ${question}\n\nAnswer: ${answer}`;
        if (screenshotText) {
          promptText += `\n\nScreenshot text:\n${screenshotText}`;
        }
        return promptText;

      case 'theory':
      case 'coding':
        // For theory/coding: pass just the question
        return question;

      default:
        throw new Error(`Unknown prompt type: ${promptType}`);
    }
  }

  /**
   * Generate a unique messageId
   */
  generateMessageId() {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ==================== Message Data Management ====================

  /**
   * Store message data (question and answer) with messageId
   */
  storeMessageData(messageId, question, answer, promptType, socketId) {
    this.messageData.set(messageId, {
      question,
      answer,
      promptType,
      socketId,
      timestamp: Date.now(),
    });
    log.info('Message data stored', {
      messageId,
      questionLength: question?.length || 0,
      answerLength: answer?.length || 0,
      promptType,
      socketId,
    });
  }

  /**
   * Get message data by messageId
   */
  getMessageData(messageId) {
    return this.messageData.get(messageId) || null;
  }

  // ==================== Pending Prompts Management ====================

  /**
   * Get pending prompt for a socket
   */
  getPendingPrompt(socketId) {
    return this.pendingPrompts.get(socketId) || null;
  }

  /**
   * Clear pending prompt for a socket
   */
  clearPendingPrompt(socketId) {
    this.pendingPrompts.delete(socketId);
  }

  // ==================== Utility Methods ====================

  /**
   * Get selected prompt type from any active socket
   * Returns the first available prompt type, or null if none set
   */
  getSelectedPromptType() {
    if (this.selectedPrompts.size === 0) {
      return null;
    }
    return this.selectedPrompts.values().next().value;
  }

  /**
   * Emit event to a specific socket
   */
  emitToSocket(socket, event, data) {
    if (socket && socket.emit) {
      socket.emit(event, data);
    }
  }

  // ==================== Event Emitters ====================

  /**
   * Emit screenshot captured event
   */
  emitScreenshotCaptured(filename, filePath) {
    if (!this.namespace) {
      log.warn('Namespace not initialized, skipping emit');
      return;
    }

    log.info('Screenshot captured', { filename });
    this.namespace.emit('screenshot_captured', {
      message: `Screenshot captured: ${filename}`,
    });
  }

  /**
   * Emit OCR processing started event
   */
  emitOCRStarted(filename, filePath) {
    if (!this.namespace) {
      log.warn('Namespace not initialized, skipping emit');
      return;
    }

    log.info('OCR started');
    this.namespace.emit('ocr_started', { message: 'OCR started' });
  }

  /**
   * Emit OCR processing completed event
   */
  emitOCRComplete(filename, extractedText, duration) {
    if (!this.namespace) {
      log.warn('Namespace not initialized, skipping emit');
      return;
    }

    log.info('OCR completed', { extractedTextLength: extractedText?.length });
    this.namespace.emit('ocr_complete', { message: 'OCR completed' });
  }

  /**
   * Emit AI processing started event
   */
  emitAIStarted(filename, extractedText, useContext) {
    if (!this.namespace) {
      log.warn('Namespace not initialized, skipping emit');
      return;
    }

    log.info('AI processing started');
    this.namespace.emit('ai_processing_started', {
      message: 'AI processing started',
    });
  }

  /**
   * Emit AI processing completed event
   */
  emitAIComplete(
    filename,
    response,
    provider,
    duration,
    useContext,
    messageId = null,
  ) {
    if (!this.namespace) {
      log.warn('Namespace not initialized, skipping emit');
      return;
    }

    log.info('AI processing completed', {
      messageId,
      responseLength: response?.length,
    });

    const eventData = {
      response,
      message: 'AI processing completed',
    };

    if (messageId) {
      eventData.messageId = messageId;
    }

    this.namespace.emit('ai_processing_complete', eventData);
  }

  /**
   * Emit processing error event
   */
  emitProcessingError(filename, stage, error) {
    if (!this.namespace) {
      log.warn('Namespace not initialized, skipping emit');
      return;
    }

    const errorMessage = error.message || 'Unknown error';
    log.error(`Error during ${stage} processing`, { error: errorMessage });

    this.namespace.emit('aiprocessing_error', {
      error: errorMessage,
      message: `Error during ${stage} processing`,
    });
  }
}

export default DataHandler;
