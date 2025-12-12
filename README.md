# CodeSnapGPT - AI-Powered Screenshot & Audio Analysis

An intelligent application that automatically extracts text from screenshots, monitors clipboard content, transcribes audio, and provides AI-powered analysis using multiple AI providers (OpenAI, Groq, Gemini) with automatic fallback.

## 🚀 Core Features

### 1. **Screenshot Monitoring & OCR**

- Automatically monitors a designated screenshots directory
- Extracts text from images using OCR (Tesseract.js)
- Processes new screenshots automatically when detected
- Supports context-aware processing (uses previous responses as context)

### 2. **Clipboard Monitoring**

- Monitors clipboard changes in real-time
- Automatically processes clipboard content with AI
- Can be toggled on/off from the UI
- Supports manual processing via keyboard shortcut (Cmd+Shift+V / Ctrl+Shift+V)

### 3. **AI-Powered Analysis**

- Multi-provider support: OpenAI, Groq (via Groq SDK), and Google Gemini
- Automatic fallback if one provider fails
- Configurable provider priority and selection
- Context-aware processing mode
- Specialized prompts for different content types:
  - Screenshot analysis (coding problems, solutions)
  - Clipboard content (code execution, debugging)
  - Audio transcription (question extraction and answers)

### 4. **Real-Time Audio Transcription**

- **Live Streaming**: Real-time audio transcription via WebSocket
- **File Upload**: Upload audio files (MP3, WAV, M4A, etc.) for transcription
- Uses mlx-whisper (optimized for Apple Silicon) for fast, accurate transcription
- Voice Activity Detection (VAD) to filter silence
- Process transcriptions with AI by pressing "P+P" (double P)

### 5. **Email Notifications**

- Optional email notifications for processed content
- Configurable via UI
- Sends AI responses to your email

### 6. **Real-Time Updates**

- WebSocket-based real-time data updates
- No polling required
- Instant UI updates when new content is processed

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.8+ (for transcription service)
- **FFmpeg** (for audio processing)
- **macOS** (for screenshot monitoring - can be adapted for other OS)
- At least one AI provider API key (OpenAI, Groq, or Gemini)

> **Note:** The Python virtual environment (`venv`) is not included in the repository. It will be created automatically during installation.

## 🛠️ Installation

### 1. Clone and Install Dependencies

```bash
# Install all dependencies (Node.js, Frontend, and Python)
npm run install:all
```

This will:

- Install Node.js dependencies
- Install frontend dependencies
- Create Python virtual environment
- Install Python dependencies
- Check for FFmpeg installation

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=4000
HTTPS_PORT=8443
SCREENSHOTS_PATH=/Users/your-username/Documents/screenshots

# Python Service Configuration
PYTHON_SERVICE_URL=http://localhost:8000
PYTHON_SERVICE_WS_URL=ws://localhost:8000

# Email Configuration (Optional)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com

# Logging (Optional)
LOG_LEVEL=INFO  # Options: ERROR, WARN, INFO, DEBUG
```

### 3. Generate SSL Certificates (Optional, for HTTPS)

For mobile device access (iPhone/iPad), generate SSL certificates:

```bash
node generate-cert.js
```

Or use the shell script:

```bash
./generate-cert.sh
```

## 🎯 Usage

### Starting the Application

#### Option 1: Start All Services (Recommended)

```bash
npm run start:all
```

This starts:

- Python transcription service (port 8000)
- Node.js backend server (port 4000)
- React frontend (port 3000)
- Electron keyboard listener (optional)

#### Option 2: Start Without Electron

```bash
npm run start:all:no-electron
```

#### Option 3: Start Services Individually

```bash
# Terminal 1: Python service
npm run dev:python

# Terminal 2: Backend server
npm run dev

