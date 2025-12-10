/**
 * WebSocket client for Python transcription service streaming
 */
import WebSocket from 'ws';
import { CONFIG } from '../config/constants.js';
import transcriptionStorageService from './transcription-storage.service.js';

class PythonServiceWebSocketClient {
  constructor() {
    this.wsUrl = CONFIG.PYTHON_SERVICE_WS_URL.replace(
      'http://',
      'ws://',
    ).replace('https://', 'wss://');
    this.connections = new Map(); // sessionId -> {ws, sessionId, streamEnded, flushPromise, flushResolve}
    this.lastChunkTimestamps = new Map(); // sessionId -> last chunk timestamp
  }

  /**
   * Create a WebSocket connection to Python service
   * @param {string} sessionId - Session ID
   * @param {Function} onTranscription - Callback for transcription results
   * @param {Function} onError - Callback for errors
   * @returns {Promise<WebSocket>}
   */
  async connect(sessionId, onTranscription, onError) {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(`${this.wsUrl}/ws/stream`);
        let connectionConfirmed = false;
        const connectionTimeout = setTimeout(() => {
          if (!connectionConfirmed) {
            reject(
              new Error(
                'Connection timeout: Python service did not confirm connection',
              ),
            );
            ws.close();
          }
        }, 10000); // 10 second timeout

        ws.on('open', async () => {
          console.log(`[Python WS] WebSocket opened for session: ${sessionId}`);

          // Send connection message
          ws.send(
            JSON.stringify({
              type: 'connect',
              sessionId: sessionId,
            }),
          );
        });

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());

