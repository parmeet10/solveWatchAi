# API Documentation

## Base URL

- **HTTP**: `http://localhost:4000` (or configured port)
- **WebSocket**: `ws://localhost:4000/data-updates`

---

## REST API Endpoints

### 1. Configuration Management

#### GET `/api/config/keys`

Retrieve API keys configuration (keys are masked for security).

**Response:**

```json
{
  "success": true,
  "config": {
    "keys": {
      "openai": "***",
      "grok": "***",
      "gemini": "***"
    },
    "order": ["openai", "grok", "gemini"],
    "enabled": ["openai", "grok"]
  }
}
```

**Response (no config exists):**

```json
{
  "success": true,
  "config": null
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "Failed to read configuration"
}
```

**Status Codes:**

- `200` - Success
- `500` - Server error

---

#### POST `/api/config/keys`

Save API keys configuration. Only updates keys that are provided (not masked values).

**Request Body:**

```json
{
  "keys": {
    "openai": "sk-...",
    "grok": "gsk_...",
    "gemini": "AIza..."
  },
  "order": ["openai", "grok", "gemini"],
  "enabled": ["openai", "grok"]
}
```

**Request Body Fields:**

- `keys` (object, optional): Object mapping provider IDs to API keys
  - Provider IDs: `"openai"`, `"grok"`, `"gemini"`
  - Keys that are `"***"` or empty strings are ignored (preserves existing values)
- `order` (array, required): Array of provider IDs in priority order
- `enabled` (array, optional): Array of enabled provider IDs. If not provided, defaults to all providers with valid keys

**Response:**

```json
{
  "success": true,
  "message": "Configuration saved successfully",
  "config": {
    "keys": {
      "openai": "***",
      "grok": "***",
      "gemini": "***"
    },
    "order": ["openai", "grok", "gemini"],
    "enabled": ["openai", "grok"]
  }
}
```

**Error Responses:**

Invalid format:

```json
{
  "success": false,
  "error": "Invalid configuration format"
}
```

No enabled providers:

```json
{
  "success": false,
  "error": "At least one AI provider must be enabled"
}
```

Server error:

```json
{
  "success": false,
  "error": "Failed to save configuration"
}
```

**Status Codes:**

- `200` - Success
- `400` - Bad request (invalid format or no enabled providers)
- `500` - Server error

---

### 2. Context State Management

#### GET `/api/context-state`

Get the current context state (whether context from previous responses is enabled).

**Response:**

```json
{
  "useContextEnabled": false
}
```

**Error Response:**

```json
{
  "error": "Failed to get context state"
}
```

**Status Codes:**

- `200` - Success
- `500` - Server error

---

#### POST `/api/context-state`

Update the context state.

**Request Body:**

```json
{
  "enabled": true
}
```

**Request Body Fields:**

- `enabled` (boolean, required): Whether to use context from previous AI responses

**Response:**

```json
{
  "success": true,
  "useContextEnabled": true
}
```

**Error Responses:**

Invalid request:

```json
{
  "error": "Invalid request. \"enabled\" must be a boolean."
}
```

Server error:

```json
{
  "error": "Failed to update context state"
}
```

**Status Codes:**

- `200` - Success
- `400` - Bad request (invalid boolean value)
- `500` - Server error

---

### 3. Image Processing

#### POST `/api/upload`

Upload and process an image. The image is processed through OCR and AI analysis.

**Content-Type:** `multipart/form-data`

**Request:**

- Form field: `image` (file, required)
  - Supported formats: JPEG, JPG, PNG, GIF, BMP, WEBP
  - Max file size: 10MB

**Response:**

```json
{
  "success": true,
  "message": "Image processed successfully",
  "filename": "screenshot.png",
  "extractedText": "Sample extracted text from image...",
  "gptResponse": "AI analysis of the extracted text...",
  "usedContext": false
}
```

**Response Fields:**

- `success` (boolean): Whether processing was successful
- `message` (string): Status message
- `filename` (string): Original filename of uploaded image
- `extractedText` (string): Preview of extracted text (first 200 characters)
- `gptResponse` (string): Preview of AI response (first 200 characters)
- `usedContext` (boolean): Whether previous context was used in AI processing

**Error Responses:**

No file uploaded:

```json
{
  "success": false,
  "error": "No file uploaded"
}
```

File too large:

```json
{
  "success": false,
  "error": "File too large. Maximum size is 10MB."
}
```

Invalid file type:

```json
{
  "success": false,
  "error": "Only image files are allowed!"
}
```

Processing error:

```json
{
  "success": false,
  "error": "Error processing image"
}
```

**Status Codes:**

- `200` - Success
- `400` - Bad request (no file uploaded, file too large, or invalid file type)
- `500` - Server error (processing failed)

**Note:** The uploaded file is automatically deleted after processing (success or failure).

---

#### GET `/api/data`

Retrieve all processed image data.

**Response:**

