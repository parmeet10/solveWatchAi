/**
 * WebSocket handler for text stream from mobile devices
 * Receives text chunks from Sherpa-ONNX on mobile app
 */
import { randomUUID } from 'crypto';
import logger from '../utils/logger.js';
import textRefinementService from '../services/text-refinement.service.js';
import questionExtractionService from '../services/question-extraction.service.js';
import questionStorageService from '../services/question-storage.service.js';

const log = logger('TextStreamHandler');

class TextStreamHandler {
  constructor(io) {
    this.io = io;
    this.setupNamespace();
  }

  setupNamespace() {
    const namespace = this.io.of('/text-stream');

    namespace.on('connection', (socket) => {
      const sessionId = randomUUID();
      log.debug(`Client connected: ${sessionId}`);

      // Send session ID to client
      socket.emit('session_started', { sessionId });

      // Handle text chunks from mobile app
      socket.on('text_chunk', async (data) => {
        try {
          if (!data || !data.text) {
            socket.emit('error', { message: 'Invalid text chunk data' });
            return;
          }

          const { text, timestamp } = data;
          const chunkTimestamp = timestamp || Date.now();

          log.debug(`Text chunk received: ${text.length} chars`);

          // Step 1: Refine the text (fix errors)
          let refinedText;
          try {
            refinedText = await textRefinementService.refineTextChunk(text);
            log.debug(
              `Text refined: ${text.length} -> ${refinedText.length} chars`,
            );
          } catch (refineError) {
            log.error('Error refining text', refineError);
            refinedText = text; // Use original text if refinement fails
          }

          // Step 2: Extract technical questions from refined text
          let questions = [];
          if (refinedText && refinedText.trim().length > 0) {
            try {
              questions = await questionExtractionService.extractQuestions(
                refinedText,
                sessionId,
              );
              log.debug(`Questions extracted: ${questions.length}`);
            } catch (extractError) {
              log.error('Error extracting questions', extractError);
            }
          }

          // Step 3: Store questions if any were extracted
          if (questions.length > 0) {
            questionStorageService.addQuestions(
              sessionId,
              questions,
              chunkTimestamp,
            );

            // Notify client about extracted questions
            socket.emit('questions_extracted', {
              sessionId,
              questions: questions.map((q) => ({
                question: q.question,
                confidence: q.confidence,
              })),
            });

            log.info(
              `Questions stored: ${questions.length} for session ${sessionId}`,
            );
          }
        } catch (error) {
          log.error('Error processing text chunk', error);
          socket.emit('error', {
            message: error.message || 'Failed to process text chunk',
          });
        }
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        log.debug(`Client disconnected: ${sessionId} (${reason})`);
        // Keep session alive (don't remove) so questions can still be retrieved
        // Sessions will be cleaned up when questions are processed
      });

      // Handle errors
      socket.on('error', (error) => {
        log.error(`Error for session ${sessionId}`, error);
        socket.emit('error', {
          message: error.message || 'An error occurred',
        });
      });
    });
  }
}

export default TextStreamHandler;