# Terminal 3: Frontend
npm run dev:frontend
```

### Accessing the Application

- **Local**: http://localhost:4000
- **Network**: http://YOUR_LOCAL_IP:4000
- **HTTPS (if configured)**: https://localhost:8443 or https://YOUR_LOCAL_IP:8443

### Configuring API Keys

1. Click "Configure API Keys" button in the UI
2. Add at least one AI provider API key:
   - **OpenAI**: Get from https://platform.openai.com/api-keys
   - **Groq**: Get from https://console.groq.com/keys
   - **Gemini**: Get from https://makersuite.google.com/app/apikey
3. Select which providers to enable
4. Set provider priority order
5. Save configuration

### Using Screenshot Monitoring

1. Set up screenshot directory path in `.env` (SCREENSHOTS_PATH)
2. Take screenshots and save them to that directory
3. The application will automatically:
   - Detect new screenshots
   - Extract text using OCR
   - Process with AI
   - Display results in the UI

**macOS Screenshot Shortcut**: `Cmd+Shift+4` (select area) or `Cmd+Shift+3` (full screen)

### Using Clipboard Monitoring

1. Enable "Auto-process" toggle in the UI (enabled by default)
2. Copy any text (Cmd+C / Ctrl+C)
3. Click anywhere on the page or paste (Cmd+V)
4. The clipboard content will be automatically processed

**Manual Processing**: Press `Cmd+Shift+V` (Mac) or `Ctrl+Shift+V` (Windows/Linux)

### Using Audio Transcription

#### Live Streaming Transcription

1. Click "Start Recording" button
2. Speak into your microphone
3. See real-time transcriptions appear
4. Press "P+P" (double P key) to process the transcription with AI
5. Click "Stop Recording" when done

#### File Upload Transcription

1. Click "Upload Audio File" button
2. Select an audio file (MP3, WAV, M4A, etc.)
3. Wait for transcription to complete
4. The transcription will be displayed in the terminal

### Context Mode

Enable "Context Mode" to use previous AI responses as context for new analyses. This is useful for:

- Following up on previous questions
- Building on previous solutions
- Maintaining conversation context

## 📁 Project Structure

```
solveWatchAi/
├── backend/                 # Node.js backend
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── controllers/    # API controllers
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic services
│   │   ├── sockets/        # WebSocket handlers
│   │   └── utils/          # Utility functions (logger, etc.)
│   ├── prompts/            # AI prompt templates
│   └── config/             # Configuration files (API keys, email)
├── frontend/                # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API services
│   │   └── utils/          # Utility functions
│   └── electron/           # Electron app for global shortcuts
├── python-service/          # Python transcription service
│   ├── app.py              # FastAPI application
│   ├── transcription.py   # Transcription logic
│   ├── streaming.py        # WebSocket streaming
│   └── vad.py              # Voice Activity Detection
└── electron-helper/        # Global keyboard shortcut helper
```

## 🔧 Configuration

### Screenshot Directory

Set `SCREENSHOTS_PATH` in `.env` to your desired screenshot directory. Default: `/Users/your-username/Documents/screenshots`

### Python Service Configuration

Environment variables in `python-service/.env`:

- `PYTHON_SERVICE_PORT`: Port number (default: 8000)
- `WHISPER_MODEL`: Model size - tiny, base, small, medium, large (default: small)
- `ENABLE_VAD`: Enable Voice Activity Detection (default: true)
- `VAD_THRESHOLD`: VAD sensitivity 0.0-1.0 (default: 0.5)
- `CHUNK_LENGTH_S`: Chunk length for file transcription (default: 30)

### Logging

Set `LOG_LEVEL` in `.env`:

- `ERROR`: Only errors
- `WARN`: Warnings and errors
- `INFO`: Info, warnings, and errors (default)
- `DEBUG`: All logs including debug information

## 🐛 Troubleshooting

### Screenshots Not Being Detected

- Verify `SCREENSHOTS_PATH` in `.env` is correct
- Ensure the directory exists and is writable
- Check file permissions

### Clipboard Not Working

- Grant clipboard permissions in browser/system settings
- Try manual processing with `Cmd+Shift+V`
- Check browser console for errors

### Audio Transcription Not Working

- Ensure microphone permissions are granted
- For mobile devices, use HTTPS (generate certificates)
- Check that Python service is running on port 8000
- Verify FFmpeg is installed: `ffmpeg -version`

### AI Providers Failing

- Verify API keys are correct in configuration
- Check API key quotas/limits
- Review error logs for specific error messages
- The system will automatically fallback to next provider

### HTTPS Certificate Issues on iPhone

1. Generate certificates: `node generate-cert.js`
2. Access via HTTPS: `https://YOUR_IP:8443`
3. Tap "Show Details" → "Visit Website" when security warning appears
4. If page keeps reloading, clear Safari cache

## 📝 API Endpoints

### Image Processing

- `POST /api/image/upload` - Upload and process image
- `GET /api/data` - Get all processed data

### Clipboard

- `POST /api/clipboard/process` - Process clipboard content

### Transcription

- `POST /api/transcribe/upload` - Upload audio file for transcription
- `POST /api/transcription/process` - Process transcription with AI
- `GET /api/transcription/:sessionId` - Get transcription for session
- `GET /api/transcription/latest/session` - Get latest active session

### Configuration

- `GET /api/config/keys` - Get API keys configuration
- `POST /api/config/keys` - Save API keys configuration
- `GET /api/config/email` - Get email configuration
- `POST /api/config/email` - Save email configuration
- `GET /api/context` - Get context mode state
- `POST /api/context` - Update context mode state

## 🚀 Development

### Building Frontend

```bash
npm run build
```

### Running in Development Mode

```bash
# Backend with auto-reload
npm run dev

# Frontend with hot-reload
npm run dev:frontend

# Python service
npm run dev:python
```

## 📄 License

ISC

## 👤 Author

Parmeet Singh
