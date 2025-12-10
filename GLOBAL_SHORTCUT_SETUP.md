# Global Keyboard Shortcut Setup

This guide explains how to set up global keyboard shortcuts to trigger audio processing from anywhere on your system, even when you're in Google Meet or another application.

## Problem

You're recording audio from your phone and want to trigger processing from your laptop without switching tabs. The browser-based "P+P" shortcut only works when the browser tab is focused.

## Solution Options

### Option 1: Electron App with Command+Shift+P (Recommended - Easiest)

This is the simplest and most reliable option. It uses `Command+Shift+P` (or `Ctrl+Shift+P` on Windows/Linux) which works globally.

**Setup:**

The Electron helper is now integrated into the frontend. To start it:

```bash
# From project root
npm run keyboard:electron

# Or from frontend directory
cd frontend && npm run electron
```

**Usage:**

- Press `Command+Shift+P` from anywhere (Google Meet, any app) to trigger processing
- The app runs in the background (no visible window)
- Make sure your backend server is running on `http://localhost:4000`

**Note:** The Electron helper is automatically started when you run `npm run start:all` from the project root.

### Option 2: iohook for True P+P Detection

This option can detect double "P" presses globally, but requires native compilation and macOS accessibility permissions.

**Setup:**

```bash
# Install iohook (may take a few minutes - compiles native code)
npm install iohook --save

# If installation fails, try:
npm install iohook --build-from-source
```

**Grant Accessibility Permissions (macOS):**

1. Go to **System Preferences** → **Security & Privacy** → **Privacy** → **Accessibility**
2. Click the lock to make changes
3. Add **Terminal** (or your terminal app) to the list
4. Make sure it's checked/enabled

**Usage:**

```bash
npm run keyboard:iohook
```

Then press `P+P` (double P) from anywhere to trigger processing.

**Note:** On first run, macOS may ask for accessibility permissions. Grant them for this to work.

## How It Works

1. **Start recording** from your phone (the app should be open and recording)
2. **Press the shortcut** from anywhere (Google Meet, browser, etc.)
3. The helper app:
   - Finds the latest active transcription session
   - Sends a request to your backend server
   - Server processes the transcription with AI
   - Results are available in your web interface

## Troubleshooting

### "No active transcription session found"

- Make sure you've started recording from your phone
- Check that the WebSocket connection is active (green "Connected" indicator)
- Wait a few seconds after starting recording for the first transcription chunk

### Shortcut not working (Electron)

- Make sure the Electron app is running: `npm run keyboard:electron`
- Check the console for error messages
- Try restarting the app

### Shortcut not working (iohook)

- **macOS**: Check accessibility permissions in System Preferences
- Make sure iohook installed correctly: `npm list iohook`
- Try rebuilding: `npm rebuild iohook`

### Connection errors

- Make sure your backend server is running: `npm run dev` or `npm start`
- Check that the server is on port 4000
- Verify the API endpoint: `http://localhost:4000/api/transcription/latest-session`

## Alternative: Browser Tab Focus

If you don't want to use the helper apps, you can still use the browser-based shortcut:

- Make sure the browser tab with your app is focused
- Press `P+P` (double P) quickly
- This only works when the tab is active

## Recommendation

For the best experience:

- Use **Option 1 (Electron)** for reliability and ease of setup
- The `Command+Shift+P` shortcut is easy to remember and works everywhere
- No special permissions needed (unlike iohook)

For true "P+P" detection:

- Use **Option 2 (iohook)** if you specifically need double "P" press
- Requires macOS accessibility permissions
- May need to rebuild after Node.js updates