```json
[
  {
    "filename": "screenshot1.png",
    "timestamp": "12/25/2024, 10:30:45 AM",
    "extractedText": "Sample extracted text...",
    "gptResponse": "AI analysis response...",
    "usedContext": false
  },
  {
    "filename": "screenshot2.png",
    "timestamp": "12/25/2024, 10:31:20 AM",
    "extractedText": "Another extracted text...",
    "gptResponse": "Another AI analysis...",
    "usedContext": true
  }
]
```

**Response Fields (per item):**

- `filename` (string): Original filename
- `timestamp` (string): Processing timestamp in locale string format
- `extractedText` (string): Extracted text (truncated to 500 chars if longer)
- `gptResponse` (string): AI response (truncated to 1000 chars if longer)
- `usedContext` (boolean): Whether context was used
- `type` (string, optional): Type of item (e.g., "image")

**Status Codes:**

- `200` - Success (returns empty array `[]` if no data or on error)

---

## WebSocket API

### Namespace: `/data-updates`

Connect to the WebSocket namespace to receive real-time updates about image processing events.

**Connection URL:**

```
ws://localhost:4000/data-updates
```

**Transport:** WebSocket only

---

### Client Events (Events Client Sends)

#### `disconnect`

Client disconnects from the server.

**No payload required**

---

#### `error`

Client reports an error (handled automatically by Socket.io).

**Payload:** Error object

---

#### `capture`

Trigger rectangle region capture for OCR. The server will monitor system mouse clicks to capture a rectangular region defined by two clicks (top-left and bottom-right corners). After two clicks are captured, a screenshot is automatically taken and processed with OCR on the specified region.

**No payload required**

**Behavior:**

- Server starts monitoring system mouse clicks after receiving this event
- First click defines the top-left corner of the rectangle
- Second click defines the bottom-right corner of the rectangle
- Coordinates are automatically normalized (handles clicks in any order)
- Screenshot is taken automatically after both clicks are captured
- Coordinates are stored and used for the next screenshot OCR processing
- Coordinates are cleared after use (single-use only)

**Note:** The mouse monitoring stream is automatically cleaned up after capture or on client disconnect.

---

### Server Events (Events Client Receives)

#### `connected`

Emitted immediately upon successful connection.

**Payload:**

```json
{
  "socketId": "abc123xyz",
  "connectedAt": "2024-12-25T10:30:45.123Z",
  "timestamp": 1703502645123
}
```

**Payload Fields:**

- `socketId` (string): Unique socket connection ID
- `connectedAt` (string): ISO timestamp of connection
- `timestamp` (number): Unix timestamp in milliseconds

---

#### `screenshot_captured`

Emitted when a screenshot is captured and ready for processing.

**Payload:**

```json
{
  "message": "Screenshot captured: screenshot.png"
}
```

**Payload Fields:**

- `message` (string): Status message indicating the screenshot was captured with filename

---

#### `ocr_started`

Emitted when OCR (Optical Character Recognition) processing begins.

**Payload:**

```json
{
  "message": "OCR started"
}
```

**Payload Fields:**

- `message` (string): Status message indicating OCR processing has started

---

#### `ocr_complete`

Emitted when OCR processing completes successfully.

**Payload:**

```json
{
  "message": "OCR completed"
}
```

**Payload Fields:**

- `message` (string): Status message indicating OCR processing has completed

**Note:** The extracted text is logged on the server but not included in the event payload.

---

#### `ai_processing_started`

Emitted when AI processing begins.

**Payload:**

```json
{
  "message": "AI processing started"
}
```

**Payload Fields:**

- `message` (string): Status message indicating AI processing has started

---

#### `ai_processing_complete`

Emitted when AI processing completes successfully.

**Payload:**

```json
{
  "response": "This is the AI-generated response analyzing the extracted text from the image...",
  "message": "AI processing completed"
}
```

**Payload Fields:**

- `response` (string): The complete AI-generated response text
- `message` (string): Status message indicating AI processing has completed

---

#### `aiprocessing_error`

Emitted when an error occurs during processing (OCR or AI stage).

**Payload:**

```json
{
  "error": "OCR processing failed",
  "message": "Error during ocr processing"
}
```

**Payload Fields:**

- `error` (string): The error message describing what went wrong
- `message` (string): Status message indicating which stage encountered an error (`"Error during ocr processing"` or `"Error during ai processing"`)

---

#### `connection_status`

Emitted when connection status changes (e.g., on disconnect).

**Payload:**

```json
{
  "status": "disconnected",
  "socketId": "abc123xyz",
  "reason": "client disconnect",
  "timestamp": 1703502650000
}
```

**Payload Fields:**

- `status` (string): Connection status (`"disconnected"`)
- `socketId` (string): Socket connection ID
- `reason` (string): Reason for status change
- `timestamp` (number): Unix timestamp in milliseconds

---

#### `error`

