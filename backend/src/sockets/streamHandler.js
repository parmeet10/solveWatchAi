/**
 * WebSocket handler for streaming transcription
 */
import { Server } from 'socket.io';
import pythonServiceWS from '../services/python-service.ws.js';
import { randomUUID } from 'crypto';

class StreamHandler {
  constructor(io) {
    this.io = io;
    this.setupNamespace();
  }

  setupNamespace() {
    const namespace = this.io.of('/stream-transcribe');

    namespace.on('connection', (socket) => {
      const sessionId = randomUUID();
      console.log(
        `[Socket.io] Client connected: ${socket.id}, Session: ${sessionId}`,
      );

      let pythonWS = null;

      // Handle connection to Python service
      socket.on('start_stream', async () => {
        try {
          console.log(`[Socket.io] Starting stream for session: ${sessionId}`);

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
              console.error(
                `[Socket.io] Python WS error for session ${sessionId}:`,
                error,
              );
              socket.emit('error', {
                message: error.message || 'Transcription error',
              });
            },
          );

          socket.emit('stream_started', { sessionId });
        } catch (error) {
          console.error(`[Socket.io] Error starting stream:`, error);
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

          console.log(
            `[Socket.io] Received audio chunk for session ${sessionId}, size: ${audioBuffer.length} bytes`,
          );

          // Forward to Python service
          pythonServiceWS.sendAudioChunk(sessionId, audioBuffer);
        } catch (error) {
          console.error(`[Socket.io] Error processing audio chunk:`, error);
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

          console.log(
            `[Socket.io] Flush buffer requested for session: ${sessionId}, cutoff: ${cutoffTimestamp}`,
          );

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
          console.log(`[Socket.io] Buffer flushed for session: ${sessionId}`);
        } catch (error) {
          console.error(`[Socket.io] Error flushing buffer:`, error);
          socket.emit('error', {
            message: error.message || 'Failed to flush buffer',
          });
        }
      });

      // Handle stream end
      socket.on('end_stream', () => {
        console.log(`[Socket.io] Ending stream for session: ${sessionId}`);
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
        console.log(
          `[Socket.io] Client disconnected: ${socket.id}, Session: ${sessionId}, Reason: ${reason}`,
        );
        if (pythonWS) {
          pythonServiceWS.disconnect(sessionId);
          pythonWS = null;
        }
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`[Socket.io] Error for session ${sessionId}:`, error);
        socket.emit('error', {
          message: error.message || 'An error occurred',
        });
      });
    });
  }
}

export default StreamHandler;
