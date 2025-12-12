import React, { useState } from 'react';
import FileUploadTranscribe from './FileUploadTranscribe';
import LiveStreamingTranscribe from './LiveStreamingTranscribe';
import './Transcriber.css';

function Transcriber() {
  const [activeTab, setActiveTab] = useState('upload');

  return (
    <div className="transcriber-container">
      <div className="transcriber-header">
        <h2>🎤 Speech-to-Text Transcription</h2>
        <p>Upload audio files or stream live audio for transcription</p>
      </div>

      <div className="transcriber-tabs">
        <button
          className={`tab-button ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          📁 Upload File
        </button>
        <button
          className={`tab-button ${activeTab === 'streaming' ? 'active' : ''}`}
          onClick={() => setActiveTab('streaming')}
        >
          🎙️ Live Transcription
        </button>
      </div>

      <div className="transcriber-content">
        {activeTab === 'upload' && <FileUploadTranscribe />}
        {activeTab === 'streaming' && <LiveStreamingTranscribe />}
      </div>
    </div>
  );
}

export default Transcriber;