            if (message.type === 'connected') {
              console.log(
                `[Python WS] Session confirmed: ${message.sessionId}`,
              );
              connectionConfirmed = true;
              clearTimeout(connectionTimeout);

              // Store connection and resolve promise
              this.connections.set(sessionId, {
                ws,
                sessionId,
                ready: true,
                streamEnded: false,
                flushPromise: null,
                flushResolve: null,
              });
              resolve(ws);
            } else if (message.type === 'transcription') {
              // Store transcription instead of logging to terminal
              transcriptionStorageService.addTranscription(
                message.sessionId,
                message.text,
                message.confidence || 1.0,
                message.final || false,
              );

              // Log for debugging (optional, can be removed later)
              const timestamp = new Date().toISOString();
              console.log(
                `[${timestamp}] [TRANSCRIPTION] Session: ${
                  message.sessionId
                } - Stored: "${message.text.substring(0, 50)}${
                  message.text.length > 50 ? '...' : ''
                }"`,
              );

              // Call callback
              if (onTranscription) {
                onTranscription(message);
              }
            } else if (message.type === 'error') {
              console.error(
                `[Python WS] Error for session ${sessionId}:`,
                message.message,
              );
              if (onError) {
                onError(new Error(message.message));
              }
            } else if (message.type === 'stream_ended') {
              console.log(`[Python WS] Stream ended for session: ${sessionId}`);
              // Mark that stream ended normally
              const connection = this.connections.get(sessionId);
              if (connection) {
                connection.streamEnded = true;
              }
            } else if (message.type === 'buffer_flushed') {
              console.log(
                `[Python WS] Buffer flushed confirmation for session: ${sessionId}`,
              );
              // Resolve flush promise if it exists
              const connection = this.connections.get(sessionId);
              if (connection && connection.flushResolve) {
                connection.flushResolve();
                connection.flushPromise = null;
                connection.flushResolve = null;
              }
            }
          } catch (error) {
            console.error('[Python WS] Error parsing message:', error);
          }
        });

        ws.on('error', (error) => {
          console.error(
            `[Python WS] WebSocket error for session ${sessionId}:`,
            error.message,
          );
          clearTimeout(connectionTimeout);
          this.connections.delete(sessionId);
          if (onError) {
            onError(error);
          }
          if (!connectionConfirmed) {
            reject(error);
          }
        });

        ws.on('close', (code, reason) => {
          console.log(
            `[Python WS] Connection closed for session: ${sessionId} (code: ${code}, reason: ${
              reason || 'none'
            })`,
          );
          clearTimeout(connectionTimeout);
          const connection = this.connections.get(sessionId);
          const streamEndedNormally = connection?.streamEnded || false;
          this.connections.delete(sessionId);

          // Only treat as error if it's not a normal closure (1000) and we didn't expect it to end
          if (code !== 1000 && !streamEndedNormally && code !== 1005) {
            // 1005 is "No Status Received" which can happen on normal closures
            if (onError) {
              onError(
                new Error(
                  `WebSocket closed unexpectedly: ${
                    reason || 'Unknown reason'
                  }`,
                ),
              );
            }
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send audio chunk to Python service
   * @param {string} sessionId - Session ID
   * @param {Buffer} audioChunk - Audio data
   */
  sendAudioChunk(sessionId, audioChunk) {
    const connection = this.connections.get(sessionId);
    if (
      !connection ||
      !connection.ready ||
      connection.ws.readyState !== WebSocket.OPEN
    ) {
      console.warn(
        `[Python WS] Cannot send audio chunk - connection not ready for session: ${sessionId}`,
      );
      return;
    }

    const base64Chunk = audioChunk.toString('base64');

    // Log occasionally to verify chunks are being sent to Python
    if (Math.random() < 0.1) {
      // Log ~10% of chunks
      console.log(
        `[Python WS] Sending audio chunk to Python for session ${sessionId}, size: ${audioChunk.length} bytes`,
      );
    }

    const chunkTimestamp = Date.now();

    // Track last chunk timestamp
    this.lastChunkTimestamps.set(sessionId, chunkTimestamp);

    connection.ws.send(
      JSON.stringify({
        type: 'audio_chunk',
        sessionId: sessionId,
        chunk: base64Chunk,
        timestamp: chunkTimestamp,
      }),
    );
  }

  /**
   * End the stream
   * @param {string} sessionId - Session ID
   */
  endStream(sessionId) {
    const connection = this.connections.get(sessionId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(
        JSON.stringify({
          type: 'end_stream',
          sessionId: sessionId,
        }),
      );
    }
  }

  /**
   * Flush buffer with timestamp cutoff
   * @param {string} sessionId - Session ID
   * @param {number} cutoffTimestamp - Timestamp in milliseconds (optional, defaults to current time)
   * @param {number} gracePeriodMs - Grace period in milliseconds (default: 500)
   * @returns {Promise<void>} Resolves when buffer is flushed
   */
  async flushBuffer(sessionId, cutoffTimestamp = null, gracePeriodMs = 500) {
    const connection = this.connections.get(sessionId);

    if (
      !connection ||
      !connection.ready ||
      connection.ws.readyState !== WebSocket.OPEN
    ) {
      console.warn(
        `[Python WS] Cannot flush buffer - connection not ready for session: ${sessionId}`,
      );
      return Promise.resolve();
    }

    // Use provided cutoff timestamp or calculate from last chunk timestamp
    if (!cutoffTimestamp) {
      const lastChunkTime = this.lastChunkTimestamps.get(sessionId);
      if (lastChunkTime) {
        // Use last chunk timestamp minus small buffer for network latency
        cutoffTimestamp = lastChunkTime - 50; // 50ms buffer
      } else {
        // Fallback to current time minus network latency estimate
        cutoffTimestamp = Date.now() - 100; // 100ms buffer
      }
    }

    console.log(
      `[Python WS] Flushing buffer for session ${sessionId} with cutoff timestamp: ${cutoffTimestamp}`,
    );

    // Create promise for flush completion
    const flushPromise = new Promise((resolve, reject) => {
      connection.flushPromise = flushPromise;
      connection.flushResolve = resolve;

      // Set timeout (3 seconds)
      setTimeout(() => {
        if (connection.flushResolve === resolve) {
          console.warn(
            `[Python WS] Flush timeout for session ${sessionId}, resolving anyway`,
          );
          connection.flushPromise = null;
          connection.flushResolve = null;
          resolve();
        }
      }, 3000);
    });

    // Send flush command
    connection.ws.send(
      JSON.stringify({
        type: 'flush_buffer',
        sessionId: sessionId,
        cutoffTimestamp: cutoffTimestamp,
        gracePeriodMs: gracePeriodMs,
      }),
    );

    return flushPromise;
  }

  /**
   * Close WebSocket connection
   * @param {string} sessionId - Session ID
   */
  disconnect(sessionId) {
    const connection = this.connections.get(sessionId);
    if (connection) {
      connection.ws.close();
      this.connections.delete(sessionId);
    }
  }

  /**
   * Close all connections
   */
  disconnectAll() {
    for (const [sessionId, connection] of this.connections.entries()) {
      connection.ws.close();
    }
    this.connections.clear();
  }
}

export default new PythonServiceWebSocketClient();
