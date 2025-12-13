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
      const connectionInfo = {
        sessionId,
        socketId: socket.id,
        connectedAt: new Date().toISOString(),
        ip: socket.handshake.address,
      };

      log.info('Client connected to text-stream', connectionInfo);

      // Send session ID to client with connection confirmation
      socket.emit('session_started', {
        sessionId,
        connectedAt: connectionInfo.connectedAt,
        message: 'Connected successfully. Ready to receive text chunks.',
      });

      // Emit connection status to client
      socket.emit('connection_status', {
        status: 'connected',
        sessionId,
        timestamp: Date.now(),
      });

      // Handle text chunks from mobile app
      socket.on('text_chunk', async (data) => {
        const chunkId = randomUUID();
        const startTime = Date.now();

        try {
          if (!data || !data.text) {
            log.warn('Invalid text chunk received', {
              sessionId,
              chunkId,
              data: data || 'null',
            });
            socket.emit('error', {
              message: 'Invalid text chunk data',
              chunkId,
            });
            socket.emit('text_chunk_status', {
              status: 'error',
              chunkId,
              error: 'Invalid text chunk data',
              timestamp: Date.now(),
            });
            return;
          }

          const { text, timestamp } = data;
          const chunkTimestamp = timestamp || Date.now();

          log.info('Text chunk received', {
            sessionId,
            chunkId,
            textLength: text.length,
            textPreview: text.substring(0, 100),
            timestamp: chunkTimestamp,
          });

          // Emit chunk_received event with full details (best practice: immediate acknowledgment)
          socket.emit('chunk_received', {
            chunkId,
            sessionId,
            text: text,
            textLength: text.length,
            textPreview: text.substring(0, 200),
            receivedAt: new Date().toISOString(),
            timestamp: chunkTimestamp,
            status: 'received',
            message: 'Text chunk received and queued for processing',
          });

          // Notify client that chunk is being processed
          socket.emit('text_chunk_status', {
            status: 'processing',
            chunkId,
            stage: 'received',
            timestamp: Date.now(),
          });

          // Step 1: Refine the text (fix errors)
          let refinedText;
          try {
            log.info('Sending text to refinement service', {
              sessionId,
              chunkId,
              originalText: text,
              originalLength: text.length,
            });

            socket.emit('text_chunk_status', {
              status: 'processing',
              chunkId,
              stage: 'refining',
              timestamp: Date.now(),
            });

            refinedText = await textRefinementService.refineTextChunk(text);

            const refineDuration = Date.now() - startTime;
            log.info('Text refinement completed', {
              sessionId,
              chunkId,
              originalText: text,
              refinedText: refinedText,
              originalLength: text.length,
              refinedLength: refinedText.length,
              duration: `${refineDuration}ms`,
            });

            socket.emit('text_refined', {
              chunkId,
              originalText: text,
              refinedText: refinedText,
              timestamp: Date.now(),
            });
          } catch (refineError) {
            log.error('Error refining text', {
              sessionId,
              chunkId,
              originalText: text,
              error: refineError.message,
              stack: refineError.stack,
            });
            refinedText = text; // Use original text if refinement fails

            socket.emit('text_chunk_status', {
              status: 'warning',
              chunkId,
              stage: 'refining',
              warning: 'Refinement failed, using original text',
              timestamp: Date.now(),
            });
          }

          // Step 2: Extract technical questions from refined text
          let questions = [];
          if (refinedText && refinedText.trim().length > 0) {
            try {
              log.info('Extracting questions from refined text', {
                sessionId,
                chunkId,
                refinedText: refinedText,
              });

              socket.emit('text_chunk_status', {
                status: 'processing',
                chunkId,
                stage: 'extracting_questions',
                timestamp: Date.now(),
              });

              questions = await questionExtractionService.extractQuestions(
                refinedText,
                sessionId,
              );

              log.info('Questions extracted', {
                sessionId,
                chunkId,
                questionCount: questions.length,
                questions: questions.map((q) => ({
                  question: q.question,
                  type: q.type,
                  confidence: q.confidence,
                })),
              });
            } catch (extractError) {
              log.error('Error extracting questions', {
                sessionId,
                chunkId,
                refinedText: refinedText,
                error: extractError.message,
                stack: extractError.stack,
              });

              socket.emit('text_chunk_status', {
                status: 'error',
                chunkId,
                stage: 'extracting_questions',
                error: extractError.message,
                timestamp: Date.now(),
              });
            }
          }

          // Step 3: Store questions if any were extracted
          if (questions.length > 0) {
            log.info('Storing questions', {
              sessionId,
              chunkId,
              questionCount: questions.length,
              questions: questions.map((q) => ({
                question: q.question,
                type: q.type,
                confidence: q.confidence,
              })),
            });

            questionStorageService.addQuestions(
              sessionId,
              questions,
              chunkTimestamp,
            );

            const storedQuestions =
              questionStorageService.getQuestions(sessionId);
            log.info('Questions stored successfully', {
              sessionId,
              chunkId,
              totalQuestionsInSession: storedQuestions.length,
              newlyStored: questions.length,
              storedQuestions: storedQuestions.map((q) => ({
                question: q.question,
                type: q.type,
                confidence: q.confidence,
                timestamp: q.timestamp,
              })),
            });

            // Notify client about extracted questions
            socket.emit('questions_extracted', {
              sessionId,
              chunkId,
              questions: questions.map((q) => ({
                question: q.question,
                confidence: q.confidence,
                type: q.type,
              })),
              totalQuestionsInSession: storedQuestions.length,
              timestamp: Date.now(),
            });

            socket.emit('text_chunk_status', {
              status: 'completed',
              chunkId,
              stage: 'completed',
              questionsExtracted: questions.length,
              timestamp: Date.now(),
            });
          } else {
            log.info('No questions extracted from text chunk', {
              sessionId,
              chunkId,
              refinedText: refinedText,
            });

            socket.emit('text_chunk_status', {
              status: 'completed',
              chunkId,
              stage: 'completed',
              questionsExtracted: 0,
              message: 'No questions found in text',
              timestamp: Date.now(),
            });
          }

          const totalDuration = Date.now() - startTime;
          log.info('Text chunk processing completed', {
            sessionId,
            chunkId,
            totalDuration: `${totalDuration}ms`,
            questionsExtracted: questions.length,
          });

          // Emit chunk_processing_complete event with full summary (best practice: final status)
          socket.emit('chunk_processing_complete', {
            chunkId,
            sessionId,
            status: 'completed',
            completedAt: new Date().toISOString(),
            duration: totalDuration,
            durationMs: totalDuration,
            summary: {
              originalText: text,
              originalLength: text.length,
              refinedText: refinedText,
              refinedLength: refinedText.length,
              questionsExtracted: questions.length,
              questions: questions.map((q) => ({
                question: q.question,
                type: q.type,
                confidence: q.confidence,
              })),
              totalQuestionsInSession:
                questionStorageService.getQuestions(sessionId).length,
            },
            stages: {
              received: true,
              refined: true,
              questionsExtracted: true,
              stored: questions.length > 0,
            },
            message:
              questions.length > 0
                ? `Processing completed. ${questions.length} question(s) extracted and stored.`
                : 'Processing completed. No questions found in text.',
          });
        } catch (error) {
          const errorDuration = Date.now() - startTime;
          log.error('Error processing text chunk', {
            sessionId,
            chunkId,
            error: error.message,
            stack: error.stack,
          });

          // Emit chunk_processing_complete with error status (best practice: always notify completion)
          socket.emit('chunk_processing_complete', {
            chunkId,
            sessionId,
            status: 'error',
            completedAt: new Date().toISOString(),
            duration: errorDuration,
            durationMs: errorDuration,
            error: {
              message: error.message || 'Failed to process text chunk',
              code: error.code || 'PROCESSING_ERROR',
            },
            message: 'Processing failed. Please try again.',
          });

          socket.emit('error', {
            message: error.message || 'Failed to process text chunk',
            chunkId,
            timestamp: Date.now(),
          });

          socket.emit('text_chunk_status', {
            status: 'error',
            chunkId,
            error: error.message,
            timestamp: Date.now(),
          });
        }
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        const disconnectInfo = {
          sessionId,
          socketId: socket.id,
          reason,
          disconnectedAt: new Date().toISOString(),
        };

        log.info('Client disconnected from text-stream', disconnectInfo);

        // Emit disconnection status
        socket.emit('connection_status', {
          status: 'disconnected',
          sessionId,
          reason,
          timestamp: Date.now(),
        });

        // Keep session alive (don't remove) so questions can still be retrieved
        // Sessions will be cleaned up when questions are processed
      });

      // Handle errors
      socket.on('error', (error) => {
        log.error('Socket error', {
          sessionId,
          socketId: socket.id,
          error: error.message || error,
          stack: error.stack,
        });

        socket.emit('error', {
          message: error.message || 'An error occurred',
          timestamp: Date.now(),
        });
      });
    });
  }
}

export default TextStreamHandler;
