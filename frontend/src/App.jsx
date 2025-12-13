import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import UploadSection from './components/UploadSection';
import DataSection from './components/DataSection';
import ApiKeyConfig from './components/ApiKeyConfig';
import EmailConfig from './components/EmailConfig';
import apiService from './services/api';
import './App.css';

function App() {
  const [processedData, setProcessedData] = useState([]);
  const [loading, setLoading] = useState(true);
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
      // Silently handle config check errors
      setApiKeysConfigured(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:4000/api/data');
      if (response.ok) {
        const data = await response.json();
        setProcessedData(data || []);
      }
    } catch (err) {
      // Silently handle fetch errors - WebSocket will provide updates
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
      // Silently handle config check errors
      setEmailConfigured(false);
    }
  }, []);

  const handleEmailConfigSaved = useCallback(() => {
    setShowEmailConfig(false);
    checkEmailConfig();
  }, [checkEmailConfig]);

  // WebSocket connection for real-time data updates
  useEffect(() => {
    // Check API keys configuration on startup
    checkApiKeysConfig();
    checkEmailConfig();

    // Initial data fetch
    fetchData();

    // Setup WebSocket connection for real-time updates (direct to backend)
    const backendUrl = 'http://localhost:4000';

    socketRef.current = io(`${backendUrl}/data-updates`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    const socket = socketRef.current;

    // Listen for data updates
    socket.on('data_update', (payload) => {
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
      </header>

      <UploadSection onUploadSuccess={handleUploadSuccess} />

      <DataSection data={processedData} loading={loading} />
    </div>
  );
}

export default App;
