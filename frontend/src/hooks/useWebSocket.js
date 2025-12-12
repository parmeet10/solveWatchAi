import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

/**
 * Custom hook for managing WebSocket connection for streaming transcription
 */
export function useWebSocket(onTranscription, onError) {
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const socketRef = useRef(null);
  const sessionIdRef = useRef(null);
  const streamingRef = useRef(false); // Use ref for immediate access
  // Store callbacks in refs to avoid re-creating connections
  const onTranscriptionRef = useRef(onTranscription);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change (without re-creating connection)
  useEffect(() => {
    onTranscriptionRef.current = onTranscription;
    onErrorRef.current = onError;
  }, [onTranscription, onError]);

  useEffect(() => {
    // Only create connection once
    if (socketRef.current) {
      return;
    }

    // Initialize Socket.io connection
    // Always use Vite proxy - it should handle WebSocket upgrades from HTTPS to HTTP
    const socketUrl = window.location.origin;
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;

    // Socket.io connection with explicit path configuration
    // The path should be '/socket.io' for the proxy to work correctly
    socketRef.current = io(`${socketUrl}/stream-transcribe`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
      autoConnect: true,
      forceNew: false,
      // Additional options for better connection handling
      upgrade: true,
      rememberUpgrade: false,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
      streamingRef.current = false; // Update ref immediately
      setStreaming(false);
    });

    socket.on('connect_error', (error) => {
      setConnected(false);

      // Provide more helpful error message
      let errorMessage = `Failed to connect to server: ${error.message}`;
      if (
        error.message?.includes('websocket') ||
        error.type === 'TransportError'
      ) {
        errorMessage += '\n\nPossible causes:\n';
        errorMessage += '1. Backend server might not be running on port 4000\n';
        errorMessage += '2. Vite proxy might not be configured correctly\n';
        errorMessage += '3. Firewall might be blocking the connection\n';
        errorMessage += '4. Mixed content (HTTPS to HTTP) might be blocked\n';
        errorMessage += '5. Check browser console for more details\n';
        errorMessage += `\nTrying to connect to: ${socketUrl}/stream-transcribe`;
        errorMessage += `\nBackend should be at: http://localhost:4000`;
      }

      if (onErrorRef.current) {
        onErrorRef.current(new Error(errorMessage));
      }
    });

    socket.on('stream_started', (data) => {
      sessionIdRef.current = data.sessionId;
      streamingRef.current = true; // Update ref immediately
      setStreaming(true);
    });

    socket.on('stream_ended', () => {
      streamingRef.current = false; // Update ref immediately
      setStreaming(false);
      sessionIdRef.current = null;
    });

    socket.on('transcription', (data) => {
      if (onTranscriptionRef.current) {
        onTranscriptionRef.current(data);
      }
    });

    socket.on('error', (error) => {
      if (onErrorRef.current) {
        onErrorRef.current(new Error(error.message || 'WebSocket error'));
      }
    });

    return () => {
      if (socket) {
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, []); // Empty dependency array - only run once

  const startStream = () => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('start_stream');
    } else {
      if (onError) {
        onError(new Error('Not connected to server'));
      }
    }
  };

  const sendAudioChunk = (audioChunk) => {
    if (
      !socketRef.current ||
      !streamingRef.current ||
      !socketRef.current.connected
    ) {
      return;
    }

    try {
      // audioChunk can be either ArrayBuffer (PCM) or Blob (WebM)
      let base64;
      if (audioChunk instanceof ArrayBuffer) {
        // Convert ArrayBuffer to base64
        const bytes = new Uint8Array(audioChunk);
        const binary = String.fromCharCode(...bytes);
        base64 = btoa(binary);
      } else if (audioChunk instanceof Blob) {
        // Convert Blob to base64 (legacy support)
        const reader = new FileReader();
        reader.onload = () => {
          const base64Data = reader.result.split(',')[1];
          socketRef.current.emit('audio_chunk', {
            chunk: base64Data,
            timestamp: Date.now(),
          });
        };
        reader.readAsDataURL(audioChunk);
        return; // Early return for async blob reading
      } else {
        return;
      }

      socketRef.current.emit('audio_chunk', {
        chunk: base64,
        timestamp: Date.now(),
      });
    } catch (error) {
      // Silently handle chunk send errors
    }
  };

  const endStream = () => {
    // Use ref instead of state for immediate access
    if (socketRef.current && streamingRef.current) {
      socketRef.current.emit('end_stream');
      streamingRef.current = false; // Update ref immediately
      setStreaming(false);
    }
  };

  const flushBuffer = (cutoffTimestamp = null, gracePeriodMs = 500) => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current || !socketRef.current.connected) {
        reject(new Error('Not connected to server'));
        return;
      }

      if (!streamingRef.current) {
        reject(new Error('Stream not started'));
        return;
      }

      // Set up one-time listener for flush confirmation
      const onFlushComplete = (data) => {
        socketRef.current.off('buffer_flushed', onFlushComplete);
        socketRef.current.off('error', onError);
        resolve(data);
      };

      const onError = (error) => {
        socketRef.current.off('buffer_flushed', onFlushComplete);
        socketRef.current.off('error', onError);
        reject(new Error(error.message || 'Failed to flush buffer'));
      };

      socketRef.current.once('buffer_flushed', onFlushComplete);
      socketRef.current.once('error', onError);

      // Send flush request
      socketRef.current.emit('flush_buffer', {
        cutoffTimestamp: cutoffTimestamp,
        gracePeriodMs: gracePeriodMs,
      });

      // Timeout after 3 seconds
      setTimeout(() => {
        socketRef.current.off('buffer_flushed', onFlushComplete);
        socketRef.current.off('error', onError);
        resolve({ timeout: true });
      }, 3000);
    });
  };

  const getSessionId = () => {
    return sessionIdRef.current;
  };

  return {
    connected,
    streaming,
    startStream,
    sendAudioChunk,
    endStream,
    flushBuffer,
    getSessionId,
  };
}
