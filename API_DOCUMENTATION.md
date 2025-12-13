# Backend API Documentation

Complete API documentation for SolveWatchAI backend services, REST endpoints, and WebSocket connections.

---

## Table of Contents

1. [Base Information](#base-information)
2. [REST API Endpoints](#rest-api-endpoints)
3. [WebSocket Connections](#websocket-connections)
4. [Backend Services](#backend-services)
5. [Error Handling](#error-handling)
6. [Examples](#examples)

---

## Base Information

### Server Configuration

- **Base URL**: `http://localhost:4000`
- **API Prefix**: `/api`
- **WebSocket Port**: `4000` (same as HTTP)
- **Protocol**: HTTP (WebSocket over HTTP)

### Content Types

- **Request**: `application/json` (except file uploads)
- **Response**: `application/json`

### CORS

- All origins allowed: `*`
- Methods: `GET`, `POST`
- Credentials: `true`

---

## REST API Endpoints

### Image Processing

#### Upload Image

Upload an image file for OCR and AI processing.

**Endpoint**: `POST /api/upload`

**Content-Type**: `multipart/form-data`

**Request**:

```
Form Data:
  - image: File (required)
```

**Response** (200 OK):

```json
{
  "success": true,
  "filename": "screenshot_1234567890.png",
  "extractedText": "Text extracted from image via OCR",
  "gptResponse": "AI-generated response based on the extracted text",
  "timestamp": "2024-01-15 10:30:00",
  "usedContext": false
}
```

**Error Response** (400/500):

```json
{
  "success": false,
  "error": "Error message"
}
```

---

#### Get Processed Data

Retrieve all processed data (images, questions, etc.).

**Endpoint**: `GET /api/data`

**Response** (200 OK):

```json
[
  {
    "filename": "screenshot_1234567890.png",
    "timestamp": "2024-01-15 10:30:00",
    "extractedText": "Text from image",
    "gptResponse": "AI response preview...",
    "usedContext": false,
    "type": "image"
  },
  {
    "filename": "question-abc123",
    "timestamp": "2024-01-15 10:35:00",
    "extractedText": "What is React?",
    "gptResponse": "React is a JavaScript library...",
    "usedContext": false,
    "type": "question"
  }
]
```

---

### Question Processing

#### Process Latest Question

Process the latest question from a session using AI.

**Endpoint**: `POST /api/question/process`

**Request Body** (optional):

```json
{
  "sessionId": "abc-123-def-456" // Optional: if not provided, uses latest active session
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "filename": "question-abc123",
    "timestamp": "2024-01-15 10:35:00",
    "extractedText": "What is React?",
    "gptResponse": "React is a JavaScript library for building user interfaces...",
    "usedContext": false,
    "type": "question"
  },
  "question": "What is React?",
  "fullResponse": "React is a JavaScript library for building user interfaces. It was developed by Facebook and is widely used for creating interactive web applications..."
}
```

**Error Response** (400):

```json
{
  "success": false,
  "error": "No active question session found"
}
```

**Error Response** (400):

```json
{
  "success": false,
  "error": "No question found for this session"
}
```

---

#### Get Latest Active Session

Get the latest active session ID that has questions.

**Endpoint**: `GET /api/question/latest-session`

**Response** (200 OK):

```json
{
  "success": true,
  "sessionId": "abc-123-def-456"
}
```

**Response** (200 OK, no session):

```json
{
  "success": false,
  "sessionId": null
}
```

---

#### Get Questions for Session

Get all questions for a specific session.

**Endpoint**: `GET /api/question/:sessionId`

**URL Parameters**:

- `sessionId` (string, required): Session UUID

**Response** (200 OK):

```json
{
  "success": true,
  "sessionId": "abc-123-def-456",
  "latestQuestion": {
    "question": "What is React?",
    "type": "technical",
    "confidence": 0.9,
    "timestamp": "2024-01-15T10:35:00.000Z"
  },
  "allQuestions": [
    {
      "question": "What is React?",
      "type": "technical",
      "confidence": 0.9,
      "timestamp": "2024-01-15T10:35:00.000Z"
    },
    {
      "question": "How do I use hooks?",
      "type": "technical",
      "confidence": 0.85,
      "timestamp": "2024-01-15T10:36:00.000Z"
    }
  ],
  "createdAt": "2024-01-15T10:30:00.000Z",
  "lastUpdated": "2024-01-15T10:36:00.000Z"
}
```

**Error Response** (404):

```json
{
  "success": false,
  "error": "Session not found"
}
```

---

### Configuration

#### Get API Keys Configuration

Retrieve current API keys configuration (keys are masked).

**Endpoint**: `GET /api/config/keys`

**Response** (200 OK):

```json
{
  "success": true,
  "config": {
    "keys": {
      "openai": "***",
      "groq": "***",
      "gemini": "***"
    },
    "enabled": ["openai", "groq"]
  }
}
```

---

#### Save API Keys Configuration

Save or update API keys configuration.

**Endpoint**: `POST /api/config/keys`

**Request Body**:

```json
{
  "keys": {
    "openai": "sk-...",
    "groq": "gsk_...",
    "gemini": "AI..."
  },
  "enabled": ["openai", "groq"]
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "message": "API keys saved successfully"
}
```

---

#### Get Email Configuration

Retrieve email notification configuration.

**Endpoint**: `GET /api/config/email`

**Response** (200 OK):

```json
{
  "success": true,
  "config": {
    "enabled": true,
    "email": "user@example.com"
  }
}
```

---

#### Save Email Configuration

Save or update email notification configuration.

**Endpoint**: `POST /api/config/email`

**Request Body**:

```json
{
  "enabled": true,
  "email": "user@example.com"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "message": "Email configuration saved successfully"
}
```

---

### Context Management

#### Get Context State

Check if context mode is enabled.

**Endpoint**: `GET /api/context-state`

**Response** (200 OK):

```json
{
  "success": true,
  "enabled": true
}
```

---

#### Update Context State

Enable or disable context mode.

**Endpoint**: `POST /api/context-state`

**Request Body**:

```json
{
  "enabled": true
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "enabled": true,
  "message": "Context state updated"
}
```

---

## WebSocket Connections

### Connection URLs

- **Text Stream (Mobile)**: `ws://localhost:4000/text-stream`
- **Data Updates (Frontend)**: `ws://localhost:4000/data-updates`

### Socket.io Configuration

- **Path**: `/socket.io`
- **Transport**: `websocket` only
- **Namespace Support**: Yes

---

### Text Stream Namespace (`/text-stream`)

For mobile apps to send text chunks from speech recognition.

#### Connection

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:4000/text-stream', {
  transports: ['websocket'],
  path: '/socket.io',
});
```

#### Events

##### Client → Server

**`text_chunk`**

Send a text chunk for processing.

```javascript
socket.emit('text_chunk', {
  text: 'what is react hooks', // Required: text string
  timestamp: 1705320000000, // Optional: Unix timestamp (ms), defaults to Date.now()
});
```

**Payload**:

```json
{
  "text": "what is react hooks",
  "timestamp": 1705320000000
}
```

##### Server → Client

**`session_started`**

Emitted when client connects. Contains session ID and connection details.

```javascript
socket.on('session_started', (data) => {
  console.log('Session ID:', data.sessionId);
  console.log('Connected at:', data.connectedAt);
  console.log('Message:', data.message);
});
```

**Payload**:

```json
{
  "sessionId": "abc-123-def-456",
  "connectedAt": "2024-01-15T10:30:00.000Z",
  "message": "Connected successfully. Ready to receive text chunks."
}
```

**`connection_status`**

Emitted when connection status changes (connected/disconnected).

```javascript
socket.on('connection_status', (data) => {
  console.log('Status:', data.status);
  console.log('Session ID:', data.sessionId);
});
```

**Payload** (connected):

```json
{
  "status": "connected",
  "sessionId": "abc-123-def-456",
  "timestamp": 1705320000000
}
```

**Payload** (disconnected):

```json
{
  "status": "disconnected",
  "sessionId": "abc-123-def-456",
  "reason": "client disconnect",
  "timestamp": 1705320000000
}
```

**`chunk_received`**

Emitted immediately when a text chunk is received and acknowledged. Provides full details about the received chunk.

```javascript
socket.on('chunk_received', (data) => {
  console.log('Chunk ID:', data.chunkId);
  console.log('Text:', data.text);
  console.log('Length:', data.textLength);
  console.log('Status:', data.status);
});
```

**Payload**:

```json
{
  "chunkId": "chunk-123",
  "sessionId": "abc-123-def-456",
  "text": "wat is reakt hooks",
  "textLength": 19,
  "textPreview": "wat is reakt hooks",
  "receivedAt": "2024-01-15T10:30:00.000Z",
  "timestamp": 1705320000000,
  "status": "received",
  "message": "Text chunk received and queued for processing"
}
```

**`text_chunk_status`**

Emitted to notify client about text chunk processing stages.

```javascript
socket.on('text_chunk_status', (data) => {
  console.log('Status:', data.status);
  console.log('Stage:', data.stage);
  console.log('Chunk ID:', data.chunkId);
});
```

**Payload** (processing):

```json
{
  "status": "processing",
  "chunkId": "chunk-123",
  "stage": "received|refining|extracting_questions|completed",
  "timestamp": 1705320000000
}
```

**Payload** (completed):

```json
{
  "status": "completed",
  "chunkId": "chunk-123",
  "stage": "completed",
  "questionsExtracted": 2,
  "timestamp": 1705320000000
}
```

**Payload** (error):

```json
{
  "status": "error",
  "chunkId": "chunk-123",
  "error": "Error message",
  "timestamp": 1705320000000
}
```

**`chunk_processing_complete`**

Emitted when text chunk processing is fully completed (success or error). Provides comprehensive summary of the entire processing pipeline.

```javascript
socket.on('chunk_processing_complete', (data) => {
  console.log('Status:', data.status);
  console.log('Duration:', data.durationMs, 'ms');
  console.log('Questions extracted:', data.summary.questionsExtracted);
  console.log('Message:', data.message);
});
```

**Payload** (success):

```json
{
  "chunkId": "chunk-123",
  "sessionId": "abc-123-def-456",
  "status": "completed",
  "completedAt": "2024-01-15T10:30:05.000Z",
  "duration": 5234,
  "durationMs": 5234,
  "summary": {
    "originalText": "wat is reakt hooks",
    "originalLength": 19,
    "refinedText": "what is react hooks",
    "refinedLength": 20,
    "questionsExtracted": 1,
    "questions": [
      {
        "question": "what is react hooks",
        "type": "technical",
        "confidence": 0.9
      }
    ],
    "totalQuestionsInSession": 3
  },
  "stages": {
    "received": true,
    "refined": true,
    "questionsExtracted": true,
    "stored": true
  },
  "message": "Processing completed. 1 question(s) extracted and stored."
}
```

**Payload** (error):

```json
{
  "chunkId": "chunk-123",
  "sessionId": "abc-123-def-456",
  "status": "error",
  "completedAt": "2024-01-15T10:30:02.000Z",
  "duration": 1234,
  "durationMs": 1234,
  "error": {
    "message": "AI service unavailable",
    "code": "PROCESSING_ERROR"
  },
  "message": "Processing failed. Please try again."
}
```

**`text_refined`**

Emitted when text refinement is completed. Contains original and refined text.

```javascript
socket.on('text_refined', (data) => {
  console.log('Original:', data.originalText);
  console.log('Refined:', data.refinedText);
});
```

**Payload**:

```json
{
  "chunkId": "chunk-123",
  "originalText": "wat is reakt hooks",
  "refinedText": "what is react hooks",
  "timestamp": 1705320000000
}
```

**`questions_extracted`**

Emitted when questions are extracted from text.

```javascript
socket.on('questions_extracted', (data) => {
  console.log('Session:', data.sessionId);
  console.log('Chunk ID:', data.chunkId);
  console.log('Questions:', data.questions);
  console.log('Total in session:', data.totalQuestionsInSession);
});
```

**Payload**:

```json
{
  "sessionId": "abc-123-def-456",
  "chunkId": "chunk-123",
  "questions": [
    {
      "question": "what is react hooks",
      "confidence": 0.9,
      "type": "technical"
    }
  ],
  "totalQuestionsInSession": 3,
  "timestamp": 1705320000000
}
```

**`error`**

Emitted on errors.

```javascript
socket.on('error', (data) => {
  console.error('Error:', data.message);
  console.error('Chunk ID:', data.chunkId);
});
```

**Payload**:

```json
{
  "message": "Error description",
  "chunkId": "chunk-123",
  "timestamp": 1705320000000
}
```

---

### Data Updates Namespace (`/data-updates`)

For frontend clients to receive real-time data updates.

#### Connection

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:4000/data-updates', {
  transports: ['websocket', 'polling'],
  path: '/socket.io',
});
```

#### Events

##### Server → Client

**`screenshot_captured`**

Emitted when a new screenshot is detected and captured.

```javascript
socket.on('screenshot_captured', (data) => {
  console.log('📸 Screenshot captured:', data.filename);
  console.log('Path:', data.filePath);
});
```

**Payload**:

```json
{
  "filename": "screenshot_123.png",
  "filePath": "/path/to/screenshot_123.png",
  "capturedAt": "2024-01-15T10:30:00.000Z",
  "timestamp": 1705320000000,
  "status": "captured",
  "message": "Screenshot captured: screenshot_123.png"
}
```

**`ocr_started`**

Emitted when OCR processing begins for a screenshot.

```javascript
socket.on('ocr_started', (data) => {
  console.log('🔍 OCR started for:', data.filename);
});
```

**Payload**:

```json
{
  "filename": "screenshot_123.png",
  "filePath": "/path/to/screenshot_123.png",
  "startedAt": "2024-01-15T10:30:01.000Z",
  "timestamp": 1705320001000,
  "status": "processing",
  "stage": "ocr",
  "message": "OCR processing started for: screenshot_123.png"
}
```

**`ocr_complete`**

Emitted when OCR processing completes. Contains extracted text details.

```javascript
socket.on('ocr_complete', (data) => {
  console.log('✅ OCR complete:', data.filename);
  console.log('Text length:', data.extractedTextLength);
  console.log('Duration:', data.durationMs, 'ms');
  console.log('Preview:', data.textPreview);
});
```

**Payload**:

```json
{
  "filename": "screenshot_123.png",
  "extractedText": "function example() { return 'hello'; }",
  "extractedTextLength": 38,
  "textPreview": "function example() { return 'hello'; }",
  "completedAt": "2024-01-15T10:30:02.500Z",
  "timestamp": 1705320002500,
  "duration": 1500,
  "durationMs": 1500,
  "status": "completed",
  "stage": "ocr",
  "message": "OCR completed for: screenshot_123.png (38 chars in 1500ms)"
}
```

**`ai_processing_started`**

Emitted when AI processing begins for extracted text.

```javascript
socket.on('ai_processing_started', (data) => {
  console.log('🤖 AI processing started:', data.filename);
  console.log('Using context:', data.useContext);
});
```

**Payload**:

```json
{
  "filename": "screenshot_123.png",
  "extractedTextLength": 38,
  "useContext": false,
  "startedAt": "2024-01-15T10:30:02.600Z",
  "timestamp": 1705320002600,
  "status": "processing",
  "stage": "ai",
  "message": "AI processing started for: screenshot_123.png"
}
```

**`ai_processing_complete`**

Emitted when AI processing completes. Contains only the AI response (simplified format).

```javascript
socket.on('ai_processing_complete', (data) => {
  console.log('✅ AI response received');
  console.log('Response:', data.response);
  // Use the response directly
});
```

**Payload**:

```json
{
  "response": "This is a JavaScript function that returns the string 'hello'. It uses the function keyword to define a named function that can be called later. When invoked, it will return the string literal 'hello'."
}
```

**Note**: Detailed information (provider, duration, filename, etc.) is logged in the server terminal but not sent to the client. Only the AI response is emitted for simplicity.

**`processing_error`**

Emitted when an error occurs during any processing stage.

```javascript
socket.on('processing_error', (data) => {
  console.error('❌ Error during', data.stage, ':', data.filename);
  console.error('Error:', data.error.message);
});
```

**Payload**:

```json
{
  "filename": "screenshot_123.png",
  "stage": "ocr",
  "error": {
    "message": "Failed to extract text from image",
    "code": "PROCESSING_ERROR"
  },
  "occurredAt": "2024-01-15T10:30:02.000Z",
  "timestamp": 1705320002000,
  "status": "error",
  "message": "Error during ocr processing for: screenshot_123.png"
}
```

**`data_update`**

Emitted when processed data changes (new image processed, question answered, etc.).

```javascript
socket.on('data_update', (payload) => {
  if (payload.type === 'initial') {
    // Initial data on connection
    console.log('All data:', payload.data);
    console.log('Data count:', payload.data.length);
  } else if (payload.type === 'update') {
    // New item added
    console.log('New item:', payload.newItem);
    console.log('All data:', payload.data);
  }
});
```

**Payload** (`type: 'initial'`):

```json
{
  "type": "initial",
  "data": [
    {
      "filename": "screenshot_123.png",
      "timestamp": "2024-01-15 10:30:00",
      "extractedText": "...",
      "gptResponse": "...",
      "usedContext": false,
      "type": "image"
    }
  ],
  "timestamp": 1705320000000
}
```

**Payload** (`type: 'update'`):

```json
{
  "type": "update",
  "data": [...],  // All processed data
  "newItem": {
    "filename": "question-abc123",
    "timestamp": "2024-01-15 10:35:00",
    "extractedText": "What is React?",
    "gptResponse": "...",
    "usedContext": false,
    "type": "question"
  },
  "timestamp": 1705320000000
}
```

**`connection_status`**

Emitted when connection status changes (connected/disconnected).

```javascript
socket.on('connection_status', (data) => {
  console.log('Status:', data.status);
  console.log('Socket ID:', data.socketId);
  console.log('Data count:', data.dataCount);
});
```

**Payload** (connected):

```json
{
  "status": "connected",
  "socketId": "socket-123",
  "dataCount": 5,
  "timestamp": 1705320000000
}
```

**Payload** (disconnected):

```json
{
  "status": "disconnected",
  "socketId": "socket-123",
  "reason": "client disconnect",
  "timestamp": 1705320000000
}
```

---

## Backend Services

### Service Architecture

The backend uses a service-oriented architecture with the following services:

1. **Text Refinement Service** (`text-refinement.service.js`)
2. **Question Extraction Service** (`question-extraction.service.js`)
3. **Question Storage Service** (`question-storage.service.js`)
4. **Image Processing Service** (`image-processing.service.js`)
5. **AI Service** (`ai.service.js`)
6. **OCR Service** (`ocr.service.js`)
7. **Screenshot Monitor Service** (`screenshot-monitor.service.js`)
8. **Email Service** (`email.service.js`)

---

### Text Refinement Service

Refines speech-to-text output to fix errors and improve accuracy.

**Location**: `backend/src/services/text-refinement.service.js`

**Methods**:

- `refineTextChunk(rawText: string): Promise<string>`
  - Refines raw text from speech recognition
  - Returns corrected text
  - Uses AI models for correction

**Usage**:

```javascript
import textRefinementService from './services/text-refinement.service.js';

const refined = await textRefinementService.refineTextChunk('wat is reakt');
// Returns: "what is react"
```

---

### Question Extraction Service

Extracts technical questions from refined text.

**Location**: `backend/src/services/question-extraction.service.js`

**Methods**:

- `extractQuestions(refinedText: string, sessionId: string): Promise<Array>`
  - Extracts technical questions from text
  - Returns array of question objects
  - Falls back to regex if AI parsing fails

**Usage**:

```javascript
import questionExtractionService from './services/question-extraction.service.js';

const questions = await questionExtractionService.extractQuestions(
  'what is react hooks how do I use them',
  'session-123',
);
// Returns: [
//   { question: "what is react hooks", type: "technical", confidence: 0.9 },
//   { question: "how do I use them", type: "technical", confidence: 0.85 }
// ]
```

---

### Question Storage Service

Manages storage and retrieval of extracted questions.

**Location**: `backend/src/services/question-storage.service.js`

**Methods**:

- `addQuestions(sessionId: string, questions: Array, timestamp?: number): void`

  - Stores questions for a session

- `getLatestQuestion(sessionId: string): Object | null`

  - Gets the latest question for a session

- `getLatestActiveSession(): string | null`

  - Gets the latest active session ID

- `clearSession(sessionId: string): void`

  - Clears all questions for a session

- `getActiveSessions(): Array<string>`
  - Gets all active session IDs

**Usage**:

```javascript
import questionStorageService from './services/question-storage.service.js';

questionStorageService.addQuestions(
  'session-123',
  [{ question: 'What is React?', type: 'technical', confidence: 0.9 }],
  Date.now(),
);

const latest = questionStorageService.getLatestQuestion('session-123');
const latestSession = questionStorageService.getLatestActiveSession();
```

---

### Image Processing Service

Processes images via OCR and AI.

**Location**: `backend/src/services/image-processing.service.js`

**Methods**:

- `processImage(filePath: string): Promise<Object>`

  - Processes image file
  - Returns extracted text and AI response

- `getProcessedData(): Array`

  - Gets all processed data entries

- `addProcessedData(entry: Object): void`

  - Adds a processed data entry

- `setDataHandlers(handlers: Array): void`
  - Sets WebSocket data handlers for real-time updates

**Usage**:

```javascript
import imageProcessingService from './services/image-processing.service.js';

const result = await imageProcessingService.processImage('/path/to/image.png');
const allData = imageProcessingService.getProcessedData();
```

---

### AI Service

Manages AI model interactions with fallback support.

**Location**: `backend/src/services/ai.service.js`

**Supported Providers**:

- OpenAI (GPT models)
- Groq (Llama models)
- Google Gemini

**Methods**:

- `callAIWithFallback(messages: Array, options?: Object): Promise<Object>`

  - Calls AI with automatic fallback if primary provider fails
  - Returns AI response

- `askGptQuestion(question: string): Promise<Object>`

  - Answers a technical question using AI

- `askGpt(text: string): Promise<Object>`

  - Processes text from screenshots

- `askGptWithContext(text: string, previousResponse: string): Promise<Object>`
  - Processes text with context from previous response

**Usage**:

```javascript
import aiService from './services/ai.service.js';

const response = await aiService.askGptQuestion('What is React?');
console.log(response.message.content);
```

---

### OCR Service

Extracts text from images using Tesseract.js.

**Location**: `backend/src/services/ocr.service.js`

**Methods**:

- `extractText(imagePath: string): Promise<string>`
  - Extracts text from image file
  - Returns extracted text string

**Usage**:

```javascript
import ocrService from './services/ocr.service.js';

const text = await ocrService.extractText('/path/to/image.png');
```

---

## Error Handling

### HTTP Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details (optional)"
}
```

### Status Codes

- `200 OK` - Success
- `400 Bad Request` - Invalid request data
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

### WebSocket Errors

Errors are emitted via `error` event:

```javascript
socket.on('error', (data) => {
  console.error(data.message);
});
```

---

## Examples

### Complete Mobile App Integration

```javascript
import io from 'socket.io-client';

// Connect to text stream
const socket = io('http://192.168.1.100:4000/text-stream', {
  transports: ['websocket'],
});

let sessionId = null;

// Handle session start
socket.on('session_started', (data) => {
  sessionId = data.sessionId;
  console.log('Connected, session:', sessionId);
  console.log('Connected at:', data.connectedAt);
});

// Handle connection status
socket.on('connection_status', (data) => {
  console.log('Connection status:', data.status);
  if (data.status === 'disconnected') {
    console.log('Disconnected reason:', data.reason);
  }
});

// Handle chunk received acknowledgment
socket.on('chunk_received', (data) => {
  console.log('✅ Chunk received:', data.chunkId);
  console.log('Text:', data.text);
  console.log('Length:', data.textLength);
});

// Handle text chunk processing status
socket.on('text_chunk_status', (data) => {
  console.log(`Chunk ${data.chunkId}: ${data.status} - ${data.stage}`);
  if (data.status === 'completed') {
    console.log(`Questions extracted: ${data.questionsExtracted}`);
  }
});

// Handle chunk processing completion
socket.on('chunk_processing_complete', (data) => {
  console.log('✅ Processing complete:', data.status);
  console.log('Duration:', data.durationMs, 'ms');
  if (data.status === 'completed') {
    console.log('Questions:', data.summary.questionsExtracted);
    console.log('Message:', data.message);
  } else if (data.status === 'error') {
    console.error('Error:', data.error.message);
  }
});

// Handle text refinement
socket.on('text_refined', (data) => {
  console.log('Original:', data.originalText);
  console.log('Refined:', data.refinedText);
});

// Handle extracted questions
socket.on('questions_extracted', (data) => {
  console.log('Questions found:', data.questions);
  console.log('Total questions in session:', data.totalQuestionsInSession);
  data.questions.forEach((q) => {
    console.log(
      `- ${q.question} (confidence: ${q.confidence}, type: ${q.type})`,
    );
  });
});

// Handle errors
socket.on('error', (data) => {
  console.error('Error:', data.message);
  if (data.chunkId) {
    console.error('Chunk ID:', data.chunkId);
  }
});

// Send text chunk when speech recognition outputs text
function sendTextChunk(text) {
  socket.emit('text_chunk', {
    text: text,
    timestamp: Date.now(),
  });
}

// Example: Send text from speech recognition
sendTextChunk('what is react hooks');
```

### Process Question with REST API

```javascript
// 1. Get latest session
const sessionResponse = await fetch(
  'http://localhost:4000/api/question/latest-session',
);
const { sessionId } = await sessionResponse.json();

// 2. Process question
const processResponse = await fetch(
  'http://localhost:4000/api/question/process',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  },
);

const result = await processResponse.json();
console.log('Question:', result.question);
console.log('Answer:', result.fullResponse);
```

### Upload and Process Image

```javascript
const formData = new FormData();
formData.append('image', fileInput.files[0]);

const response = await fetch('http://localhost:4000/api/upload', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
console.log('Extracted text:', result.extractedText);
console.log('AI response:', result.gptResponse);
```

### Real-time Data Updates (Frontend)

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:4000/data-updates', {
  transports: ['websocket', 'polling'],
});

// Handle connection status
socket.on('connection_status', (data) => {
  console.log('Connection status:', data.status);
  if (data.status === 'connected') {
    console.log('Initial data count:', data.dataCount);
  }
});

// Handle screenshot processing events
socket.on('screenshot_captured', (data) => {
  console.log('📸 Screenshot captured:', data.filename);
  // Update UI: Show "Screenshot detected"
});

socket.on('ocr_started', (data) => {
  console.log('🔍 OCR started:', data.filename);
  // Update UI: Show "Extracting text..."
});

socket.on('ocr_complete', (data) => {
  console.log('✅ OCR complete:', data.filename);
  console.log('Text length:', data.extractedTextLength);
  console.log('Duration:', data.durationMs, 'ms');
  // Update UI: Show "Text extracted"
});

socket.on('ai_processing_started', (data) => {
  console.log('🤖 AI processing started:', data.filename);
  console.log('Using context:', data.useContext);
  // Update UI: Show "Analyzing with AI..."
});

socket.on('ai_processing_complete', (data) => {
  console.log('✅ AI response received');
  console.log('Response:', data.response);
  // Update UI: Show AI response
  displayAIResponse(data.response);
});

socket.on('processing_error', (data) => {
  console.error('❌ Error:', data.stage, '-', data.filename);
  console.error('Error:', data.error.message);
  // Update UI: Show error message
});

socket.on('data_update', (payload) => {
  if (payload.type === 'initial') {
    // Load all data on connection
    console.log('Received initial data:', payload.data.length, 'items');
    displayData(payload.data);
  } else if (payload.type === 'update') {
    // Add new item to UI
    console.log('New item received:', payload.newItem);
    addDataItem(payload.newItem);
    updateDataList(payload.data);
  }
});
```

---

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
PORT=4000
SCREENSHOTS_PATH=/path/to/screenshots
LOG_LEVEL=INFO
```

### API Keys Configuration

API keys are stored in `backend/config/api-keys.json`:

```json
{
  "keys": {
    "openai": "sk-...",
    "groq": "gsk_...",
    "gemini": "AI..."
  },
  "enabled": ["openai", "groq"]
}
```

---

## Logging

The backend implements production-level logging for all socket operations and data processing. All logs include structured data with timestamps, session IDs, and relevant context.

### Log Levels

- **ERROR**: Critical errors that need immediate attention
- **WARN**: Warning messages for non-critical issues
- **INFO**: Important operational information (connections, processing stages, completions)
- **DEBUG**: Detailed debugging information

### Logged Events

#### Socket Connections

- Client connections with session ID, socket ID, IP address, and timestamp
- Client disconnections with reason and duration
- Connection status changes

#### Text Processing

- Text chunk reception with length and preview
- Text refinement requests sent to AI (original text, prompt details)
- AI responses received (refined text, provider, duration)
- Question extraction results
- Question storage operations (questions stored, session details)

#### Question Processing (Cmd+Shift+P)

- Question processing initiation
- Question sent to AI service
- AI response received (answer, provider, length)
- Processing completion with full question and answer

#### Data Updates

- Data change events
- Broadcast operations to connected clients
- Initial data sent to new connections

### Log Format

All logs follow this structure:

```
[timestamp] [LEVEL] [Module] message {structured_data}
```

Example:

```
[2024-01-15T10:30:00.000Z] [INFO] [TextStreamHandler] Client connected to text-stream {"sessionId":"abc-123","socketId":"socket-456","connectedAt":"2024-01-15T10:30:00.000Z","ip":"::1"}
```

### Viewing Logs

Logs are output to the console. Set `LOG_LEVEL` environment variable to control verbosity:

- `ERROR`: Only errors
- `WARN`: Warnings and errors
- `INFO`: Info, warnings, and errors (default)
- `DEBUG`: All logs including debug messages

---

## Notes

- All timestamps are in ISO 8601 format or Unix milliseconds
- Session IDs are UUIDs (v4)
- File uploads are limited to 10MB
- Supported image formats: JPEG, PNG, GIF, BMP, WEBP
- WebSocket connections use Socket.io protocol
- CORS is enabled for all origins
- All socket events include timestamps for client-side tracking
- Production-level logging is enabled for all operations

---

## Support

For issues or questions, check the backend logs or refer to the source code in `backend/src/`.
