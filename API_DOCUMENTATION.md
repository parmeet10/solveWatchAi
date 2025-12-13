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

Emitted when client connects. Contains session ID.

```javascript
socket.on('session_started', (data) => {
  console.log('Session ID:', data.sessionId);
});
```

**Payload**:

```json
{
  "sessionId": "abc-123-def-456"
}
```

**`questions_extracted`**

Emitted when questions are extracted from text.

```javascript
socket.on('questions_extracted', (data) => {
  console.log('Session:', data.sessionId);
  console.log('Questions:', data.questions);
});
```

**Payload**:

```json
{
  "sessionId": "abc-123-def-456",
  "questions": [
    {
      "question": "what is react hooks",
      "confidence": 0.9
    }
  ]
}
```

**`error`**

Emitted on errors.

```javascript
socket.on('error', (data) => {
  console.error('Error:', data.message);
});
```

**Payload**:

```json
{
  "message": "Error description"
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

**`data_update`**

Emitted when processed data changes (new image processed, question answered, etc.).

```javascript
socket.on('data_update', (payload) => {
  if (payload.type === 'initial') {
    // Initial data on connection
    console.log('All data:', payload.data);
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
  ]
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
  }
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
});

// Handle extracted questions
socket.on('questions_extracted', (data) => {
  console.log('Questions found:', data.questions);
  data.questions.forEach((q) => {
    console.log(`- ${q.question} (confidence: ${q.confidence})`);
  });
});

// Handle errors
socket.on('error', (data) => {
  console.error('Error:', data.message);
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

socket.on('data_update', (payload) => {
  if (payload.type === 'initial') {
    // Load all data on connection
    displayData(payload.data);
  } else if (payload.type === 'update') {
    // Add new item to UI
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

## Notes

- All timestamps are in ISO 8601 format or Unix milliseconds
- Session IDs are UUIDs (v4)
- File uploads are limited to 10MB
- Supported image formats: JPEG, PNG, GIF, BMP, WEBP
- WebSocket connections use Socket.io protocol
- CORS is enabled for all origins

---

## Support

For issues or questions, check the backend logs or refer to the source code in `backend/src/`.
