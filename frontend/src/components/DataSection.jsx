import React from 'react';
import ScreenshotItem from './ScreenshotItem';
import './DataSection.css';

function DataSection({ data, loading }) {
  if (loading) {
    return (
      <section className="data-section">
        <h2>Processed Screenshots</h2>
        <div className="data-container">
          <p className="loading">Loading...</p>
        </div>
      </section>
    );
  }

  if (!data || !data.length) {
    return (
      <section className="data-section">
        <h2>Processed Screenshots</h2>
        <div className="data-container">
          <div className="empty-state">
            <p>No screenshots processed yet.</p>
            <p>Upload a photo or wait for new screenshots...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="data-section">
      <h2>Processed Screenshots</h2>
      <div className="data-container">
        {[...data].reverse().map((item, index) => (
          <ScreenshotItem key={index} item={item} />
        ))}
      </div>
    </section>
  );
}

export default DataSection;
