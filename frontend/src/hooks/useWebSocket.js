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
    // Use window.location.origin so it works with Vite proxy and network access
    // Vite proxy will forward /socket.io requests to the backend
    const socketUrl = window.location.origin;

    socketRef.current = io(`${socketUrl}/stream-transcribe`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
      autoConnect: true,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('[WebSocket] Connected');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
      setConnected(false);
      streamingRef.current = false; // Update ref immediately
      setStreaming(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error);
      setConnected(false);
      if (onErrorRef.current) {
        onErrorRef.current(new Error('Failed to connect to server'));
      }
    });

    socket.on('stream_started', (data) => {
      console.log('[WebSocket] Stream started:', data.sessionId);
      sessionIdRef.current = data.sessionId;
      streamingRef.current = true; // Update ref immediately
      setStreaming(true);
    });

    socket.on('stream_ended', () => {
      console.log('[WebSocket] Stream ended');
      streamingRef.current = false; // Update ref immediately
      setStreaming(false);
      sessionIdRef.current = null;
    });

    socket.on('transcription', (data) => {
      console.log('[WebSocket] Transcription received:', data);
      if (onTranscriptionRef.current) {
        onTranscriptionRef.current(data);
      }
    });

    socket.on('error', (error) => {
      console.error('[WebSocket] Error:', error);
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
    if (!socketRef.current) {
      console.warn('[WebSocket] Cannot send chunk: socket not initialized');
      return;
    }

    // Use ref instead of state for immediate access
    if (!streamingRef.current) {
      console.warn('[WebSocket] Cannot send chunk: stream not started yet');
      return;
    }

    if (!socketRef.current.connected) {
      console.warn('[WebSocket] Cannot send chunk: socket not connected');
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
        console.warn(
          '[WebSocket] Unknown audio chunk type:',
          typeof audioChunk,
        );
        return;
      }

      socketRef.current.emit('audio_chunk', {
        chunk: base64,
        timestamp: Date.now(),
      });

      // Log occasionally to verify chunks are being sent
      if (Math.random() < 0.1) {
        // Log ~10% of chunks
        console.log(
          `[WebSocket] Sent audio chunk, size: ${
            base64.length
          } chars (${Math.round((base64.length * 3) / 4)} bytes)`,
        );
      }
    } catch (error) {
      console.error('[WebSocket] Error sending audio chunk:', error);
    }
  };

  const endStream = () => {
    // Use ref instead of state for immediate access
    if (socketRef.current && streamingRef.current) {
      console.log('[WebSocket] Ending stream');
      socketRef.current.emit('end_stream');
      streamingRef.current = false; // Update ref immediately
      setStreaming(false);
    } else {
      console.log(
        '[WebSocket] Cannot end stream - not streaming or socket not available',
      );
    }
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
    getSessionId,
  };
}
