import React, { useState, useRef } from 'react';
import './FileUploadTranscribe.css';

function FileUploadTranscribe() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (selectedFile) => {
    // Validate file type
    const allowedTypes = [
      'audio/mpeg',
      'audio/wav',
      'audio/mp4',
      'audio/x-m4a',
      'audio/webm',
    ];
    const allowedExtensions = ['.mp3', '.wav', '.m4a', '.mp4', '.webm'];
    const fileExt = selectedFile.name
      .substring(selectedFile.name.lastIndexOf('.'))
      .toLowerCase();

    if (
      !allowedTypes.includes(selectedFile.type) &&
      !allowedExtensions.includes(fileExt)
    ) {
      setStatus('error');
      alert('Please select a valid audio file (MP3, WAV, M4A, etc.)');
      return;
    }

    // Validate file size (25MB)
    if (selectedFile.size > 25 * 1024 * 1024) {
      setStatus('error');
      alert('File size must be less than 25MB');
      return;
    }

    setFile(selectedFile);
    setStatus('');
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      alert('Please select a file first');
      return;
    }

    setUploading(true);
    setStatus('uploading');

    try {
      const formData = new FormData();
      formData.append('audio', file);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setStatus('success');
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setStatus('error');
        alert(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setStatus('error');
      const errorMessage =
        error.message || 'Failed to upload file. Please try again.';
      alert(errorMessage);
    } finally {
      setUploading(false);
      // Reset status after 5 seconds
      if (status === 'error') {
        setTimeout(() => setStatus(''), 5000);
      }
    }
  };

  const handleClear = () => {
    setFile(null);
    setStatus('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="file-upload-transcribe">
      <div
        className={`upload-zone ${dragActive ? 'drag-active' : ''} ${
          status === 'success' ? 'success' : ''
        } ${status === 'error' ? 'error' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.mp4,.webm"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />

        {!file ? (
          <div className="upload-prompt">
            <div className="upload-icon">📁</div>
            <p>Drag and drop an audio file here, or</p>
            <button
              className="browse-button"
              onClick={() => fileInputRef.current?.click()}
            >
              Browse Files
            </button>
            <p className="upload-hint">
              Supported formats: MP3, WAV, M4A (Max 25MB)
            </p>
          </div>
        ) : (
          <div className="file-info">
            <div className="file-icon">🎵</div>
            <div className="file-details">
              <p className="file-name">{file.name}</p>
              <p className="file-size">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
            <button className="remove-button" onClick={handleClear}>
              ✕
            </button>
          </div>
        )}
      </div>

      {file && (
        <div className="upload-actions">
          <button
            className="upload-button"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? '⏳ Uploading...' : '🚀 Upload & Transcribe'}
          </button>
        </div>
      )}

      {status === 'uploading' && (
        <div className="status-message uploading">
          <div className="spinner"></div>
          <span>Uploading and processing audio file...</span>
        </div>
      )}

      {status === 'success' && (
        <div className="status-message success">
          ✅ File uploaded successfully! Check the server terminal for
          transcription.
        </div>
      )}

      {status === 'error' && (
        <div className="status-message error">
          ❌ Upload failed. Please try again.
        </div>
      )}
    </div>
  );
}

export default FileUploadTranscribe;
