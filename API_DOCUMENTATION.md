# API Documentation

## Base URL

- **HTTP**: `http://localhost:4000`
- **WebSocket**: `ws://localhost:4000/data-updates`

---

## REST API

### Configuration

#### `GET /api/config/keys`
Get API keys configuration (keys masked as `"***"`).

**Response:**
```json
{
  "success": true,
  "config": {
    "keys": { "openai": "***", "grok": "***", "gemini": "***" },
    "order": ["openai", "grok", "gemini"],
    "enabled": ["openai", "grok"]
  }
}
```

#### `POST /api/config/keys`
Save API keys configuration. Masked values (`"***"`) are ignored.

**Request:**
```json
{
  "keys": { "openai": "sk-...", "grok": "gsk_..." },
  "order": ["openai", "grok"],
  "enabled": ["openai", "grok"]
}
```

**Status:** `200` Success | `400` Bad Request | `500` Server Error

---

### Context State

#### `GET /api/context-state`
Get context usage state.

**Response:**
```json
{ "useContextEnabled": false }
```

#### `POST /api/context-state`
Update context usage state.

**Request:**
```json
{ "enabled": true }
```

**Status:** `200` Success | `400` Bad Request | `500` Server Error

---

### Image Processing

#### `POST /api/upload`
Upload and process image (OCR + AI analysis).

**Content-Type:** `multipart/form-data`

**Request:** Form field `image` (file, max 10MB, formats: JPEG, PNG, GIF, BMP, WEBP)

**Response:**
```json
{
  "success": true,
  "message": "Image processed successfully",
  "filename": "screenshot.png",
  "extractedText": "Preview...",
  "gptResponse": "AI analysis...",
  "usedContext": false
}
```

**Status:** `200` Success | `400` Bad Request | `500` Server Error

**Note:** File deleted after processing.

#### `GET /api/data`
Get all processed data (images + transcriptions).

**Response:**
```json
[
  {
    "filename": "screenshot.png",
    "timestamp": "12/25/2024, 10:30:45 AM",
    "extractedText": "Text...",
    "gptResponse": "Response...",
    "usedContext": false,
    "type": "image" // or "transcription"
  }
]
```

---

## WebSocket API

### Connection

**Namespace:** `/data-updates`  
**Transport:** WebSocket only

```javascript
const socket = io('http://localhost:4000/data-updates', {
  transports: ['websocket']
});
```

---

### Client → Server Events

#### `transcription`
Send audio transcription text chunk.

**Payload:**
```json
{ "textChunk": "The interviewer is asking..." }
```

**Behavior:** Chunks accumulated per connection. Send multiple chunks before processing.

#### `process_transcription`
Process all accumulated transcription chunks.

**Payload:** None

**Flow:** Combines chunks → AI processing → Returns answer with `messageId`

#### `use_prompt`
Process a previous AI response with a different prompt type.

**Payload:**
```json
{
  "promptType": "debug" | "theory" | "coding",
  "messageId": "msg-123...",
  "screenshotRequired": false
}
```

**Behavior:**
- If `screenshotRequired: true`, waits for next screenshot upload
- If `screenshotRequired: false`, processes immediately
- Generates new `messageId` for the response

---

### Server → Client Events

#### `connected`
Emitted on connection.

**Payload:**
```json
{
  "socketId": "abc123",
  "connectedAt": "2024-12-25T10:30:45.123Z",
  "timestamp": 1703502645123
}
```

#### `screenshot_captured`
Screenshot captured and ready for processing.

**Payload:**
```json
{ "message": "Screenshot captured: screenshot.png" }
```

#### `ocr_started`
OCR processing started.

**Payload:**
```json
{ "message": "OCR started" }
```

#### `ocr_complete`
OCR processing completed.

**Payload:**
```json
{ "message": "OCR completed" }
```

#### `ai_processing_started`
AI processing started.

**Payload:**
```json
{ "message": "AI processing started" }
```

#### `ai_processing_complete`
AI processing completed.

**Payload:**
```json
{
  "response": "AI-generated response...",
  "message": "AI processing completed",
  "messageId": "msg-123..." // Present for transcription and use_prompt flows
}
```

#### `use_prompt_set`
Prompt type set (waiting or processing).

**Payload:**
```json
{
  "promptType": "debug",
  "messageId": "msg-123...",
  "screenshotRequired": true,
  "message": "Waiting for screenshot...",
  "timestamp": 1703502645123
}
```

#### `use_prompt_error`
Error with use_prompt request.

**Payload:**
```json
{
  "error": "Invalid prompt type or messageId not found",
  "messageId": "msg-123..." // Optional
}
```

#### `aiprocessing_error`
Processing error (OCR, AI, or transcription).

**Payload:**
```json
{
  "error": "Error message",
  "message": "Error during ocr processing" // or "ai processing" or "transcription processing"
}
```

#### `connection_status`
Connection status change (e.g., disconnect).

**Payload:**
```json
{
  "status": "disconnected",
  "socketId": "abc123",
  "reason": "client disconnect",
  "timestamp": 1703502650000
}
```

#### `error`
Socket error.

