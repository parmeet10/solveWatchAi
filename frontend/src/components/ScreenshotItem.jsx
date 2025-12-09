import React from 'react';
import './ScreenshotItem.css';

function ScreenshotItem({ item }) {
  return (
    <div className="screenshot-item">
      <div className="filename">{item.filename}</div>
      <div className="timestamp">
        {item.timestamp}
        {item.usedContext && (
          <span className="context-badge">CONTEXT USED</span>
        )}
      </div>
      <div className="label">Extracted Text:</div>
      <pre>{item.extractedText}</pre>
      <div className="label">AI Response:</div>
      <pre>{item.gptResponse}</pre>
    </div>
  );
}

export default ScreenshotItem;

