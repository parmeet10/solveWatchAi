/**
 * Electron main process for global keyboard shortcuts
 * This app runs in the background and listens for global keyboard shortcuts
 * to trigger audio processing without needing to switch tabs
 */
import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { triggerProcessing } from './keyboardShortcut.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let keyPressHistory = [];
const KEY_TIMEOUT = 1000; // 1 second window for double press
let isProcessing = false;

function createWindow() {
  // Create a hidden window that will capture keyboard events
  mainWindow = new BrowserWindow({
    width: 300,
    height: 200,
    show: false, // Don't show the window
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load HTML that will capture keydown events
  mainWindow.loadFile(path.join(__dirname, 'listener.html'));

  // Hide dock icon on macOS
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
}

// Listen for keydown events from renderer
ipcMain.on('keydown', (event, key) => {
  if (key.toLowerCase() === 'p') {
    const now = Date.now();

    // Remove old key presses (older than 1 second)
    keyPressHistory = keyPressHistory.filter(
      (time) => now - time < KEY_TIMEOUT,
    );

    // Check if we have a recent 'p' press
    if (keyPressHistory.length >= 1) {
      // Double press detected!
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
    return;
  }

  try {
    isProcessing = true;
    await triggerProcessing(); // Tries questions first, then transcription
  } finally {
    isProcessing = false;
  }
}

function setupGlobalShortcut() {
  // Register Command+Shift+P as an alternative shortcut (works globally)
  const ret = globalShortcut.register('CommandOrControl+Shift+P', () => {
    if (!isProcessing) {
      handleProcessing();
    }
  });

  if (!ret) {
    console.error('❌ Failed to register global shortcut');
  }
}

app.whenReady().then(() => {
  // Startup banner
  console.log('\n' + '='.repeat(60));
  console.log('  Electron Keyboard Shortcut Service');
  console.log('='.repeat(60));
  console.log('✅ Service started');
  console.log('📝 Shortcuts:');
  console.log('   • P+P (double P) - Trigger audio processing');
  console.log('   • Command+Shift+P - Alternative shortcut');
  console.log('-'.repeat(60));
  
  createWindow();
  setupGlobalShortcut();

  // Make window always on top and focusable (but still hidden)
  // This helps capture keyboard events
  mainWindow.setAlwaysOnTop(true, 'floating', 1);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // On macOS, keep the app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});
