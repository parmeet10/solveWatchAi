/**
 * Service for storing and managing extracted questions from text streams
 */
class QuestionStorageService {
  constructor() {
    // Map of sessionId -> { questions: [], createdAt: Date, lastUpdated: Date }
    this.sessions = new Map();
  }

  /**
   * Add questions to a session
   * @param {string} sessionId - Session ID
   * @param {Array} questions - Array of question objects with { question, type, confidence }
   * @param {number} timestamp - Timestamp when questions were extracted
   */
  addQuestions(sessionId, questions, timestamp = null) {
    if (!sessionId || !Array.isArray(questions) || questions.length === 0) {
      return;
    }

    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        questions: [],
        createdAt: new Date(),
        lastUpdated: new Date(),
      });
    }

    const session = this.sessions.get(sessionId);
    const questionTimestamp = timestamp ? new Date(timestamp) : new Date();

    questions.forEach((q) => {
      session.questions.push({
        question: q.question,
        type: q.type || 'technical',
        confidence: q.confidence || 0.8,
        timestamp: questionTimestamp,
        extractedAt: new Date(),
      });
    });

    session.lastUpdated = new Date();
  }

  /**
   * Get the latest question from a session
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Latest question object or null if not found
   */
  getLatestQuestion(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.questions.length === 0) {
      return null;
    }

    // Return the most recently added question
    return session.questions[session.questions.length - 1];
  }

  /**
   * Get all questions for a session
   * @param {string} sessionId - Session ID
   * @returns {Array} Array of question objects
   */
  getQuestions(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? session.questions : [];
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
   * Clear questions for a session (keeps session alive)
   * @param {string} sessionId - Session ID
   */
  clearSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.questions = [];
      session.lastUpdated = new Date();
    }
  }

  /**
   * Remove a session completely
   * @param {string} sessionId - Session ID
   */
  removeSession(sessionId) {
    this.sessions.delete(sessionId);
  }

  /**
   * Get all active session IDs that have questions
   * @returns {Array<string>} Array of session IDs
   */
  getActiveSessions() {
    const activeSessions = [];
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.questions.length > 0) {
        activeSessions.push(sessionId);
      }
    }
    return activeSessions;
  }

  /**
   * Get the latest active session ID (most recently updated)
   * @returns {string|null} Latest session ID or null if none found
   */
  getLatestActiveSession() {
    const activeSessions = this.getActiveSessions();
    if (activeSessions.length === 0) {
      return null;
    }

    let latestSession = null;
    let latestTime = 0;

    for (const sessionId of activeSessions) {
      const session = this.sessions.get(sessionId);
      if (session && session.lastUpdated) {
        const sessionTime = session.lastUpdated.getTime();
        if (sessionTime > latestTime) {
          latestTime = sessionTime;
          latestSession = sessionId;
        }
      }
    }

    // If no session has lastUpdated, return the first one with questions
    if (!latestSession && activeSessions.length > 0) {
      return activeSessions[0];
    }

    return latestSession;
  }

  /**
   * Get questions from a session within the last N seconds
   * @param {string} sessionId - Session ID
   * @param {number} secondsAgo - Number of seconds to look back
   * @returns {Array} Array of questions from the last N seconds
   */
  getQuestionsLastSeconds(sessionId, secondsAgo = 30) {
    const session = this.sessions.get(sessionId);
    if (!session || session.questions.length === 0) {
      return [];
    }

    const cutoffTime = Date.now() - secondsAgo * 1000;

    return session.questions.filter((q) => {
      const questionTime = q.timestamp.getTime();
      return questionTime >= cutoffTime;
    });
  }

  /**
   * Clear all sessions
   */
  clearAll() {
    this.sessions.clear();
  }
}

export default new QuestionStorageService();

