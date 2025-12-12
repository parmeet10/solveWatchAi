/**
 * Service for storing and managing transcription sessions
 */
class TranscriptionStorageService {
  constructor() {
    // Map of sessionId -> { transcriptions: [], createdAt: Date }
    this.sessions = new Map();
  }

  /**
   * Add a transcription chunk to a session
   * @param {string} sessionId - Session ID
   * @param {string} text - Transcription text
   * @param {number} confidence - Confidence score
   * @param {boolean} final - Whether this is the final chunk
   */
  addTranscription(sessionId, text, confidence = 1.0, final = false) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        transcriptions: [],
        createdAt: new Date(),
      });
    }

    const session = this.sessions.get(sessionId);
    session.transcriptions.push({
      text: text.trim(),
      confidence,
      final,
      timestamp: new Date(),
    });
  }

  /**
   * Get all transcriptions for a session as a combined string
   * @param {string} sessionId - Session ID
   * @returns {string} Combined transcription text
   */
  getFullTranscription(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.transcriptions.length === 0) {
      return '';
    }

    return session.transcriptions
      .map((t) => t.text)
      .filter((t) => t.length > 0)
      .join(' ');
  }

  /**
   * Get session data
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Session data or null if not found
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get all transcription chunks for a session
   * @param {string} sessionId - Session ID
   * @returns {Array} Array of transcription objects
   */
  getTranscriptions(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? session.transcriptions : [];
  }

  /**
   * Clear transcriptions for a session (keeps session alive for continued recording)
   * @param {string} sessionId - Session ID
   */
  clearSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Clear transcriptions but keep the session alive
      session.transcriptions = [];
      // Optionally update createdAt to track when it was last cleared
      // session.lastClearedAt = new Date();
    }
  }

  /**
   * Clear all sessions
   */
  clearAll() {
    this.sessions.clear();
  }

  /**
   * Get all active session IDs
   * @returns {Array<string>} Array of session IDs
   */
  getActiveSessions() {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get transcriptions for a session since a specific timestamp (optimized)
   * If no transcriptions found in the time window, falls back to most recent transcription
   * This handles cases where there's silence after a question
   * @param {string} sessionId - Session ID
   * @param {number} sinceTimestamp - Unix timestamp in milliseconds
   * @param {number} maxLookbackSeconds - Maximum seconds to look back if no transcriptions found (default: 30)
   * @returns {string} Combined transcription text since the timestamp
   */
  getTranscriptionSince(sessionId, sinceTimestamp, maxLookbackSeconds = 30) {
    const session = this.sessions.get(sessionId);
    if (!session || session.transcriptions.length === 0) {
      return '';
    }

    const transcriptions = session.transcriptions;
    const sinceTime = sinceTimestamp;
    const maxLookbackTime = sinceTimestamp - maxLookbackSeconds * 1000;

    // Find the first transcription that's >= sinceTimestamp
    let startIndex = transcriptions.length;
    for (let i = transcriptions.length - 1; i >= 0; i--) {
      const transTime = transcriptions[i].timestamp.getTime();
      if (transTime < sinceTime) {
        startIndex = i + 1;
        break;
      }
    }

    // If we found transcriptions in the time window, use them
    if (startIndex < transcriptions.length) {
      const parts = [];
      for (let i = startIndex; i < transcriptions.length; i++) {
        const text = transcriptions[i].text.trim();
        if (text.length > 0) {
          parts.push(text);
        }
      }
      return parts.join(' ');
    }

    // No transcriptions in the time window - fallback to most recent transcription
    // Find the most recent transcription (going backwards from the end)
    for (let i = transcriptions.length - 1; i >= 0; i--) {
      const transTime = transcriptions[i].timestamp.getTime();
      const text = transcriptions[i].text.trim();

      // If we find a transcription within maxLookback window and it has content
      if (transTime >= maxLookbackTime && text.length > 0) {
        // Include everything from this transcription onwards
        const parts = [];
        for (let j = i; j < transcriptions.length; j++) {
          const t = transcriptions[j].text.trim();
          if (t.length > 0) {
            parts.push(t);
          }
        }
        return parts.join(' ');
      }
    }

    return '';
  }

  /**
   * Get transcriptions for a session within the last N seconds
   * Falls back to most recent transcription if none found in the window
   * @param {string} sessionId - Session ID
   * @param {number} secondsAgo - Number of seconds to look back
   * @param {number} maxLookbackSeconds - Maximum seconds to look back if no transcriptions found (default: 30)
   * @returns {string} Combined transcription text from the last N seconds
   */
  getTranscriptionLastSeconds(
    sessionId,
    secondsAgo = 10,
    maxLookbackSeconds = 30,
  ) {
    const sinceTimestamp = Date.now() - secondsAgo * 1000;
    return this.getTranscriptionSince(
      sessionId,
      sinceTimestamp,
      maxLookbackSeconds,
    );
  }
}

export default new TranscriptionStorageService();
