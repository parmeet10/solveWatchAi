/**
 * Keyboard Shortcut Service
 * Handles the business logic for processing transcriptions via keyboard shortcuts
 *
 * Note: This file uses CommonJS for compatibility with Electron main process
 */
const axios = require('axios');

const SERVER_URL = 'http://localhost:4000';
const API_BASE = `${SERVER_URL}/api`;

/**
 * Get the latest active transcription session
 * @returns {Promise<string|null>} Session ID or null if not found
 */
async function getLatestActiveSession() {
  try {
    const response = await axios.get(
      `${API_BASE}/transcription/latest-session`,
    );

    if (response.data.success && response.data.sessionId) {
      const sessionId = response.data.sessionId;
      // Validate that it's a UUID format (not a route path)
      if (sessionId === 'latest-session' || sessionId.includes('/')) {
        console.error('⚠️  Invalid session ID returned:', sessionId);
        return null;
      }
      return sessionId;
    }
    return null;
  } catch (error) {
    console.error('❌ Error getting latest session:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

/**
 * Trigger question processing for the latest active session
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function triggerQuestionProcessing() {
  try {
    console.log('🔍 Looking for latest question session...');
    const response = await axios.get(`${API_BASE}/question/latest-session`);

    if (!response.data.success || !response.data.sessionId) {
      console.log('⚠️  No active question session found');
      return { success: false, error: 'No active question session found' };
    }

    const sessionId = response.data.sessionId;
    console.log(`🚀 Processing question for session: ${sessionId}`);

    const processResponse = await axios.post(`${API_BASE}/question/process`, {
      sessionId,
    });

    if (processResponse.data.success) {
      console.log('✅ Question processed successfully!');
      console.log(
        `📄 Response preview: ${processResponse.data.fullResponse?.substring(
          0,
          100,
        )}...`,
      );
      return { success: true };
    } else {
      console.error(
        '❌ Failed to process question:',
        processResponse.data.error,
      );
      return { success: false, error: processResponse.data.error };
    }
  } catch (error) {
    console.error('❌ Error processing question:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Trigger transcription processing for the latest active session
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function triggerTranscriptionProcessing() {
  try {
    console.log('🔍 Looking for latest active session...');
    const sessionId = await getLatestActiveSession();

    if (!sessionId) {
      console.log('⚠️  No active transcription session found');
      console.log('💡 Make sure recording is started from your phone');
      return { success: false, error: 'No active session found' };
    }

    console.log(`🚀 Processing transcription for session: ${sessionId}`);

    const response = await axios.post(`${API_BASE}/transcription/process`, {
      sessionId,
    });

    if (response.data.success) {
      console.log('✅ Transcription processed successfully!');
      console.log(
        `📄 Response preview: ${response.data.fullResponse?.substring(
          0,
          100,
        )}...`,
      );
      return { success: true };
    } else {
      console.error('❌ Failed to process transcription:', response.data.error);
      return { success: false, error: response.data.error };
    }
  } catch (error) {
    console.error('❌ Error processing transcription:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Trigger processing - processes questions from mobile text streams
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function triggerProcessing() {
  // Process questions from mobile text stream flow
  return await triggerQuestionProcessing();
}

module.exports = {
  getLatestActiveSession,
  triggerQuestionProcessing,
  triggerTranscriptionProcessing,
  triggerProcessing,
};