**Payload:**
```json
{
  "socketId": "abc123",
  "error": "Error message",
  "timestamp": 1703502650000
}
```

---

## Processing Flows

### Screenshot Flow
1. Screenshot captured → `screenshot_captured`
2. OCR starts → `ocr_started`
3. OCR completes → `ocr_complete`
4. AI starts → `ai_processing_started`
5. AI completes → `ai_processing_complete` (with `messageId`)

### Transcription Flow
1. Send chunks → `transcription` (multiple times)
2. Process → `process_transcription`
3. AI starts → `ai_processing_started`
4. AI completes → `ai_processing_complete` (with `messageId`)

### Use Prompt Flow
1. Request → `use_prompt` (with `messageId` from previous response)
2. If `screenshotRequired: true` → `use_prompt_set` → wait for screenshot
3. If `screenshotRequired: false` → `use_prompt_set` → process immediately
4. AI starts → `ai_processing_started`
5. AI completes → `ai_processing_complete` (with new `messageId`)

---

## Frontend Integration Guide

### Connection Setup
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:4000/data-updates', {
  transports: ['websocket']
});

socket.on('connected', (data) => {
  console.log('Connected:', data.socketId);
});
```

### Screenshot Processing
Listen for screenshot processing events:
```javascript
socket.on('screenshot_captured', (data) => { /* ... */ });
socket.on('ocr_started', (data) => { /* ... */ });
socket.on('ocr_complete', (data) => { /* ... */ });
socket.on('ai_processing_started', (data) => { /* ... */ });
socket.on('ai_processing_complete', (data) => {
  // Store messageId for use_prompt functionality
  const messageId = data.messageId;
});
```

### Audio Transcription
Send transcription chunks and process:
```javascript
// Send chunks as they arrive
socket.emit('transcription', { textChunk: 'Chunk 1...' });
socket.emit('transcription', { textChunk: 'Chunk 2...' });

// Process when question complete
socket.emit('process_transcription');

// Listen for response
socket.on('ai_processing_complete', (data) => {
  const response = data.response;
  const messageId = data.messageId; // Store for use_prompt
});
```

### Use Prompt Feature
Process previous responses with different prompts:
```javascript
// Process without screenshot
socket.emit('use_prompt', {
  promptType: 'debug', // or 'theory', 'coding'
  messageId: 'msg-123...',
  screenshotRequired: false
});

// Process with screenshot (waits for next upload)
socket.emit('use_prompt', {
  promptType: 'debug',
  messageId: 'msg-123...',
  screenshotRequired: true
});

// Listen for prompt set confirmation
socket.on('use_prompt_set', (data) => {
  if (data.screenshotRequired) {
    // Wait for screenshot upload
  }
});

// Listen for errors
socket.on('use_prompt_error', (error) => {
  console.error('Prompt error:', error.error);
});
```

### Error Handling
```javascript
socket.on('aiprocessing_error', (error) => {
  console.error('Processing error:', error.error);
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});

socket.on('connection_status', (status) => {
  if (status.status === 'disconnected') {
    // Handle disconnect
  }
});
```

---

## Audio Integration Guide

### Transcription Chunk Flow
1. **Capture audio** → Convert to text (client-side or external service)
2. **Send chunks** → `socket.emit('transcription', { textChunk: '...' })`
3. **Accumulate** → Multiple chunks stored per connection
4. **Process** → `socket.emit('process_transcription')` when question complete
5. **Receive** → `ai_processing_complete` with answer and `messageId`

### Best Practices
- Send meaningful chunks (complete phrases/sentences)
- Process when question is fully transcribed
- Store `messageId` from responses for follow-up prompts
- Handle errors gracefully with retry logic

### Integration Points
- **Audio capture:** Use browser MediaRecorder API or external service
- **Speech-to-text:** Integrate with Web Speech API, Google Cloud Speech, or similar
- **Chunking:** Send chunks as they're transcribed (real-time or batched)

---

## Message ID System

Every AI response includes a `messageId` that can be used with `use_prompt`:

- **Screenshot responses:** Include `messageId` in `ai_processing_complete`
- **Transcription responses:** Include `messageId` in `ai_processing_complete`
- **Use prompt responses:** Generate new `messageId` for each follow-up

**Usage:** Store `messageId` from responses to enable follow-up processing with different prompt types.

---

## Prompt Types

- **`debug`:** Debug code with question, answer, and optional screenshot text
- **`theory`:** Explain theoretical concepts (question only)
- **`coding`:** Solve coding problems (question only)
- **`transcription`:** Default for transcription flow (auto-selected)

---

## Error Handling

### REST API
- `200` - Success
- `400` - Bad Request (invalid input)
- `500` - Server Error

### WebSocket
- `aiprocessing_error` - Processing errors
- `use_prompt_error` - Prompt request errors
- `error` - Socket errors
- Connection remains open unless fatal

---

## Notes

- API keys masked in responses (`"***"`)
- Uploaded files deleted after processing
- Data stored in memory (cleared on server restart)
- Multiple AI providers with failover (OpenAI, Groq, Gemini)
- Context mode: Previous responses used when enabled
- Each connection maintains isolated transcription chunks
- `messageId` enables follow-up processing with different prompts
