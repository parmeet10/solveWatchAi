/**
 * Alternative keyboard listener using iohook
 * This is a Node.js script that can detect global keyboard events
 * Run this instead of Electron if you prefer
 *
 * Install: npm install iohook --save
 * Note: iohook requires native compilation, so you may need to run:
 * npm install --build-from-source
 */

import ioHook from 'iohook';
import { triggerTranscriptionProcessing } from './keyboardShortcut.service.js';

let keyPressHistory = [];
const KEY_TIMEOUT = 1000; // 1 second window for double press
let isProcessing = false;

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
      if (!isProcessing) {
        handleProcessing();
      }
    } else {
      // Add this press to history
      keyPressHistory.push(now);
    }
  }
});

async function handleProcessing() {
  if (isProcessing) {
    console.log('⏳ Already processing, please wait...');
    return;
  }

  try {
    isProcessing = true;
    await triggerTranscriptionProcessing();
  } finally {
    isProcessing = false;
  }
}

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
