/**
 * WebSocket handler for streaming transcription
 */
import { Server } from 'socket.io';
import pythonServiceWS from '../services/python-service.ws.js';
import { randomUUID } from 'crypto';
import logger from '../utils/logger.js';

const log = logger('StreamHandler');

class StreamHandler {
  constructor(io) {
    this.io = io;
    this.setupNamespace();
  }

  setupNamespace() {
    const namespace = this.io.of('/stream-transcribe');

    namespace.on('connection', (socket) => {
      const sessionId = randomUUID();
      log.info(`Client connected`, { socketId: socket.id, sessionId });

      let pythonWS = null;

      // Handle connection to Python service
      socket.on('start_stream', async () => {
        try {
          log.info(`Starting stream for session: ${sessionId}`);

          pythonWS = await pythonServiceWS.connect(
            sessionId,
            (transcription) => {
              // Forward transcription to frontend (but log is already done in python-service.ws.js)
              socket.emit('transcription', {
                sessionId: transcription.sessionId,
                text: transcription.text,
                confidence: transcription.confidence,
                final: transcription.final || false,
              });
            },
            (error) => {
              log.error(`Python WS error for session ${sessionId}`, error);
              socket.emit('error', {
                message: error.message || 'Transcription error',
              });
            },
          );

          socket.emit('stream_started', { sessionId });
        } catch (error) {
          log.error('Error starting stream', error);
          socket.emit('error', {
            message: error.message || 'Failed to start stream',
          });
        }
      });

      // Handle audio chunks from frontend
      socket.on('audio_chunk', (data) => {
        try {
          if (!pythonWS) {
            socket.emit('error', { message: 'Stream not started' });
            return;
          }

          // Decode base64 audio chunk
          const audioBuffer = Buffer.from(data.chunk, 'base64');

          log.debug(`Received audio chunk`, {
            sessionId,
            size: `${audioBuffer.length} bytes`,
          });

          // Forward to Python service
          pythonServiceWS.sendAudioChunk(sessionId, audioBuffer);
        } catch (error) {
          log.error('Error processing audio chunk', error);
          socket.emit('error', {
            message: error.message || 'Failed to process audio chunk',
          });
        }
      });

      // Handle flush buffer request
      socket.on('flush_buffer', async (data) => {
        try {
          const cutoffTimestamp = data?.cutoffTimestamp || null;
          const gracePeriodMs = data?.gracePeriodMs || 500;

          log.debug(`Flush buffer requested`, {
            sessionId,
            cutoffTimestamp,
          });

          if (!pythonWS) {
            socket.emit('error', { message: 'Stream not started' });
            return;
          }

          // Flush buffer via Python service
          await pythonServiceWS.flushBuffer(
            sessionId,
            cutoffTimestamp,
            gracePeriodMs,
          );

          socket.emit('buffer_flushed', { sessionId });
          log.debug(`Buffer flushed for session: ${sessionId}`);
        } catch (error) {
          log.error('Error flushing buffer', error);
          socket.emit('error', {
            message: error.message || 'Failed to flush buffer',
          });
        }
      });

      // Handle stream end
      socket.on('end_stream', () => {
        log.info(`Ending stream for session: ${sessionId}`);
        if (pythonWS) {
          pythonServiceWS.endStream(sessionId);
          // Wait a bit for Python to send stream_ended and close gracefully
          // The Python service will close the connection after sending stream_ended
          setTimeout(() => {
            pythonServiceWS.disconnect(sessionId);
            pythonWS = null;
          }, 500); // Give Python 500ms to close gracefully
        }
        socket.emit('stream_ended', { sessionId });
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        log.info(`Client disconnected`, {
          socketId: socket.id,
          sessionId,
          reason,
        });
        if (pythonWS) {
          pythonServiceWS.disconnect(sessionId);
          pythonWS = null;
        }
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

export default StreamHandler;
