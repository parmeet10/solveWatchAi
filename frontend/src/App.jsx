import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import UploadSection from './components/UploadSection';
import DataSection from './components/DataSection';
import ApiKeyConfig from './components/ApiKeyConfig';
import EmailConfig from './components/EmailConfig';
import Transcriber from './components/Transcriber';
import apiService from './services/api';
import './App.css';

function App() {
  const [processedData, setProcessedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingClipboard, setProcessingClipboard] = useState(false);
  const [lastClipboardContent, setLastClipboardContent] = useState('');
  const [autoClipboardEnabled, setAutoClipboardEnabled] = useState(true);
  const [showApiKeyConfig, setShowApiKeyConfig] = useState(false);
  const [apiKeysConfigured, setApiKeysConfigured] = useState(false);
  const [showEmailConfig, setShowEmailConfig] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const socketRef = useRef(null);

  const checkApiKeysConfig = useCallback(async () => {
    try {
      const response = await apiService.getApiKeysConfig();
      if (response.success && response.config) {
        const { keys, enabled } = response.config;
        // Check if at least one key is configured and enabled
        const hasKeys =
          enabled &&
          enabled.length > 0 &&
          enabled.some((providerId) => {
            return keys[providerId] && keys[providerId] === '***';
          });
        setApiKeysConfigured(hasKeys);
        // Don't show modal automatically - user can click button to configure
      } else {
        // No config found - only show modal if no keys at all
        setApiKeysConfigured(false);
        // Check if we should show modal on first run
        const hasShownBefore = localStorage.getItem('apiKeysConfigShown');
        if (!hasShownBefore) {
          setShowApiKeyConfig(true);
          localStorage.setItem('apiKeysConfigShown', 'true');
        }
      }
    } catch (err) {
      console.error('Error checking API keys config:', err);
      setApiKeysConfigured(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/data');
      if (response.ok) {
        const data = await response.json();
        setProcessedData(data || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleApiConfigSaved = useCallback(() => {
    setShowApiKeyConfig(false);
    setApiKeysConfigured(true);
    // Reload AI service config on backend by making a test call
    // The AI service will reload config on next call
  }, []);

  const checkEmailConfig = useCallback(async () => {
    try {
      const response = await apiService.getEmailConfig();
      if (response.success && response.config) {
        setEmailConfigured(response.config.enabled && response.config.email);
      } else {
        setEmailConfigured(false);
      }
    } catch (err) {
      console.error('Error checking email config:', err);
      setEmailConfigured(false);
    }
  }, []);

  const handleEmailConfigSaved = useCallback(() => {
    setShowEmailConfig(false);
    checkEmailConfig();
  }, [checkEmailConfig]);

  const processClipboardContent = useCallback(
    async (clipboardText) => {
      try {
        setProcessingClipboard(true);

        if (!clipboardText || clipboardText.trim() === '') {
          setProcessingClipboard(false);
          return;
        }

        console.log(
          '📋 Processing clipboard content:',
          clipboardText.substring(0, 50) + '...',
        );

        // Send to backend
        await apiService.processClipboard(clipboardText);

        // Data will be updated via WebSocket, no need to poll
        setProcessingClipboard(false);
      } catch (err) {
        console.error('Error processing clipboard:', err);
        setProcessingClipboard(false);
      }
    },
    [fetchData],
  );

  const processClipboard = useCallback(async () => {
    try {
      // Read from clipboard
      const clipboardText = await navigator.clipboard.readText();
      await processClipboardContent(clipboardText);
    } catch (err) {
      console.error('Error reading clipboard:', err);
      alert(
        'Failed to access clipboard. Please grant clipboard permissions or use the manual option.',
      );
    }
  }, [processClipboardContent]);

  // WebSocket connection for real-time data updates
  useEffect(() => {
    // Check API keys configuration on startup
    checkApiKeysConfig();
    checkEmailConfig();

    // Initial data fetch
    fetchData();

    // Setup WebSocket connection for real-time updates
    const socketUrl = window.location.origin;
    console.log('[DataWebSocket] Connecting to:', `${socketUrl}/data-updates`);

    socketRef.current = io(`${socketUrl}/data-updates`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('[DataWebSocket] Connected');
    });

    socket.on('disconnect', () => {
      console.log('[DataWebSocket] Disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('[DataWebSocket] Connection error:', error);
    });

    // Listen for data updates
    socket.on('data_update', (payload) => {
      console.log('[DataWebSocket] Data update received:', payload.type);
      if (payload.type === 'initial' || payload.type === 'update') {
        setProcessedData(payload.data || []);
        setLoading(false);
      }
    });

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [checkApiKeysConfig, checkEmailConfig]);

  // Monitor clipboard changes - check when window gains focus (user copied in another app)
  useEffect(() => {
    if (!autoClipboardEnabled) return;

    let isProcessing = false;

    const checkClipboardOnFocus = async () => {
      if (isProcessing) return;

      try {
        const clipboardText = await navigator.clipboard.readText();

        // Only process if clipboard content changed and is not empty
        if (
          clipboardText &&
          clipboardText.trim() !== '' &&
          clipboardText !== lastClipboardContent
        ) {
          setLastClipboardContent(clipboardText);
          isProcessing = true;
          await processClipboardContent(clipboardText);
          isProcessing = false;
        }
      } catch (err) {
        // Clipboard access might be denied, ignore silently
        console.log('Clipboard access requires user interaction');
      }
    };

    // Check clipboard when window gains focus (user might have copied in another app)
    window.addEventListener('focus', checkClipboardOnFocus);

    return () => {
      window.removeEventListener('focus', checkClipboardOnFocus);
    };
  }, [autoClipboardEnabled, lastClipboardContent, processClipboardContent]);

  // Check clipboard when user clicks anywhere (user interaction allows clipboard access)
  useEffect(() => {
    if (!autoClipboardEnabled) return;

    let isProcessing = false;
    let clickTimeout;

    const handleClick = async () => {
      // Debounce - only check after a short delay
      clearTimeout(clickTimeout);
      clickTimeout = setTimeout(async () => {
        if (isProcessing) return;

        try {
          const clipboardText = await navigator.clipboard.readText();

          // Only process if clipboard content changed and is not empty
          if (
            clipboardText &&
            clipboardText.trim() !== '' &&
            clipboardText !== lastClipboardContent
          ) {
            setLastClipboardContent(clipboardText);
            isProcessing = true;
            await processClipboardContent(clipboardText);
            isProcessing = false;
          }
        } catch (err) {
          // Clipboard access might be denied, ignore silently
        }
      }, 300); // Small delay to ensure clipboard is updated after copy
    };

    // Listen for clicks anywhere on the page
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
      clearTimeout(clickTimeout);
    };
  }, [autoClipboardEnabled, lastClipboardContent, processClipboardContent]);

  // Listen for paste events (Command+V) - when user pastes, we know they just copied
  useEffect(() => {
    if (!autoClipboardEnabled) return;

    const handlePaste = async (event) => {
      // Don't prevent default - let paste happen normally
      // But also process the clipboard content
      try {
        // Small delay to ensure clipboard is updated
        setTimeout(async () => {
          try {
            const clipboardText = await navigator.clipboard.readText();
            if (
              clipboardText &&
              clipboardText.trim() !== '' &&
              clipboardText !== lastClipboardContent
            ) {
              setLastClipboardContent(clipboardText);
              await processClipboardContent(clipboardText);
            }
          } catch (err) {
            // Ignore clipboard errors
          }
        }, 100);
      } catch (err) {
        // Ignore errors
      }
    };

    // Listen for paste events on the document
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [autoClipboardEnabled, lastClipboardContent, processClipboardContent]);

  // Listen for keyboard shortcut to manually process clipboard
  // Command+Shift+V (Mac) or Ctrl+Shift+V (Windows) - processes clipboard without pasting
  useEffect(() => {
    const handleKeyDown = async (event) => {
      // Check for Command+Shift+V (Mac) or Ctrl+Shift+V (Windows/Linux)
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;

      if (modifierKey && event.shiftKey && event.key === 'v') {
        event.preventDefault();
        await processClipboard();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [processClipboard]);

  const handleUploadSuccess = () => {
    // Data will be updated via WebSocket automatically
    // No need to manually fetch
  };

  return (
    <div className="container">
      {showApiKeyConfig && (
        <ApiKeyConfig onConfigSaved={handleApiConfigSaved} />
      )}
      {showEmailConfig && (
        <EmailConfig onConfigSaved={handleEmailConfigSaved} />
      )}
      <header>
        <h1>📸 CodeSnapGPT</h1>
        <p className="subtitle">AI-Powered Screenshot Analysis</p>
        <div
          style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginTop: '10px',
          }}
        >
          <button
            onClick={() => setShowApiKeyConfig(true)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              backgroundColor: apiKeysConfigured ? '#666' : '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
            }}
          >
            {apiKeysConfigured
              ? '⚙️ Configure API Keys'
              : '🔑 Configure API Keys (Required)'}
          </button>
          <button
            onClick={() => setShowEmailConfig(true)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              backgroundColor: emailConfigured ? '#4CAF50' : '#666',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
            }}
          >
            {emailConfigured ? '📧 Email: Enabled' : '📧 Configure Email'}
          </button>
        </div>
        {processingClipboard && (
          <p style={{ color: '#4CAF50', fontSize: '14px', marginTop: '5px' }}>
            🔄 Processing clipboard content...
          </p>
        )}
        <div
          style={{
            fontSize: '12px',
            color: '#666',
            marginTop: '5px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: '#333' }}>
            💡 Auto-process:{' '}
            <button
              onClick={() => setAutoClipboardEnabled(!autoClipboardEnabled)}
              style={{
                padding: '2px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                backgroundColor: autoClipboardEnabled ? '#4CAF50' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
              }}
            >
              {autoClipboardEnabled ? 'ON' : 'OFF'}
            </button>
          </span>
          <span>|</span>
          <span style={{ fontSize: '11px', color: '#333', fontWeight: '500' }}>
            📋 Copy text (Cmd+C), then click anywhere on this page or paste
            (Cmd+V)
          </span>
          <span>|</span>
          <button
            onClick={processClipboard}
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              cursor: 'pointer',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
            }}
          >
            Process Now
          </button>
        </div>
      </header>

      <UploadSection onUploadSuccess={handleUploadSuccess} />

      <Transcriber />

      <DataSection data={processedData} loading={loading} />
    </div>
  );
}

export default App;
