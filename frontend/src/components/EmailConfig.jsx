import React, { useState, useEffect } from 'react';
import './EmailConfig.css';

function EmailConfig({ onConfigSaved }) {
  const [enabled, setEnabled] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load existing configuration
    fetch('/api/config/email')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.config) {
          setEnabled(data.config.enabled || false);
          setEmail(data.config.email || '');
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading email config:', err);
        setLoading(false);
      });
  }, []);

  const handleEnableToggle = () => {
    setEnabled((prev) => !prev);
    setError('');
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // If enabled, validate email
    if (enabled) {
      if (!email || !email.trim()) {
        setError('Email address is required when email is enabled');
        return;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setError('Invalid email address format');
        return;
      }
    }

    setSaving(true);
    try {
      const response = await fetch('/api/config/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: enabled,
          email: enabled ? email.trim() : '',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save email configuration');
      }

      if (onConfigSaved) {
        onConfigSaved();
      }
    } catch (err) {
      setError(err.message || 'Failed to save email configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="email-config-overlay">
        <div className="email-config-modal">
          <div className="loading">Loading configuration...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="email-config-overlay">
      <div className="email-config-modal">
        <h2>📧 Configure Email Notifications</h2>
        <p className="subtitle">
          Enable email notifications to receive processed screenshot results via email.
          You can disable this feature at any time.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="email-config-section">
            <div className="email-toggle-group">
              <div className="email-toggle-header">
                <label htmlFor="email-enabled">Enable Email Notifications</label>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    id="email-enabled"
                    checked={enabled}
                    onChange={handleEnableToggle}
                  />
                  <span className="toggle-slider"></span>
                  <span className="toggle-label">
                    {enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </div>
              <p className="section-hint">
                When enabled, processed screenshot results will be sent to the email address below.
              </p>
            </div>

            {enabled && (
              <div className="email-input-group">
                <label htmlFor="email-address">Email Address</label>
                <input
                  type="email"
                  id="email-address"
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="your.email@example.com"
                  className="email-input"
                  required={enabled}
                />
                <span className="email-hint">
                  Enter the email address where you want to receive notifications.
                </span>
              </div>
            )}

            {!enabled && (
              <div className="email-disabled-info">
                <p>
                  📭 Email notifications are currently disabled. Enable the toggle above to start receiving email notifications.
                </p>
              </div>
            )}
          </div>

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
              disabled={saving || (enabled && !email.trim())}
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

export default EmailConfig;

