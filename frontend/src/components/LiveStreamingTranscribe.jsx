import React, { useState, useRef, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import apiService from '../services/api';
import './LiveStreamingTranscribe.css';

function LiveStreamingTranscribe() {
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [transcriptions, setTranscriptions] = useState([]);
  const [aiResponse, setAiResponse] = useState(null);
  const [processingAI, setProcessingAI] = useState(false);
  const [httpsWarning, setHttpsWarning] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const chunkIntervalRef = useRef(null);
  const recordingRef = useRef(false);
  const sessionIdRef = useRef(null);
  const keyPressHistoryRef = useRef([]);

  // Check if HTTPS is required but not available
  useEffect(() => {
    const isHTTPS = window.location.protocol === 'https:';
    const hasGetUserMedia =
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia;

    // Show warning if not HTTPS and getUserMedia might not work
    if (!isHTTPS && !hasGetUserMedia) {
      setHttpsWarning(true);
    } else {
      setHttpsWarning(false);
    }
  }, []);

  const handleTranscription = React.useCallback((data) => {
    // Store transcription locally
    if (data.sessionId) {
      sessionIdRef.current = data.sessionId;
      setCurrentSessionId(data.sessionId);

      setTranscriptions((prev) => {
        const newTranscriptions = [...prev];
        // Update existing or add new
        const existingIndex = newTranscriptions.findIndex(
          (t) => t.timestamp === data.timestamp,
        );
        if (existingIndex >= 0) {
          newTranscriptions[existingIndex] = {
            text: data.text,
            confidence: data.confidence,
            final: data.final || false,
            timestamp: data.timestamp || Date.now(),
          };
        } else {
          newTranscriptions.push({
            text: data.text,
            confidence: data.confidence,
            final: data.final || false,
            timestamp: data.timestamp || Date.now(),
          });
        }
        return newTranscriptions;
      });
    }

    setStatus('processing');
    setTimeout(() => setStatus(''), 1000);
  }, []);

  const handleError = React.useCallback((error) => {
    console.error('WebSocket error:', error);
    setStatus('error');
    // Don't show alert for reconnection attempts, only for critical errors
    if (!error.message.includes('reconnect')) {
      setTimeout(() => {
        alert(`Error: ${error.message}`);
      }, 100);
    }
  }, []);

  const {
    connected,
    streaming,
    startStream,
    sendAudioChunk,
    endStream,
    flushBuffer,
    getSessionId,
  } = useWebSocket(handleTranscription, handleError);
  const streamingRef = useRef(false);
  const endStreamRef = useRef(endStream);

  // Handle keyboard shortcut (p+p)
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Check for 'p' key
      if (event.key.toLowerCase() === 'p') {
        const now = Date.now();
        const history = keyPressHistoryRef.current;

        // Remove keys older than 1 second
        const recentHistory = history.filter((time) => now - time < 1000);

        // Check if we have two 'p' presses within 1 second
        if (recentHistory.length >= 1) {
          // Process transcription with AI
          handleProcessTranscription();
          keyPressHistoryRef.current = [];
        } else {
          // Add this key press to history
          keyPressHistoryRef.current = [...recentHistory, now];
        }
      } else {
        // Reset history if any other key is pressed
        keyPressHistoryRef.current = [];
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  const handleProcessTranscription = async () => {
    // Try multiple sources for sessionId
    let sessionId = sessionIdRef.current || currentSessionId;

    // Try to get from hook if still not available
    if (!sessionId && getSessionId) {
      sessionId = getSessionId();
    }

    if (!sessionId) {
      alert(
        'No active transcription session. Please start recording first and wait for at least one transcription.',
      );
      return;
    }

    if (processingAI) {
      return; // Already processing
    }

    try {
      setProcessingAI(true);
      setStatus('processing-ai');

      // Record cutoff timestamp when "pp" is pressed
      // Subtract small buffer to account for network latency
      const cutoffTimestamp = Date.now() - 100; // 100ms buffer for network latency

      console.log(
        `[Frontend] Flushing buffer before processing, cutoff timestamp: ${cutoffTimestamp}`,
      );

      // Flush buffer to ensure all audio up to this point is processed
      try {
        if (flushBuffer && streaming) {
          await flushBuffer(cutoffTimestamp, 500);
          console.log('[Frontend] Buffer flushed successfully');

          // Small delay to ensure all transcriptions are stored
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } catch (flushError) {
        console.warn(
          `[Frontend] Error flushing buffer (non-fatal): ${flushError.message}`,
        );
        // Continue anyway - might still have transcriptions
      }

      // Now process transcription with AI
      const result = await apiService.processTranscription(
        sessionId,
        cutoffTimestamp,
      );

      if (result.success) {
        setAiResponse({
          transcription: result.fullTranscription || result.data.extractedText,
          response: result.fullResponse || result.data.gptResponse,
          timestamp: new Date().toLocaleString(),
        });
        setStatus('ai-complete');

        // Clear transcriptions so next "pp" only processes new audio
        setTranscriptions([]);
        console.log('[Frontend] Cleared transcriptions after processing');

        // Refresh data in parent component (App.jsx)
        // This will be handled by the App component's periodic refresh
      } else {
        throw new Error(result.error || 'Failed to process transcription');
      }
    } catch (error) {
      console.error('Error processing transcription:', error);
      alert(`Failed to process transcription: ${error.message}`);
      setStatus('error');
    } finally {
      setProcessingAI(false);
    }
  };

  // Update refs when they change
  useEffect(() => {
    endStreamRef.current = endStream;
  }, [endStream]);

  // Update streaming ref when streaming state changes
  useEffect(() => {
    streamingRef.current = streaming;
    console.log('[Frontend] Streaming state changed:', streaming);
  }, [streaming]);

  const startRecording = async () => {
    try {
      console.log('[Frontend] Starting recording...');

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isHTTPS = window.location.protocol === 'https:';
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        let errorMessage = '';

        if (!isHTTPS && isMobile) {
          errorMessage =
            'Microphone access requires HTTPS on mobile devices.\n\n';
          errorMessage += `Please access this page using:\n`;
          errorMessage += `https://${window.location.hostname}:${
            window.location.port || 3000
          }\n\n`;
          errorMessage +=
            'You may see a security warning - click "Advanced" and "Proceed anyway" (it\'s safe - self-signed certificate).';
        } else if (!isHTTPS) {
          errorMessage =
            'Microphone access requires HTTPS. Please access this page using HTTPS (https://...) instead of HTTP.';
        } else {
          errorMessage =
            'Microphone access is not available in this browser. Please use a modern browser that supports audio recording.';
        }

        throw new Error(errorMessage);
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      console.log('[Frontend] Microphone access granted');
      streamRef.current = stream;

      // Start WebSocket stream first
      console.log('[Frontend] Starting WebSocket stream...');
      startStream();

      // Wait for stream to actually start
      let waitCount = 0;
      while (!streamingRef.current && waitCount < 20) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        waitCount++;
      }

      if (!streamingRef.current) {
        throw new Error('Stream did not start in time');
      }

      console.log(
        '[Frontend] WebSocket stream started, setting up audio processor...',
      );

      // Use Web Audio API to capture raw PCM audio
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)({
        sampleRate: 16000,
      });

      // Resume audio context if suspended (required after user interaction)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
        console.log('[Frontend] Audio context resumed');
      }

      console.log(
        `[Frontend] Audio context state: ${audioContext.sampleRate}Hz, state: ${audioContext.state}`,
      );

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      console.log(
        '[Frontend] Audio processor created, buffer size: 4096 samples',
      );

      let chunkCount = 0;
      let skippedCount = 0;
      processor.onaudioprocess = (event) => {
        // Log every 50 chunks to verify processor is working
        chunkCount++;
        if (chunkCount % 50 === 0) {
          console.log(
            `[Frontend] Audio processor fired #${chunkCount}, recording: ${recordingRef.current}, streaming: ${streamingRef.current}`,
          );
        }

        if (!recordingRef.current) {
          if (chunkCount % 50 === 0) {
            console.log('[Frontend] Skipping chunk - not recording');
          }
          return;
        }

        if (!streamingRef.current) {
          if (chunkCount % 50 === 0) {
            console.log('[Frontend] Skipping chunk - not streaming');
          }
          return;
        }

        const inputData = event.inputBuffer.getChannelData(0);

        // Check if there's actual audio data (not silence) - lowered threshold
        let hasAudio = false;
        let maxAmplitude = 0;
        for (let i = 0; i < inputData.length; i++) {
          const abs = Math.abs(inputData[i]);
          if (abs > maxAmplitude) {
            maxAmplitude = abs;
          }
          if (abs > 0.001) {
            // Lowered threshold from 0.01 to 0.001
            hasAudio = true;
          }
        }

        if (!hasAudio) {
          skippedCount++;
          if (skippedCount % 100 === 0) {
            console.log(
              `[Frontend] Skipped ${skippedCount} silent chunks (max amplitude: ${maxAmplitude.toFixed(
                4,
              )})`,
            );
          }
          return; // Skip silent chunks
        }

        // Convert Float32 to Int16 PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        const chunksSent = chunkCount - skippedCount;
        if (chunksSent % 10 === 0 || chunksSent <= 5) {
          console.log(
            `[Frontend] Sending audio chunk #${chunksSent} (total processed: ${chunkCount}), size: ${
              pcmData.buffer.byteLength
            } bytes, amplitude: ${maxAmplitude.toFixed(4)}`,
          );
        }

        // Send PCM chunk
        sendAudioChunk(pcmData.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // Store references for cleanup
      mediaRecorderRef.current = { processor, audioContext, source };
      audioChunksRef.current = [];

      recordingRef.current = true;
      setRecording(true);
      setStatus('recording');
      // Clear previous transcriptions and AI response when starting new recording
      setTranscriptions([]);
      setAiResponse(null);
      setCurrentSessionId(null);
      sessionIdRef.current = null;
      console.log('[Frontend] Recording started successfully');
    } catch (error) {
      console.error('[Frontend] Error starting recording:', error);
      setStatus('error');
      alert(
        `Failed to start recording: ${
          error.message || 'Please grant microphone permissions.'
        }`,
      );
    }
  };

  const stopRecording = () => {
    try {
      console.log('[Frontend] Stop recording called');

      // Disconnect audio processor
      if (mediaRecorderRef.current) {
        const { processor, audioContext, source } = mediaRecorderRef.current;
        if (processor) {
          processor.disconnect();
        }
        if (source) {
          source.disconnect();
        }
        if (audioContext && audioContext.state !== 'closed') {
          audioContext.close();
        }
        mediaRecorderRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
        streamRef.current = null;
      }

      if (chunkIntervalRef.current) {
        clearInterval(chunkIntervalRef.current);
        chunkIntervalRef.current = null;
      }

      // End WebSocket stream only if we're actually recording
      if (recordingRef.current || streamingRef.current) {
        console.log('[Frontend] Ending stream from stopRecording');
        endStream();
      }

      recordingRef.current = false;
      setRecording(false);
      setStatus('stopped');
      // Keep transcriptions visible after stopping
    } catch (error) {
      console.error('[Frontend] Error stopping recording:', error);
      setStatus('error');
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup on unmount only
      console.log('[Frontend] Component unmounting, cleaning up...');

      // Only end stream if we're actually streaming
      if (streamingRef.current || recordingRef.current) {
        console.log('[Frontend] Ending stream on unmount');
        endStreamRef.current();
      }

      if (mediaRecorderRef.current) {
        const { processor, audioContext, source } = mediaRecorderRef.current;
        if (processor) {
          processor.disconnect();
        }
        if (source) {
          source.disconnect();
        }
        if (audioContext && audioContext.state !== 'closed') {
          audioContext.close();
        }
        mediaRecorderRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (chunkIntervalRef.current) {
        clearInterval(chunkIntervalRef.current);
        chunkIntervalRef.current = null;
      }
      recordingRef.current = false;
    };
  }, []); // Empty dependency array - only run on mount/unmount

  return (
    <div className="live-streaming-transcribe">
      <div className="streaming-status">
        <div
          className={`status-indicator ${
            connected ? 'connected' : 'disconnected'
          }`}
        >
          <span className="status-dot"></span>
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        {streaming && (
          <div className="streaming-indicator">
            <span className="pulse-dot"></span>
            <span>Streaming Active</span>
          </div>
        )}
      </div>

      <div className="recording-controls">
        {!recording ? (
          <button
            className="record-button start"
            onClick={startRecording}
            disabled={!connected}
          >
            🎙️ Start Recording
          </button>
        ) : (
          <button className="record-button stop" onClick={stopRecording}>
            ⏹️ Stop Recording
          </button>
        )}
      </div>

      {status && (
        <div className={`status-message ${status}`}>
          {status === 'recording' && (
            <>
              <div className="recording-animation"></div>
              <span>
                Recording... Speak into your microphone. Transcriptions are
                being stored.
              </span>
            </>
          )}
          {status === 'processing' && <span>Processing audio...</span>}
          {status === 'processing-ai' && (
            <span>Processing transcription with AI...</span>
          )}
          {status === 'ai-complete' && <span>✅ AI response received!</span>}
          {status === 'stopped' && (
            <span>
              Recording stopped. Press P+P to process transcription with AI.
            </span>
          )}
          {status === 'error' && (
            <span>
              An error occurred. Please check the console for details or ensure
              you're using HTTPS on mobile devices.
            </span>
          )}
        </div>
      )}

      {!connected && (
        <div className="connection-warning">
          ⚠️ Not connected to server. Please wait for connection...
          <br />
          <small
            style={{ display: 'block', marginTop: '5px', fontSize: '12px' }}
          >
            If this persists, check:
            <br />• Backend server is running on port 4000
            <br />• Both devices are on the same WiFi network
            <br />• Browser console for detailed error messages
          </small>
        </div>
      )}

      {httpsWarning && (
        <div
          className="connection-warning"
          style={{
            backgroundColor: '#ff6b6b',
            color: 'white',
            padding: '15px',
            borderRadius: '8px',
            marginTop: '10px',
          }}
        >
          <strong>⚠️ HTTPS Required for Microphone Access</strong>
          <p style={{ margin: '10px 0 0 0', fontSize: '14px' }}>
            Mobile browsers require HTTPS to access your microphone.
            {window.location.port === '3000' ? (
              <>
                <br />
                Try accessing via HTTPS:
                <br />
                <code
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    display: 'inline-block',
                    marginTop: '5px',
                  }}
                >
                  https://{window.location.hostname}:3000
                </code>
                <br />
                <small
                  style={{ display: 'block', marginTop: '8px', opacity: 0.9 }}
                >
                  (If HTTPS is configured, you may see a security warning -
                  click "Advanced" and "Proceed anyway" - it's safe, it's a
                  self-signed certificate)
                </small>
              </>
            ) : (
              <br />
            )}
            <br />
            <small style={{ display: 'block', marginTop: '8px', opacity: 0.9 }}>
              <strong>Note:</strong> To enable HTTPS, ensure you have{' '}
              <code>cert.pem</code> and <code>key.pem</code> files in the
              project root directory.
            </small>
          </p>
        </div>
      )}

      {/* Display transcriptions */}
      {transcriptions.length > 0 && (
        <div className="transcription-display">
          <h3>Transcription:</h3>
          <div className="transcription-text">
            {transcriptions.map((t, idx) => (
              <span key={idx}>
                {t.text}
                {idx < transcriptions.length - 1 ? ' ' : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Display AI Response */}
      {aiResponse && (
        <div className="ai-response-display">
          <h3>AI Response:</h3>
          <div className="ai-response-text">
            <pre>{aiResponse.response}</pre>
          </div>
          <div className="ai-response-timestamp">
            Processed at: {aiResponse.timestamp}
          </div>
        </div>
      )}

      <div className="streaming-info">
        <p>
          <strong>How it works:</strong>
        </p>
        <ul>
          <li>Click "Start Recording" to begin live transcription</li>
          <li>Speak into your microphone</li>
          <li>Transcriptions are stored on the server as you speak</li>
          <li>
            Press <strong>P+P</strong> (press P twice quickly) to send all
            transcriptions to AI
          </li>
          <li>AI will extract questions and provide answers</li>
          <li>Click "Stop Recording" when finished</li>
        </ul>
      </div>
    </div>
  );
}

export default LiveStreamingTranscribe;
