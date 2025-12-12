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

    console.log(
      '[useWebSocket] Initializing connection to:',
      `${socketUrl}/stream-transcribe`,
    );
    console.log('[useWebSocket] Current URL:', window.location.href);
    console.log('[useWebSocket] Protocol:', protocol, 'Hostname:', hostname);

    // Test if backend is reachable first
    fetch('/api/config/keys')
      .then((res) => {
        console.log(
          '[useWebSocket] Backend API test:',
          res.ok ? 'OK' : 'Failed',
        );
      })
      .catch((err) => {
        console.error('[useWebSocket] Backend API test failed:', err);
      });

    // Socket.io connection with explicit path configuration
    // The path should be '/socket.io' for the proxy to work correctly
    socketRef.current = io(`${socketUrl}/stream-transcribe`, {
      path: '/socket.io',
      transports: ['websocket'], // WebSocket only, no polling
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 30000, // 30 seconds timeout
      autoConnect: true,
      forceNew: false,
      // Additional options for better connection handling
      upgrade: true,
      rememberUpgrade: false,
    });

    const socket = socketRef.current;

    // Debug connection state
    console.log(
      '[useWebSocket] Socket created, initial state:',
      socket.connected,
    );
    console.log('[useWebSocket] Socket URL:', socket.io.uri);
    console.log(
      '[useWebSocket] Socket transport:',
      socket.io.engine?.transport?.name,
    );

    // Check if already connected
    if (socket.connected) {
      console.log('[useWebSocket] Socket already connected!', socket.id);
      setConnected(true);
    }

    socket.on('connect', () => {
      console.log('[useWebSocket] Socket connected!', socket.id);
      setConnected(true);
    });

    // Also check connection state periodically in case event doesn't fire
    const checkConnection = setInterval(() => {
      if (socket.connected && !connected) {
        console.log(
          '[useWebSocket] Socket is connected but state was false, updating...',
        );
        setConnected(true);
      }
    }, 1000);

    socket.on('disconnect', (reason) => {
      console.log('[useWebSocket] Socket disconnected:', reason);
      setConnected(false);
      streamingRef.current = false; // Update ref immediately
      setStreaming(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[useWebSocket] Connection error:', error);
      console.error('[useWebSocket] Error details:', {
        message: error.message,
        type: error.type,
        description: error.description,
        data: error.data,
      });
      console.error('[useWebSocket] Socket state:', {
        connected: socket.connected,
        disconnected: socket.disconnected,
        id: socket.id,
      });
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
      clearInterval(checkConnection);
      if (socket) {
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, []); // Empty dependency array - only run once

  const startStream = () => {
    if (!socketRef.current) {
      console.error('[useWebSocket] startStream: Socket not initialized');
      if (onErrorRef.current) {
        onErrorRef.current(new Error('Socket not initialized'));
      }
      return;
    }

    const socket = socketRef.current;
    console.log('[useWebSocket] startStream: Socket state:', {
      connected: socket.connected,
      disconnected: socket.disconnected,
      id: socket.id,
    });

    if (socket.connected) {
      console.log('[useWebSocket] Emitting start_stream');
      socket.emit('start_stream');
    } else {
      console.error(
        '[useWebSocket] Cannot start stream - socket not connected',
      );
      if (onErrorRef.current) {
        onErrorRef.current(
          new Error('Not connected to server. Please wait for connection.'),
        );
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
