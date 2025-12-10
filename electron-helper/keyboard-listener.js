/**
 * Alternative keyboard listener using iohook
 * This is a Node.js script that can detect global keyboard events
 * Run this instead of Electron if you prefer
 *
 * Install: npm install iohook --save
 * Note: iohook requires native compilation, so you may need to run:
 * npm install --build-from-source
 */

const ioHook = require('iohook');
const axios = require('axios');

const SERVER_URL = 'http://localhost:4000';
const API_BASE = `${SERVER_URL}/api`;

let keyPressHistory = [];
const KEY_TIMEOUT = 1000; // 1 second window for double press
let isProcessing = false;

async function getLatestActiveSession() {
  try {
    const response = await axios.get(
      `${API_BASE}/transcription/latest-session`,
    );
    if (response.data.success && response.data.sessionId) {
      return response.data.sessionId;
    }
    return null;
  } catch (error) {
    console.error('Error getting latest session:', error.message);
    return null;
  }
}

async function triggerProcessing() {
  if (isProcessing) {
    console.log('⏳ Already processing, please wait...');
    return;
  }

  try {
    isProcessing = true;
    console.log('🔍 Looking for latest active session...');
    const sessionId = await getLatestActiveSession();

    if (!sessionId) {
      console.log('⚠️  No active transcription session found');
      console.log('💡 Make sure recording is started from your phone');
      isProcessing = false;
      return;
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
    } else {
      console.error('❌ Failed to process transcription:', response.data.error);
    }
  } catch (error) {
    console.error('❌ Error processing transcription:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  } finally {
    isProcessing = false;
  }
}

// Listen for keydown events
ioHook.on('keydown', (event) => {
  // Check if 'p' key is pressed (keycode 25 on macOS, 80 on Windows/Linux)
  const isPKey =
    event.keycode === 25 || event.keycode === 80 || event.rawcode === 80;

  if (isPKey) {
    const now = Date.now();

    // Remove old key presses (older than 1 second)
    keyPressHistory = keyPressHistory.filter(
      (time) => now - time < KEY_TIMEOUT,
    );

    // Check if we have a recent 'p' press
    if (keyPressHistory.length >= 1) {
      // Double press detected!
      console.log('🎯 P+P detected! Triggering processing...');
      keyPressHistory = []; // Reset
      triggerProcessing();
    } else {
      // Add this press to history
      keyPressHistory.push(now);
    }
  }
});

// Start listening
ioHook.start();

console.log('🎹 Global keyboard shortcut listener started (iohook)');
console.log('📝 Press P+P (double P) to trigger audio processing');
console.log('🛑 Press Ctrl+C to stop');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping keyboard listener...');
  ioHook.stop();
  process.exit(0);
});
