import React, { useState, useEffect } from 'react';
import apiService from '../services/api';
import './UploadSection.css';

function UploadSection({ onUploadSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [useContext, setUseContext] = useState(false);
  const [status, setStatus] = useState({ message: '', type: '' });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadContextState();
  }, []);

  const loadContextState = async () => {
    try {
      const result = await apiService.getContextState();
      if (result.useContextEnabled !== undefined) {
        setUseContext(result.useContextEnabled);
      }
    } catch (err) {
      console.error('Error loading context state:', err);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    setStatus({ message: '', type: '' });
  };

  const handleContextToggle = async (e) => {
    const enabled = e.target.checked;
    setUseContext(enabled);

    try {
      await apiService.updateContextState(enabled);
      const statusText = enabled ? 'enabled' : 'disabled';
      console.log(`Context mode ${statusText}`);
    } catch (err) {
      console.error('Error updating context state:', err);
      setStatus({
        message: `❌ Error updating context setting: ${err.message}`,
        type: 'error',
      });
      setUseContext(!enabled); // Revert on error
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedFile) {
      setStatus({ message: 'Please select a file first.', type: 'error' });
      return;
    }

    const formData = new FormData();
    formData.append('image', selectedFile);

    setUploading(true);
    const contextStatus = useContext ? ' with context' : '';
    setStatus({
      message: `Processing image${contextStatus}... Please wait.`,
      type: 'processing',
    });

    try {
      const result = await apiService.uploadImage(formData);

      if (result.success) {
        const contextMsg = result.usedContext
          ? ' (with context from previous response)'
          : '';
        setStatus({
          message: `✅ Image processed successfully${contextMsg}! Text extracted, sent to AI, and emailed. Refreshing...`,
          type: 'success',
        });

        // Reset form
        setSelectedFile(null);
        e.target.reset();

        // Refresh data after delay
        setTimeout(() => {
          setStatus({ message: '', type: '' });
          onUploadSuccess();
        }, 2000);
      } else {
        setStatus({
          message: `❌ Error: ${result.error || 'Failed to process image'}`,
          type: 'error',
        });
      }
    } catch (err) {
      setStatus({
        message: `❌ Error: ${err.message}`,
        type: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="upload-section">
      <h2>Upload Photo</h2>
      <form onSubmit={handleSubmit} className="upload-form">
        <div className="file-input-wrapper">
          <input
            type="file"
            id="file-input"
            name="image"
            accept="image/*"
            onChange={handleFileChange}
            required
          />
          <label htmlFor="file-input" className="file-input-label">
            📁 Choose File
          </label>
        </div>
        <span className="selected-file-name">
          {selectedFile ? `Selected: ${selectedFile.name}` : ''}
        </span>
        <button
          type="submit"
          className="upload-btn"
          disabled={uploading || !selectedFile}
        >
          🚀 Upload & Process
        </button>
      </form>

      <div className={`context-toggle ${useContext ? 'enabled' : ''}`}>
        <input
          type="checkbox"
          id="use-context"
          name="useContext"
          checked={useContext}
          onChange={handleContextToggle}
        />
        <label htmlFor="use-context">
          🔄 Use Context (Include previous AI response)
        </label>
        <div className="context-info">
          When enabled, the AI will use your last response as context for better
          continuity. Applies to both manual uploads and auto-detected
          screenshots.
        </div>
      </div>

      {status.message && (
        <div className={`status-message ${status.type}`}>{status.message}</div>
      )}
    </section>
  );
}

export default UploadSection;

