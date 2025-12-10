# Global Keyboard Shortcut Helper

This helper app allows you to trigger audio processing from anywhere on your system, even when you're in Google Meet or another application.

## Two Options

### Option 1: Electron App (Recommended for macOS)

The Electron app provides a reliable global shortcut using `Command+Shift+P`.

**Setup:**

```bash
cd electron-helper
npm install
npm start
```

**Usage:**

- Press `Command+Shift+P` (or `Ctrl+Shift+P` on Windows/Linux) from anywhere to trigger processing
- The app runs in the background (no visible window)
- Make sure your backend server is running on `http://localhost:4000`

### Option 2: iohook (Better for detecting P+P)

This option can detect double "P" presses globally, but requires native compilation.

**Setup:**

```bash
npm install iohook --save
# May need to rebuild: npm rebuild iohook
```

**Usage:**

```bash
npm run keyboard:iohook
```

Then press `P+P` (double P) from anywhere to trigger processing.

**Note:** On macOS, you may need to grant accessibility permissions:

1. Go to System Preferences → Security & Privacy → Privacy → Accessibility
2. Add Terminal (or your terminal app) to the list

## How It Works

1. When you press the shortcut, the app finds the latest active transcription session
2. It sends a request to your backend server to process that session
3. The server processes the transcription with AI and returns the result

## Troubleshooting

- **"No active transcription session found"**: Make sure you've started recording from your phone
- **Shortcut not working**:
  - For Electron: Make sure the app is running (`npm run keyboard:electron`)
  - For iohook: Check accessibility permissions on macOS
- **Connection errors**: Make sure your backend server is running on port 4000
