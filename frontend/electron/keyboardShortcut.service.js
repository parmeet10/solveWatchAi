/**
 * Keyboard Shortcut Service
 * Handles the business logic for processing transcriptions via keyboard shortcuts
 */
import axios from 'axios';

const SERVER_URL = 'http://localhost:4000';
const API_BASE = `${SERVER_URL}/api`;

/**
 * Get the latest active transcription session
 * @returns {Promise<string|null>} Session ID or null if not found
 */
export async function getLatestActiveSession() {
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
 * Trigger transcription processing for the latest active session
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function triggerTranscriptionProcessing() {
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
