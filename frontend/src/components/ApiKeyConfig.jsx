import React, { useState, useEffect } from 'react';
import './ApiKeyConfig.css';

const AI_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-...' },
  { id: 'grok', name: 'Grok', placeholder: 'gsk_...' },
  { id: 'gemini', name: 'Google Gemini', placeholder: 'AIza...' },
];

function ApiKeyConfig({ onConfigSaved }) {
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    grok: '',
    gemini: '',
  });
  const [enabled, setEnabled] = useState([]);
  const [order, setOrder] = useState(['openai', 'grok', 'gemini']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load existing configuration
    fetch('/api/config/keys')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.config) {
          // Set keys (will be masked as *** if they exist)
          setApiKeys(data.config.keys || {});
          setOrder(data.config.order || ['openai', 'grok', 'gemini']);
          setEnabled(data.config.enabled || []);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading config:', err);
        setLoading(false);
      });
  }, []);

  const handleKeyChange = (providerId, value) => {
    setApiKeys((prev) => ({
      ...prev,
      [providerId]: value,
    }));
    setError('');
  };

  const handleEnableToggle = (providerId) => {
    setEnabled((prev) => {
      if (prev.includes(providerId)) {
        // Disable - remove from enabled list
        return prev.filter((id) => id !== providerId);
      } else {
        // Enable - add to enabled list
        // Check if key exists
        const hasKey =
          apiKeys[providerId] &&
          (apiKeys[providerId] === '***' ||
            apiKeys[providerId].trim().length > 0);
        if (!hasKey) {
          setError(
            `Please provide an API key for ${
              AI_PROVIDERS.find((p) => p.id === providerId)?.name || providerId
            } before enabling it.`,
          );
          return prev;
        }
        return [...prev, providerId];
      }
    });
    setError('');
  };

  const handleOrderChange = (index, direction) => {
    // Get enabled providers in current order
    const enabledOrder = order.filter((id) => enabled.includes(id));
    const disabledProviders = order.filter((id) => !enabled.includes(id));

    // Create a new array to modify
    const newEnabledOrder = [...enabledOrder];

    if (direction === 'up' && index > 0) {
      [newEnabledOrder[index], newEnabledOrder[index - 1]] = [
        newEnabledOrder[index - 1],
        newEnabledOrder[index],
      ];
    } else if (direction === 'down' && index < newEnabledOrder.length - 1) {
      [newEnabledOrder[index], newEnabledOrder[index + 1]] = [
        newEnabledOrder[index + 1],
        newEnabledOrder[index],
      ];
    }

    // Merge back with disabled providers, maintaining their relative order
    setOrder([...newEnabledOrder, ...disabledProviders]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate: at least one provider must be enabled
    if (enabled.length === 0) {
      setError('Please enable at least one AI provider');
      return;
    }

    // Validate: all enabled providers must have keys
    const missingKeys = enabled.filter((providerId) => {
      const key = apiKeys[providerId];
      return !key || (key !== '***' && key.trim().length === 0);
    });

    if (missingKeys.length > 0) {
      const providerNames = missingKeys
        .map((id) => AI_PROVIDERS.find((p) => p.id === id)?.name || id)
        .join(', ');
      setError(`Please provide API keys for: ${providerNames}`);
      return;
    }

    // Prepare config - only send keys that are being updated (not masked)
    const keysToSave = {};
    Object.keys(apiKeys).forEach((providerId) => {
      const key = apiKeys[providerId];
      // Only send if it's a new key (not masked)
      if (key && key !== '***' && key.trim().length > 0) {
        keysToSave[providerId] = key.trim();
      }
    });

    const configToSave = {
      keys: keysToSave,
      order: order,
      enabled: enabled,
    };

    setSaving(true);
    try {
      const response = await fetch('/api/config/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configToSave),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save configuration');
      }

      if (onConfigSaved) {
        onConfigSaved();
      }
    } catch (err) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="api-key-config-overlay">
        <div className="api-key-config-modal">
          <div className="loading">Loading configuration...</div>
        </div>
      </div>
    );
  }

  // Get enabled providers in order
  const enabledOrder = order.filter((id) => enabled.includes(id));

  return (
    <div className="api-key-config-overlay">
      <div className="api-key-config-modal">
        <h2>⚙️ Configure AI Providers</h2>
        <p className="subtitle">
          Manage your AI API keys and configure which providers to use. Keys are
          stored securely on the server.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="api-keys-section">
            <h3>API Keys</h3>
            <p className="section-hint">
              Enter API keys for the providers you want to use. Existing keys
              are shown as ***.
            </p>
            {AI_PROVIDERS.map((provider) => {
              const hasExistingKey = apiKeys[provider.id] === '***';
              const isEnabled = enabled.includes(provider.id);

              return (
                <div key={provider.id} className="api-key-input-group">
                  <div className="api-key-header">
                    <label htmlFor={provider.id}>{provider.name}</label>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => handleEnableToggle(provider.id)}
                      />
                      <span className="toggle-slider"></span>
                      <span className="toggle-label">
                        {isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  </div>
                  <input
                    type="password"
                    id={provider.id}
                    value={apiKeys[provider.id] || ''}
                    onChange={(e) =>
                      handleKeyChange(provider.id, e.target.value)
                    }
                    placeholder={
                      hasExistingKey
                        ? '*** (Key already saved)'
                        : provider.placeholder
                    }
                    className="api-key-input"
                  />
                  {hasExistingKey && (
                    <span className="key-hint">
                      Key already saved. Enter a new key to update it.
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {enabledOrder.length > 0 && (
            <div className="order-section">
              <h3>Priority Order (Fallback Chain)</h3>
              <p className="order-hint">
                Reorder enabled providers. If the first AI fails, it will try
                the next one in order.
              </p>
              <div className="order-list">
                {enabledOrder.map((providerId, index) => {
                  const provider = AI_PROVIDERS.find(
                    (p) => p.id === providerId,
                  );

                  return (
                    <div key={providerId} className="order-item">
                      <div className="order-number">{index + 1}</div>
                      <div className="order-content">
                        <span className="order-provider-name">
                          {provider?.name || providerId}
                        </span>
                      </div>
                      <div className="order-controls">
                        <button
                          type="button"
                          onClick={() => handleOrderChange(index, 'up')}
                          disabled={index === 0}
                          className="order-btn"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOrderChange(index, 'down')}
                          disabled={index === enabledOrder.length - 1}
                          className="order-btn"
                          title="Move down"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {enabledOrder.length === 0 && (
            <div className="no-enabled-warning">
              <p>
                ⚠️ No providers are currently enabled. Please enable at least
                one provider above.
              </p>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button
              type="button"
              onClick={() => onConfigSaved && onConfigSaved()}
              className="cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || enabledOrder.length === 0}
              className="save-btn"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ApiKeyConfig;
