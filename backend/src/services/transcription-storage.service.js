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
   * Clear transcriptions for a session
   * @param {string} sessionId - Session ID
   */
  clearSession(sessionId) {
    this.sessions.delete(sessionId);
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
}

export default new TranscriptionStorageService();