Emitted when a socket error occurs.

**Payload:**

```json
{
  "socketId": "abc123xyz",
  "error": "Connection error message",
  "timestamp": 1703502650000
}
```

**Payload Fields:**

- `socketId` (string): Socket connection ID
- `error` (string): Error message
- `timestamp` (number): Unix timestamp in milliseconds

---

## Processing Flow

### Image Processing Pipeline

**Standard Flow:**

1. **Screenshot Capture** → `screenshot_captured` event
2. **OCR Processing Start** → `ocr_started` event
3. **OCR Processing Complete** → `ocr_complete` event
4. **AI Processing Start** → `ai_processing_started` event
5. **AI Processing Complete** → `ai_processing_complete` event

**With Region Capture:**

1. **Client sends `capture` event** → Server monitors mouse clicks
2. **Two clicks captured** → Rectangle coordinates stored
3. **Screenshot automatically taken** → `screenshot_captured` event
4. **OCR Processing Start** → `ocr_started` event (with region cropping)
5. **OCR Processing Complete** → `ocr_complete` event
6. **AI Processing Start** → `ai_processing_started` event
7. **AI Processing Complete** → `ai_processing_complete` event

If any error occurs:

- **Error Event** → `aiprocessing_error` event

### Context Usage

- When `useContextEnabled` is `true` and a previous AI response exists, the AI service uses the previous response as context for the next request.
- Context usage is logged on the server but not included in WebSocket event payloads.

---

### Cropping on Scale

When using the `capture` event to define a region for OCR, the system automatically handles coordinate scaling to account for display resolution differences.

**How it works:**

- Mouse clicks are captured in logical screen coordinates (e.g., 1440×900)
- Screenshots may have different resolutions, especially on Retina/high-DPI displays (e.g., 2880×1800)
- The system calculates a scale factor by comparing screenshot dimensions to screen dimensions
- Coordinates are automatically scaled before cropping the image for OCR

**Example:**

- Screen resolution: 1440×900 (logical)
- Screenshot resolution: 2880×1800 (2x Retina)
- Scale factor: 2.0
- Click at (500, 300) → Cropped at (1000, 600) in screenshot

This ensures accurate region extraction regardless of display scaling or Retina display settings.

---

## Error Handling

### REST API Errors

All REST endpoints return appropriate HTTP status codes:

- `200` - Success
- `400` - Bad Request (invalid input)
- `500` - Internal Server Error

Error responses follow this format:

```json
{
  "success": false,
  "error": "Error message"
}
```

### WebSocket Errors

WebSocket errors are emitted via the `error` or `aiprocessing_error` events. The connection remains open unless the error is fatal.

---

## Example Usage

### JavaScript/TypeScript WebSocket Client

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:4000/data-updates', {
  transports: ['websocket'],
});

// Connection events
socket.on('connected', (data) => {
  console.log('Connected:', data);
});

// Trigger region capture (monitor mouse clicks for rectangle)
socket.emit('capture');

// Processing events
socket.on('screenshot_captured', (data) => {
  console.log('Screenshot captured:', data.message);
});

socket.on('ocr_started', (data) => {
  console.log('OCR started:', data.message);
});

socket.on('ocr_complete', (data) => {
  console.log('OCR complete:', data.message);
});

socket.on('ai_processing_started', (data) => {
  console.log('AI processing started:', data.message);
});

socket.on('ai_processing_complete', (data) => {
  console.log('AI response:', data.response);
  console.log('Status:', data.message);
});

socket.on('aiprocessing_error', (error) => {
  console.error('Processing error:', error.error);
  console.error('Message:', error.message);
});

// Error handling
socket.on('error', (error) => {
  console.error('Socket error:', error);
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});
```

### REST API Example (cURL)

```bash
# Get configuration
curl http://localhost:4000/api/config/keys

# Save configuration
curl -X POST http://localhost:4000/api/config/keys \
  -H "Content-Type: application/json" \
  -d '{
    "keys": {
      "openai": "sk-...",
      "grok": "gsk_..."
    },
    "order": ["openai", "grok"],
    "enabled": ["openai", "grok"]
  }'

# Get context state
curl http://localhost:4000/api/context-state

# Update context state
curl -X POST http://localhost:4000/api/context-state \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'

# Upload image
curl -X POST http://localhost:4000/api/upload \
  -F "image=@screenshot.png"

# Get processed data
curl http://localhost:4000/api/data
```

---

## Notes

- WebSocket events are simplified and only include essential information (message and response/error where applicable).
- Detailed information (timestamps, file paths, durations, etc.) is logged on the server but not included in event payloads.
- API keys are always masked in responses (shown as `"***"`).
- Uploaded files are automatically deleted after processing.
- The WebSocket namespace uses WebSocket transport only (no polling).
- Processing data is stored in memory and persists until server restart.
- The server supports multiple AI providers with failover: OpenAI, Groq, and Google Gemini.
