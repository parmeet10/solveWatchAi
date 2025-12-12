# CodeSnapGPT - Developer Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [System Components](#system-components)
3. [API Endpoints Reference](#api-endpoints-reference)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [WebSocket Communication](#websocket-communication)
6. [Service Architecture](#service-architecture)
7. [Frontend Architecture](#frontend-architecture)
8. [Configuration Management](#configuration-management)
9. [Error Handling](#error-handling)
10. [Development Workflow](#development-workflow)

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   App.jsx    │  │  Components  │  │   Services   │      │
│  │              │  │              │  │              │      │
│  │ - State Mgmt │  │ - Upload     │  │ - API Client │      │
│  │ - WebSocket  │  │ - Data       │  │ - WebSocket  │      │
│  │   Connection │  │ - Transcriber│  │   Hook       │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │              │
└─────────┼─────────────────┼─────────────────┼──────────────┘
          │                 │                 │
          │ HTTP/REST       │ WebSocket       │ WebSocket
          │                 │ (data-updates)  │ (stream-transcribe)
          │                 │                 │
┌─────────▼─────────────────▼─────────────────▼──────────────┐
│              Backend (Node.js/Express)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Routes      │  │ Controllers  │  │  Services    │      │
│  │              │  │              │  │              │      │
│  │ - /api/upload │  │ - Image      │  │ - OCR        │      │
│  │ - /api/data   │  │ - Clipboard  │  │ - AI Service │      │
│  │ - /api/clip   │  │ - Config     │  │ - Email      │      │
│  │ - /api/config │  │ - Transcribe │  │ - Image Proc │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │              │
│  ┌──────▼─────────────────▼─────────────────▼───────┐      │
│  │         WebSocket Handlers (Socket.io)            │      │
│  │  - DataHandler (data-updates namespace)           │      │
│  │  - StreamHandler (stream-transcribe namespace)    │      │
│  └──────┬───────────────────────────────────────────┘      │
│         │                                                    │
└─────────┼────────────────────────────────────────────────────┘
          │
          │ WebSocket (audio streaming)
          │
┌─────────▼────────────────────────────────────────────────────┐
│         Python Service (FastAPI)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   app.py     │  │ transcription│  │  streaming   │      │
│  │              │  │     .py      │  │     .py      │      │
│  │ - REST API   │  │ - Whisper    │  │ - WebSocket  │      │
│  │ - WebSocket  │  │   Model      │  │   Handler    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└──────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Frontend**: React 18, Vite, Socket.io-client
- **Backend**: Node.js, Express 5, Socket.io
- **Python Service**: FastAPI, mlx-whisper, WebSockets
- **AI Providers**: OpenAI, Groq, Google Gemini
- **OCR**: Tesseract.js
- **Email**: Nodemailer

---

## System Components

### 1. Frontend Components

#### `App.jsx` (Main Application Component)
- **Location**: `frontend/src/App.jsx`
- **Responsibilities**:
  - Main application state management
  - WebSocket connection management (`/data-updates` namespace)
  - API key and email configuration modals
  - Clipboard processing orchestration
  - Real-time data updates via WebSocket

**Key State Variables**:
```javascript
- processedData: Array of processed items (screenshots, clipboard, transcriptions)
- loading: Boolean for initial data load
- processingClipboard: Boolean for clipboard processing status
- apiKeysConfigured: Boolean for API key configuration status
- emailConfigured: Boolean for email configuration status
```

**Key Functions**:
- `checkApiKeysConfig()`: Validates API keys configuration on startup
- `checkEmailConfig()`: Validates email configuration
- `processClipboardContent()`: Sends clipboard content to backend
- `fetchData()`: Initial data fetch on mount

#### `UploadSection.jsx`
- **Location**: `frontend/src/components/UploadSection.jsx`
- **Responsibilities**:
  - Image file upload UI
  - Context mode toggle
  - Upload progress and status

**Data Flow**:
1. User selects image file
2. File converted to FormData
3. POST to `/api/upload`
4. Response triggers `onUploadSuccess` callback
5. WebSocket automatically updates UI with new data

#### `DataSection.jsx`
- **Location**: `frontend/src/components/DataSection.jsx`
- **Responsibilities**:
  - Display processed data (screenshots, clipboard, transcriptions)
  - Renders `ScreenshotItem` components
  - Shows loading and empty states

#### `Transcriber.jsx`
- **Location**: `frontend/src/components/Transcriber.jsx`
- **Responsibilities**:
  - Tab management (Upload vs Live Streaming)
  - Orchestrates transcription components

#### `LiveStreamingTranscribe.jsx`
- **Location**: `frontend/src/components/LiveStreamingTranscribe.jsx`
- **Responsibilities**:
  - Real-time audio capture from microphone
  - WebSocket connection to `/stream-transcribe` namespace
  - Audio chunk encoding and transmission
  - Transcription display
  - Keyboard shortcut handling (P+P for processing)

#### `FileUploadTranscribe.jsx`
- **Location**: `frontend/src/components/FileUploadTranscribe.jsx`
- **Responsibilities**:
  - Audio file upload UI
  - File validation
  - Transcription request handling

### 2. Backend Services

#### `image-processing.service.js`
- **Location**: `backend/src/services/image-processing.service.js`
- **Responsibilities**:
  - Orchestrates image processing pipeline
  - Manages processed data array
  - Context mode state management
  - WebSocket notification triggering

**Key Methods**:
```javascript
- processImage(imagePath, filename, useContext): Main processing pipeline
- addProcessedData(data): Adds data and notifies WebSocket clients
- getProcessedData(): Returns all processed data
- setUseContextEnabled(enabled): Toggles context mode
- getLastResponse(): Returns last AI response for context
```

**Processing Pipeline**:
1. Extract text using OCR service
2. Check context mode status
3. Call AI service (with or without context)
4. Store response as last response
5. Create processed entry
6. Add to processed data array
7. Notify WebSocket clients
8. Send email (if enabled)

#### `ai.service.js`
- **Location**: `backend/src/services/ai.service.js`
- **Responsibilities**:
  - Multi-provider AI integration (OpenAI, Groq, Gemini)
  - Automatic fallback mechanism
  - Provider failure tracking
  - Prompt management

**Key Methods**:
```javascript
- askGpt(extractedText): Standard AI query (screenshots)
- askGptWithContext(extractedText, lastResponse): Context-aware query
- askGptClipboard(content): Clipboard-specific query
- askGptTranscription(transcriptionText): Transcription-specific query
```

**Fallback Mechanism**:
1. Try providers in configured order
2. On failure, mark provider as failed (5-minute timeout)
3. Try next provider in list
4. If all fail, throw error

#### `ocr.service.js`
- **Location**: `backend/src/services/ocr.service.js`
- **Responsibilities**:
  - Text extraction from images using Tesseract.js
  - Image preprocessing (if needed)

#### `email.service.js`
- **Location**: `backend/src/services/email.service.js`
- **Responsibilities**:
  - Email sending via Nodemailer
  - SMTP configuration
  - Email template formatting

#### `screenshot-monitor.service.js`
- **Location**: `backend/src/services/screenshot-monitor.service.js`
- **Responsibilities**:
  - File system monitoring for new screenshots
  - Automatic screenshot detection
  - Triggers image processing on new files

#### `clipboard-monitor.service.js`
- **Location**: `backend/src/services/clipboard-monitor.service.js`
- **Responsibilities**:
  - Clipboard content monitoring
  - Automatic clipboard processing
  - Change detection

#### `transcription-storage.service.js`
- **Location**: `backend/src/services/transcription-storage.service.js`
- **Responsibilities**:
  - Session-based transcription storage
  - Transcription chunk management
  - Session lifecycle management

### 3. WebSocket Handlers

#### `DataHandler` (data-updates namespace)
- **Location**: `backend/src/sockets/dataHandler.js`
- **Namespace**: `/data-updates`
- **Purpose**: Real-time data updates to frontend

**Events**:
- `connection`: Client connects, receives initial data
- `data_update`: Broadcasts new processed data to all clients
- `disconnect`: Client disconnects

**Event Payloads**:
```javascript
// Initial connection
{
  type: 'initial',
  data: [/* array of processed items */]
}

// Update
{
  type: 'update',
  data: [/* updated array */],
  newItem: {/* newly processed item */}
}
```

#### `StreamHandler` (stream-transcribe namespace)
- **Location**: `backend/src/sockets/streamHandler.js`
- **Namespace**: `/stream-transcribe`
- **Purpose**: Real-time audio streaming for transcription

**Events**:
- `connection`: Creates new session, connects to Python service
- `start_stream`: Initiates audio streaming
- `audio_chunk`: Receives base64-encoded audio chunks
- `flush_buffer`: Flushes Python service buffer
- `end_stream`: Ends streaming session
- `transcription`: Receives transcription chunks from Python service
- `disconnect`: Cleans up session

**Event Flow**:
1. Client connects → Session created
2. Client emits `start_stream` → Python WebSocket connection established
3. Client sends `audio_chunk` events → Forwarded to Python service
4. Python service sends transcriptions → Forwarded to client
5. Client emits `flush_buffer` → Python buffer flushed
6. Client emits `end_stream` → Session closed

---

## API Endpoints Reference

### Base URL
- **HTTP**: `http://localhost:4000`
- **HTTPS**: `https://localhost:8443`

### Image Processing Endpoints

#### `POST /api/upload`
Upload and process an image file.

**Request**:
- **Method**: POST
- **Content-Type**: `multipart/form-data`
- **Body**:
  ```javascript
  {
    image: File // Image file (JPEG, PNG, GIF, BMP, WEBP)
  }
  ```

**Response** (Success - 200):
```javascript
{
  success: true,
  message: "Image processed successfully",
  filename: "screenshot.png",
  extractedText: "Extracted text preview...",
  gptResponse: "AI response preview...",
  usedContext: false
}
```

**Response** (Error - 400/500):
```javascript
{
  success: false,
  error: "Error message"
}
```

**Data Flow**:
1. Multer middleware saves file to `uploads/` directory
2. `ImageController.uploadImage()` called
3. `ImageProcessingService.processImage()` executes:
   - OCR extraction
   - AI processing (with/without context)
   - Email notification (if enabled)
4. File deleted after processing
5. Response returned
6. WebSocket broadcasts update to all clients

#### `GET /api/data`
Get all processed data.

**Request**:
- **Method**: GET
- **Headers**: None

**Response** (Success - 200):
```javascript
[
  {
    filename: "screenshot.png",
    timestamp: "12/25/2024, 10:30:45 AM",
    extractedText: "Text preview...",
    gptResponse: "AI response preview...",
    usedContext: false
  },
  // ... more items
]
```

**Note**: This endpoint is primarily for initial data load. Real-time updates use WebSocket.

### Clipboard Endpoints

#### `POST /api/clipboard`
Process clipboard content with AI.

**Request**:
- **Method**: POST
- **Content-Type**: `application/json`
- **Body**:
  ```javascript
  {
    content: "Text content from clipboard"
  }
  ```

**Response** (Success - 200):
```javascript
{
  success: true,
  data: {
    filename: "clipboard",
    timestamp: "12/25/2024, 10:30:45 AM",
    extractedText: "Clipboard content preview...",
    gptResponse: "AI response preview...",
    usedContext: false
  }
}
```

**Response** (Error - 400):
```javascript
{
  error: "Clipboard content is required and must be a string"
}
```

**Data Flow**:
1. `ClipboardController.processClipboard()` receives content
2. Checks context mode status
3. Calls AI service (with/without context)
4. Creates processed entry
5. Adds to processed data array
6. Sends email (if enabled)
7. WebSocket broadcasts update
8. Response returned

### Configuration Endpoints

#### `GET /api/config/keys`
Get API keys configuration (masked).

**Request**:
- **Method**: GET

**Response** (Success - 200):
```javascript
{
  success: true,
  config: {
    keys: {
      openai: "***",  // Masked
      groq: "***",
      gemini: "***"
    },
    order: ["openai", "groq", "gemini"],
    enabled: ["openai", "groq"]
  }
}
```

**Response** (No Config - 200):
```javascript
{
  success: true,
  config: null
}
```

#### `POST /api/config/keys`
Save API keys configuration.

**Request**:
- **Method**: POST
- **Content-Type**: `application/json`
- **Body**:
  ```javascript
  {
    keys: {
      openai: "sk-...",  // New key (or "***" to keep existing)
      groq: "gsk_...",
      gemini: "AIza..."
    },
    order: ["openai", "groq", "gemini"],
    enabled: ["openai", "groq"]
  }
  ```

**Response** (Success - 200):
```javascript
{
  success: true,
  message: "Configuration saved successfully",
  config: {
    keys: {
      openai: "***",  // Masked in response
      groq: "***",
      gemini: "***"
    },
    order: ["openai", "groq", "gemini"],
    enabled: ["openai", "groq"]
  }
}
```

**Response** (Error - 400):
```javascript
{
  success: false,
  error: "At least one AI provider must be enabled"
}
```

**Data Flow**:
1. Validates request body
2. Loads existing config (if exists)
3. Merges new keys (only updates non-masked keys)
4. Validates at least one provider enabled
5. Saves to `backend/config/api-keys.json`
6. Returns masked response

#### `GET /api/config/email`
Get email configuration.

**Request**:
- **Method**: GET

**Response** (Success - 200):
```javascript
{
  success: true,
  config: {
    enabled: true,
    email: "user@example.com"
  }
}
```

#### `POST /api/config/email`
Save email configuration.

**Request**:
- **Method**: POST
- **Content-Type**: `application/json`
- **Body**:
  ```javascript
  {
    enabled: true,
    email: "user@example.com"
  }
  ```

**Response** (Success - 200):
```javascript
{
  success: true,
  message: "Email configuration saved successfully",
  config: {
    enabled: true,
    email: "user@example.com"
  }
}
```

**Response** (Error - 400):
```javascript
{
  success: false,
  error: "Invalid email address format"
}
```

### Context Endpoints

#### `GET /api/context-state`
Get context mode state.

**Request**:
- **Method**: GET

**Response** (Success - 200):
```javascript
{
  useContextEnabled: false
}
```

#### `POST /api/context-state`
Update context mode state.

**Request**:
- **Method**: POST
- **Content-Type**: `application/json`
- **Body**:
  ```javascript
  {
    enabled: true
  }
  ```

**Response** (Success - 200):
```javascript
{
  success: true,
  useContextEnabled: true
}
```

### Transcription Endpoints

#### `POST /api/transcribe`
Upload audio file for transcription.

**Request**:
- **Method**: POST
- **Content-Type**: `multipart/form-data`
- **Body**:
  ```javascript
  {
    audio: File // Audio file (MP3, WAV, M4A, MPEG, MP4, WEBM)
  }
  ```

**Response** (Success - 200):
```javascript
{
  success: true,
  message: "File transcribed successfully.",
  filename: "audio.mp3"
}
```

**Data Flow**:
1. File saved to `uploads/` directory
2. `TranscribeController.transcribeFile()` called
3. Python service client transcribes file
4. Transcription logged to terminal
5. File deleted
6. Response returned

#### `POST /api/transcription/process`
Process stored transcription with AI.

**Request**:
- **Method**: POST
- **Content-Type**: `application/json`
- **Body**:
  ```javascript
  {
    sessionId: "uuid-string",
    cutoffTimestamp: 1234567890  // Optional: process only last 10 seconds
  }
  ```

**Response** (Success - 200):
```javascript
{
  success: true,
  data: {
    filename: "transcription-uuid",
    timestamp: "12/25/2024, 10:30:45 AM",
    extractedText: "Transcription preview...",
    gptResponse: "AI response preview...",
    usedContext: false,
    type: "transcription"
  },
  fullTranscription: "Complete transcription text...",
  fullResponse: "Complete AI response..."
}
```

**Response** (Error - 400):
```javascript
{
  success: false,
  error: "No transcription found for this session",
  debug: {
    sessionId: "uuid-string",
    activeSessions: ["uuid1", "uuid2"],
    sessionExists: true
  }
}
```

**Data Flow**:
1. Validates sessionId
2. Flushes Python service buffer (if cutoffTimestamp provided)
3. Retrieves transcription from storage service
4. Processes with AI service
5. Creates processed entry
6. Adds to processed data array
7. Sends email (if enabled)
8. Clears transcription storage for session
9. WebSocket broadcasts update
10. Response returned

#### `GET /api/transcription/:sessionId`
Get transcription for a specific session.

**Request**:
- **Method**: GET
- **URL Parameters**:
  - `sessionId`: UUID string

**Response** (Success - 200):
```javascript
{
  success: true,
  sessionId: "uuid-string",
  fullText: "Complete transcription text...",
  chunks: [
    {
      text: "Chunk 1",
      timestamp: 1234567890,
      confidence: 0.95
    },
    // ... more chunks
  ],
  createdAt: "2024-12-25T10:30:45.000Z"
}
```

#### `GET /api/transcription/latest-session`
Get latest active session ID.

**Request**:
- **Method**: GET

**Response** (Success - 200):
```javascript
{
  success: true,
  sessionId: "uuid-string"
}
```

**Response** (No Session - 200):
```javascript
{
  success: false,
  sessionId: null,
  message: "No active sessions with transcriptions found"
}
```

---

## Data Flow Diagrams

### 1. Image Upload Flow

```
User selects image
    │
    ▼
[UploadSection.jsx]
    │
    ▼
FormData created
    │
    ▼
POST /api/upload
    │
    ▼
[Multer Middleware]
    │
    ▼
File saved to uploads/
    │
    ▼
[ImageController.uploadImage()]
    │
    ▼
[ImageProcessingService.processImage()]
    │
    ├─► [OCRService.extractText()]
    │       │
    │       ▼
    │   Text extracted
    │
    ├─► [AIService.askGpt() or askGptWithContext()]
    │       │
    │       ├─► Try Provider 1 (OpenAI)
    │       │       │
    │       │       ├─► Success → Return response
    │       │       └─► Failure → Try Provider 2
    │       │
    │       ├─► Try Provider 2 (Groq)
    │       │       │
    │       │       ├─► Success → Return response
    │       │       └─► Failure → Try Provider 3
    │       │
    │       └─► Try Provider 3 (Gemini)
    │               │
    │               ├─► Success → Return response
    │               └─► Failure → Throw error
    │
    ├─► Create processed entry
    │
    ├─► Add to processedData array
    │
    ├─► [DataHandler.notifyDataChanged()]
    │       │
    │       ▼
    │   WebSocket broadcast to all clients
    │
    ├─► [EmailService.sendMail()] (if enabled)
    │
    └─► Delete uploaded file
            │
            ▼
    Response returned to frontend
            │
            ▼
    [App.jsx] receives WebSocket update
            │
            ▼
    UI automatically updates
```

### 2. Clipboard Processing Flow

```
User copies text (Cmd+C)
    │
    ▼
[App.jsx] detects clipboard change
    │
    ▼
navigator.clipboard.readText()
    │
    ▼
processClipboardContent()
    │
    ▼
POST /api/clipboard
    │
    ▼
[ClipboardController.processClipboard()]
    │
    ├─► Validate content
    │
    ├─► Check context mode
    │       │
    │       ├─► Enabled → [AIService.askGptWithContext()]
    │       └─► Disabled → [AIService.askGptClipboard()]
    │
    ├─► Create processed entry
    │
    ├─► [ImageProcessingService.addProcessedData()]
    │       │
    │       ▼
    │   WebSocket broadcast
    │
    ├─► [EmailService.sendMail()] (if enabled)
    │
    └─► Return response
            │
            ▼
    [App.jsx] receives WebSocket update
            │
            ▼
    UI automatically updates
```

### 3. Live Audio Transcription Flow

```
User clicks "Start Recording"
    │
    ▼
[LiveStreamingTranscribe.jsx]
    │
    ├─► navigator.mediaDevices.getUserMedia()
    │       │
    │       ▼
    │   Audio stream captured
    │
    ├─► MediaRecorder API
    │       │
    │       ▼
    │   Audio chunks generated
    │
    └─► WebSocket connection to /stream-transcribe
            │
            ▼
    [StreamHandler] receives connection
            │
            ├─► Create session (UUID)
            │
            ├─► Connect to Python service WebSocket
            │
            └─► Emit 'stream_started' to client
                    │
                    ▼
    Client emits 'start_stream'
            │
            ▼
    Audio chunks sent via 'audio_chunk' events
            │
            ▼
    [StreamHandler] forwards to Python service
            │
            ▼
    [Python Service] processes audio
            │
            ├─► Voice Activity Detection (VAD)
            │
            ├─► Buffer accumulation
            │
            ├─► Whisper transcription
            │
            └─► Send transcription chunks
                    │
                    ▼
    [StreamHandler] forwards to client
            │
            ▼
    [LiveStreamingTranscribe.jsx] displays transcription
            │
            ▼
    User presses "P+P" (double P)
            │
            ▼
    POST /api/transcription/process
            │
            ├─► Flush Python buffer
            │
            ├─► Retrieve transcription from storage
            │
            ├─► [AIService.askGptTranscription()]
            │
            ├─► Create processed entry
            │
            ├─► Add to processedData
            │
            ├─► WebSocket broadcast
            │
            └─► Clear transcription storage
                    │
                    ▼
    UI updates with AI response
```

### 4. Screenshot Monitoring Flow

```
User takes screenshot (Cmd+Shift+4)
    │
    ▼
Screenshot saved to SCREENSHOTS_PATH
    │
    ▼
[ScreenshotMonitorService] detects new file
    │
    ▼
File system watcher triggers
    │
    ▼
[ImageProcessingService.processImage()]
    │
    ▼
(Same flow as Image Upload Flow)
```

---

## WebSocket Communication

### Namespace: `/data-updates`

**Purpose**: Real-time data updates for processed items

**Connection**:
```javascript
const socket = io(`${window.location.origin}/data-updates`, {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  reconnection: true
});
```

**Events**:

1. **Connection Event** (Automatic on connect)
   - **Emitted by**: Server
   - **Event Name**: `data_update`
   - **Payload**:
     ```javascript
     {
       type: 'initial',
       data: [/* array of all processed items */]
     }
     ```

2. **Data Update Event** (When new item processed)
   - **Emitted by**: Server
   - **Event Name**: `data_update`
   - **Payload**:
     ```javascript
     {
       type: 'update',
       data: [/* updated array */],
       newItem: {
         filename: "screenshot.png",
         timestamp: "12/25/2024, 10:30:45 AM",
         extractedText: "...",
         gptResponse: "...",
         usedContext: false
       }
     }
     ```

**Client Implementation**:
```javascript
socket.on('data_update', (payload) => {
  if (payload.type === 'initial' || payload.type === 'update') {
    setProcessedData(payload.data || []);
    setLoading(false);
  }
});
```

### Namespace: `/stream-transcribe`

**Purpose**: Real-time audio streaming for transcription

**Connection**:
```javascript
const socket = io(`${window.location.origin}/stream-transcribe`, {
  path: '/socket.io',
  transports: ['websocket'],
  reconnection: true
});
```

**Events**:

1. **Connection** (Automatic on connect)
   - **Emitted by**: Server
   - **Event Name**: `stream_started`
   - **Payload**:
     ```javascript
     {
       sessionId: "uuid-string"
     }
     ```

2. **Start Stream** (Client → Server)
   - **Event Name**: `start_stream`
   - **Payload**: None
   - **Action**: Initiates Python WebSocket connection

3. **Audio Chunk** (Client → Server)
   - **Event Name**: `audio_chunk`
   - **Payload**:
     ```javascript
     {
       chunk: "base64-encoded-audio-data"
     }
     ```

4. **Transcription** (Server → Client)
   - **Event Name**: `transcription`
   - **Payload**:
     ```javascript
     {
       sessionId: "uuid-string",
       text: "Transcribed text",
       confidence: 0.95,
       timestamp: 1234567890,
       final: false
     }
     ```

5. **Flush Buffer** (Client → Server)
   - **Event Name**: `flush_buffer`
   - **Payload**:
     ```javascript
     {
       cutoffTimestamp: 1234567890,  // Optional
       gracePeriodMs: 500
     }
     ```

6. **Buffer Flushed** (Server → Client)
   - **Event Name**: `buffer_flushed`
   - **Payload**:
     ```javascript
     {
       sessionId: "uuid-string"
     }
     ```

7. **End Stream** (Client → Server)
   - **Event Name**: `end_stream`
   - **Payload**: None
   - **Action**: Closes Python WebSocket connection

8. **Error** (Server → Client)
   - **Event Name**: `error`
   - **Payload**:
     ```javascript
     {
       message: "Error description"
     }
     ```

**Client Implementation**:
```javascript
// Start stream
socket.emit('start_stream');

// Send audio chunks
socket.emit('audio_chunk', {
  chunk: base64AudioData
});

// Receive transcriptions
socket.on('transcription', (data) => {
  // Update UI with transcription
});

// Flush buffer
socket.emit('flush_buffer', {
  cutoffTimestamp: Date.now(),
  gracePeriodMs: 500
});

// End stream
socket.emit('end_stream');
```

---

## Service Architecture

### Service Dependencies

```
ImageProcessingService
    ├─► OCRService (text extraction)
    ├─► AIService (AI processing)
    ├─► EmailService (notifications)
    └─► DataHandler[] (WebSocket notifications)

AIService
    ├─► OpenAI SDK
    ├─► Groq SDK
    └─► Google Gemini SDK

ClipboardController
    ├─► AIService
    ├─► ImageProcessingService
    └─► EmailService

TranscriptionController
    ├─► AIService
    ├─► TranscriptionStorageService
    ├─► ImageProcessingService
    ├─► PythonServiceWS
    └─► EmailService

StreamHandler
    └─► PythonServiceWS
            └─► Python FastAPI WebSocket
```

### Service Communication Patterns

1. **Synchronous Calls**: Direct function calls between services
2. **Event-Driven**: WebSocket events for real-time updates
3. **File-Based Config**: JSON files for configuration persistence
4. **In-Memory Storage**: Arrays and Maps for runtime data

---

## Frontend Architecture

### Component Hierarchy

```
App.jsx
├── ApiKeyConfig (Modal)
├── EmailConfig (Modal)
├── UploadSection
│   └── File input, Context toggle
├── DataSection
│   └── ScreenshotItem[] (for each processed item)
└── Transcriber
    ├── FileUploadTranscribe
    └── LiveStreamingTranscribe
        └── useWebSocket hook
```

### State Management

- **Local State**: React `useState` hooks in components
- **Shared State**: Props drilling from `App.jsx`
- **Real-time Updates**: WebSocket events update state
- **Configuration**: API calls to backend, stored in component state

### API Service Layer

**Location**: `frontend/src/services/api.js`

**Methods**:
```javascript
- uploadImage(formData)
- getProcessedData()
- getContextState()
- updateContextState(enabled)
- processClipboard(content)
- getApiKeysConfig()
- saveApiKeysConfig(config)
- getEmailConfig()
- saveEmailConfig(config)
- processTranscription(sessionId, cutoffTimestamp)
- getTranscription(sessionId)
```

### WebSocket Hook

**Location**: `frontend/src/hooks/useWebSocket.js`

**Returns**:
```javascript
{
  connected: boolean,
  streaming: boolean,
  startStream: () => void,
  sendAudioChunk: (audioChunk) => void,
  endStream: () => void,
  flushBuffer: (cutoffTimestamp, gracePeriodMs) => void,
  getSessionId: () => string | null
}
```

---

## Configuration Management

### Configuration Files

1. **API Keys**: `backend/config/api-keys.json`
   ```json
   {
     "keys": {
       "openai": "sk-...",
       "groq": "gsk_...",
       "gemini": "AIza..."
     },
     "order": ["openai", "groq", "gemini"],
     "enabled": ["openai", "groq"]
   }
   ```

2. **Email Config**: `backend/config/email-config.json`
   ```json
   {
     "enabled": true,
     "email": "user@example.com"
   }
   ```

3. **Environment Variables**: `.env`
   ```env
   PORT=4000
   HTTPS_PORT=8443
   SCREENSHOTS_PATH=/path/to/screenshots
   PYTHON_SERVICE_URL=http://localhost:8000
   PYTHON_SERVICE_WS_URL=ws://localhost:8000
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   EMAIL_FROM=your-email@gmail.com
   LOG_LEVEL=INFO
   ```

### Configuration Loading

- **Backend**: Loaded on service initialization, reloaded on config save
- **Frontend**: Fetched on component mount, cached in component state
- **Python Service**: Environment variables and command-line arguments

---

## Error Handling

### Backend Error Handling

1. **Middleware**: `error.middleware.js` catches all errors
2. **Controller Level**: Try-catch blocks in controllers
3. **Service Level**: Errors propagate to controllers
4. **AI Service**: Fallback mechanism for provider failures

**Error Response Format**:
```javascript
{
  success: false,
  error: "Error message",
  details: "Additional error details" // Optional
}
```

### Frontend Error Handling

1. **API Calls**: Try-catch blocks with user-friendly error messages
2. **WebSocket**: Error event handlers
3. **User Feedback**: Alert dialogs and status messages
4. **Silent Failures**: Non-critical errors logged to console

### Common Error Scenarios

1. **File Upload Errors**:
   - Invalid file type → 400 Bad Request
   - File too large → 400 Bad Request
   - Processing failure → 500 Internal Server Error

2. **AI Service Errors**:
   - Invalid API key → Provider marked as failed, fallback to next
   - Rate limit → Provider marked as failed, fallback to next
   - All providers fail → 500 Internal Server Error

3. **WebSocket Errors**:
   - Connection failure → Automatic reconnection
   - Session timeout → New session created
   - Python service unavailable → Error event emitted

---

## Development Workflow

### Starting the Application

1. **Install Dependencies**:
   ```bash
   npm run install:all
   ```

2. **Start All Services**:
   ```bash
   npm run start:all
   ```
   This starts:
   - Python service (port 8000)
   - Backend server (port 4000)
   - Frontend dev server (port 3000)
   - Electron keyboard listener (optional)

3. **Access Application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000
   - Python Service: http://localhost:8000

### Development Commands

```bash
# Backend only
npm run dev

# Frontend only
npm run dev:frontend

# Python service only
npm run dev:python

# Build frontend
npm run build
```

### Code Structure Guidelines

1. **Controllers**: Handle HTTP requests/responses, minimal logic
2. **Services**: Business logic, data processing
3. **Routes**: Define endpoints, delegate to controllers
4. **Middleware**: Request processing, validation, error handling
5. **Sockets**: WebSocket event handling

### Adding New Features

1. **New API Endpoint**:
   - Add route in `backend/src/routes/`
   - Create controller in `backend/src/controllers/`
   - Add service method if needed
   - Update frontend API service

2. **New WebSocket Event**:
   - Add handler in socket handler file
   - Update frontend WebSocket hook
   - Document event payload

3. **New AI Provider**:
   - Add SDK to `ai.service.js`
   - Implement provider method
   - Add to configuration schema
   - Update frontend config UI

### Testing

- **Manual Testing**: Use browser dev tools and Postman
- **Logging**: Check console logs and backend logs
- **WebSocket Testing**: Use browser WebSocket inspector
- **Error Testing**: Test error scenarios and fallbacks

---

## Additional Resources

### Key Files Reference

**Backend**:
- `backend/src/server.js` - Server initialization
- `backend/src/app.js` - Express app setup
- `backend/src/config/constants.js` - Configuration constants

**Frontend**:
- `frontend/src/App.jsx` - Main application
- `frontend/src/services/api.js` - API client
- `frontend/src/hooks/useWebSocket.js` - WebSocket hook

**Python Service**:
- `python-service/app.py` - FastAPI application
- `python-service/streaming.py` - WebSocket streaming
- `python-service/transcription.py` - Transcription logic

### External Dependencies

- **Socket.io**: WebSocket library
- **Multer**: File upload middleware
- **Tesseract.js**: OCR library
- **mlx-whisper**: Whisper model for Apple Silicon
- **OpenAI SDK**: OpenAI API client
- **Groq SDK**: Groq API client
- **Google Generative AI**: Gemini API client

---

## Troubleshooting Guide

### Common Issues

1. **WebSocket Connection Fails**:
   - Check server is running
   - Verify CORS settings
   - Check firewall/network settings

2. **AI Provider Errors**:
   - Verify API keys are correct
   - Check API quotas/limits
   - Review provider status

3. **File Upload Fails**:
   - Check file size limits
   - Verify file type is allowed
   - Check disk space

4. **Transcription Not Working**:
   - Verify Python service is running
   - Check microphone permissions
   - Verify WebSocket connection

---

## Version History

- **v2.0.0**: Current version with multi-provider AI, WebSocket updates, transcription support

---

**Last Updated**: December 2024
**Maintained By**: Development Team

