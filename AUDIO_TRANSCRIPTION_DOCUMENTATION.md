# Audio Transcription Handling Documentation

## Overview

The audio transcription feature allows clients to send live transcription chunks from coding interviews via WebSocket events. The system accumulates these chunks per connection, processes them through AI to identify coding problems or theoretical questions, and returns comprehensive answers.

## Architecture

```
Client → WebSocket 'transcription' event (textChunk) → Server accumulates chunks →
Client → WebSocket 'process_transcription' event → Server combines chunks →
AI processes transcription → Identifies question/problem → Generates answer →
Server stores answer → Emits response via WebSocket
```

## WebSocket Events

### Namespace

All transcription events are handled on the `/data-updates` namespace.

### Client → Server Events

#### 1. `transcription`

Sends a text chunk from live audio transcription.

**Event Name:** `transcription`

**Payload:**

```javascript
{
  textChunk: string; // The transcription text chunk
}
```

**Example:**

```javascript
socket.emit('transcription', {
  textChunk: 'So the interviewer is asking me to find the maximum sum subarray',
});
```

**Behavior:**

- Chunks are accumulated per socket connection (isolated per client)
- Each chunk is appended to an array stored in memory
- No validation or processing occurs at this stage
- Chunks persist in memory until `process_transcription` is called or socket disconnects

**Notes:**

- Multiple chunks can be sent before processing
- Chunks are joined with spaces when combined
- Invalid chunks (missing or non-string `textChunk`) are logged and ignored

---

#### 2. `process_transcription`

Triggers processing of all accumulated transcription chunks.

**Event Name:** `process_transcription`

**Payload:**

```javascript
// No payload required
```

**Example:**

```javascript
socket.emit('process_transcription');
```

**Behavior:**

- Retrieves all accumulated chunks for the current socket connection
- Combines chunks into full transcription text (joined with spaces)
- Sends transcription to AI service for processing
- Clears accumulated chunks from memory (transcription is not stored)
- Stores only the AI-generated answer
- Emits response events back to client

**Error Handling:**

- If no chunks are available, emits `aiprocessing_error` event
- AI processing errors are caught and emitted via `aiprocessing_error` event

---

### Server → Client Events

#### 1. `ai_processing_started`

Emitted when AI processing begins.

**Event Name:** `ai_processing_started`

**Payload:**

```javascript
{
  message: 'AI processing started';
}
```

---

#### 2. `ai_processing_complete`

Emitted when AI processing completes successfully.

**Event Name:** `ai_processing_complete`

**Payload:**

```javascript
{
  response: string,  // The AI-generated answer
  message: 'AI processing completed'
}
```

**Response Format:**

**For Coding Problems:**

```
Problem: <one-sentence problem statement>
<solution code>

Complexity: Time O(…), Space O(…)
Constraints: <key constraints>
[If database question: SQL Query: <query>]
[If code execution: Output: <result>]
```

**For Theoretical Questions:**

```
Question: <the exact theoretical question extracted from transcription>

Answer: <comprehensive answer explaining the concept, including relevant details, examples, trade-offs, and best practices>
```

---

#### 3. `aiprocessing_error`

Emitted when an error occurs during processing.

**Event Name:** `aiprocessing_error`

**Payload:**

```javascript
{
  error: string,      // Error message
  message: string     // Human-readable error message
}
```

**Common Error Scenarios:**

- No transcription data available
- AI provider failures
- Invalid transcription chunks

---

## Usage Example

### JavaScript Client

```javascript
import io from 'socket.io-client';

// Connect to the WebSocket server
const socket = io('http://localhost:4000/data-updates');

// Listen for connection
socket.on('connected', (data) => {
  console.log('Connected:', data.socketId);
});

// Optional: Set prompt type for specialized processing
socket.emit('set_prompt_type', { promptType: 'coding' });

// Listen for prompt type confirmation
socket.on('prompt_type_set', (data) => {
  console.log('Prompt type set to:', data.promptType);
});

// Send transcription chunks as they arrive
socket.emit('transcription', {
  textChunk: 'The interviewer wants me to implement a binary search tree',
});

socket.emit('transcription', {
  textChunk: 'with insert and search operations',
});

socket.emit('transcription', {
  textChunk: 'in O(log n) time complexity',
});

// Process all accumulated chunks
socket.emit('process_transcription');

// Listen for AI processing events
socket.on('ai_processing_started', (data) => {
  console.log('Processing started:', data.message);
});

socket.on('ai_processing_complete', (data) => {
  console.log('Answer:', data.response);
  // Response contains the formatted answer
});

socket.on('aiprocessing_error', (error) => {
  console.error('Error:', error.error);
});
```

## Data Storage

### What is Stored

- **AI-generated answers** are stored in `imageProcessingService.processedData`
- Answers include truncated versions of transcription and response for historical reference

### What is NOT Stored

- **Original transcription chunks** are cleared immediately after processing
- Raw transcription text is not persisted in the database
- Only the AI response and metadata are stored

### Storage Format

```javascript
{
  filename: 'transcription',
  timestamp: '12/25/2024, 10:30:45 AM',
  extractedText: 'first 500 chars of transcription...',
  gptResponse: 'first 1000 chars of AI response...',
  usedContext: false,
  type: 'transcription'
}
```

---

## Question Types

### Coding Problems

The AI identifies algorithmic or programming challenges and provides:

- Problem statement
- Complete solution code (default: JavaScript)
- Time and space complexity
- Constraints

**Example Topics:**

- Data structures (arrays, trees, graphs, heaps)
- Algorithms (sorting, searching, dynamic programming)
- String manipulation
- Number theory
- Graph algorithms

### Theoretical Questions

The AI identifies conceptual questions and provides:

- Clear question extraction
- Comprehensive answer with examples and best practices

**Example Topics:**

- **Databases:** SQL, NoSQL, ACID properties, CAP theorem, indexing, transactions
- **System Design:** Scalability, load balancing, caching strategies
- **Distributed Systems:** Consistency, replication, consensus algorithms
- **Data Structures:** Time/space trade-offs, use cases
- **Algorithms:** Complexity analysis, optimization techniques
- **Software Engineering:** Design patterns, SOLID principles, testing strategies
- **Networking:** Protocols, HTTP/HTTPS, TCP/IP
- **Security:** Authentication, encryption, vulnerabilities
- **Operating Systems:** Processes, threads, memory management

---

## Configuration

### AI Provider Settings

The transcription feature uses the same AI provider configuration as the image processing feature:

- Supports multiple providers (OpenAI, Groq, Gemini)
- Automatic fallback on provider failures
- Provider selection configured in `config/api-keys.json`

### Prompt Configuration

Transcription processing uses prompts based on the configured prompt type:

**Default Prompt:**
- `prompts/transcription-prompt.txt` - Used when no specific prompt type is set

**Specialized Prompts (via `set_prompt_type` event):**
- `prompts/coding-prompt.txt` - For coding problems and algorithmic challenges
- `prompts/theory-prompt.txt` - For theoretical questions about concepts, system design, databases, etc.
- `prompts/query-prompt.txt` - For database query questions (SQL or MongoDB)

**Setting Prompt Type:**

Clients can set a prompt type before processing transcriptions:

```javascript
// Set coding prompt
socket.emit('set_prompt_type', { promptType: 'coding' });

// Set theory prompt
socket.emit('set_prompt_type', { promptType: 'theory' });

// Set query prompt
socket.emit('set_prompt_type', { promptType: 'query' });

// Reset to default transcription prompt
socket.emit('set_prompt_type', { promptType: null });
```

**Behavior:**
- The prompt type is stored per socket connection
- All subsequent transcription processing will use the selected prompt type
- If no prompt type is set, the default `transcription-prompt.txt` is used
- The prompt type persists until changed or the socket disconnects

**Default Transcription Prompt Features:**
- Extracting questions from conversational transcriptions
- Handling filler words and incomplete sentences
- Distinguishing coding problems from theoretical questions
- Providing appropriate response formats

**See Also:**
- See the main [API Documentation](./API_DOCUMENTATION.md) for complete `set_prompt_type` event details

---

## Error Handling

### Client-Side Validation

- Validate `textChunk` is a non-empty string before sending
- Handle `aiprocessing_error` events appropriately
- Implement retry logic for network failures

### Server-Side Error Handling

- Invalid chunks are logged and ignored
- Empty chunk arrays trigger error events
- AI provider failures trigger fallback mechanisms
- All errors are emitted via `aiprocessing_error` event

### Common Error Messages

| Error Message                          | Cause                                                 | Solution                                         |
| -------------------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| `No transcription data available`      | `process_transcription` called before any chunks sent | Send transcription chunks first                  |
| `All AI providers failed`              | All configured AI providers unavailable               | Check API keys and network connectivity          |
| `Invalid transcription chunk received` | Missing or invalid `textChunk` field                  | Ensure payload contains valid string `textChunk` |

---

## Connection Lifecycle

### On Connection

- Socket ID is assigned
- Empty transcription chunk array is initialized (lazily)
- Connection event is emitted to client

### During Session

- Chunks accumulate in memory per connection
- Multiple `transcription` events can be sent
- `process_transcription` can be called multiple times
- Each processing clears previous chunks

### On Disconnect

- All transcription chunks for the connection are cleared
- No data persistence of transcription text
- Stored AI answers remain in `processedData`

---

## Best Practices

### For Clients

1. **Chunk Size:** Send meaningful chunks that represent complete thoughts or phrases
2. **Processing Timing:** Call `process_transcription` when a complete question has been transcribed
3. **Error Handling:** Always listen for `aiprocessing_error` events
4. **Connection Management:** Handle reconnection scenarios appropriately
5. **Rate Limiting:** Avoid sending excessive small chunks; batch when possible

### For Developers

1. **Memory Management:** Transcription chunks are stored in memory and cleared after processing
2. **Concurrent Connections:** Each socket connection maintains isolated chunk storage
3. **AI Provider Limits:** Consider rate limits when processing multiple transcriptions simultaneously
4. **Logging:** Debug logs track chunk accumulation; info logs track processing stages

---

## Integration with Existing Features

### Shared Services

- Uses `aiService` for AI processing
- Uses `imageProcessingService` for storing responses
- Follows same event emission pattern as image processing

### Response Storage

- Transcription responses stored alongside image processing responses
- Both accessible via `imageProcessingService.getProcessedData()`
- Responses include `type: 'transcription'` field for filtering

### Context Mode

- Transcription responses update `lastResponse` for potential context use
- Future image processing can leverage transcription responses as context

---

## Technical Details

### Implementation Files

- **Socket Handler:** `src/sockets/dataHandler.js`
  - `transcriptionChunks` Map stores chunks per socket.id
  - Event handlers for `transcription` and `process_transcription`
- **AI Service:** `src/services/ai.service.js`
  - `askGptTranscription()` method processes transcription
  - `readTranscriptionPromptFromFile()` loads transcription prompt
- **Prompt File:** `prompts/transcription-prompt.txt`
  - Specialized prompt for transcription processing
  - Handles both coding and theoretical questions

### Memory Management

- Transcription chunks stored in `Map<socketId, string[]>`
- Chunks cleared immediately after processing
- Automatic cleanup on socket disconnect
- No disk persistence of transcription text

### Performance Considerations

- In-memory storage is fast but not persistent
- Large transcriptions may impact memory (consider chunk limits if needed)
- AI processing time depends on transcription length and provider
- Multiple concurrent transcriptions processed independently

---

## API Reference Summary

### Events Table

| Event                    | Direction       | Purpose                    | Payload                                 |
| ------------------------ | --------------- | -------------------------- | --------------------------------------- |
| `transcription`          | Client → Server | Send text chunk            | `{ textChunk: string }`                 |
| `process_transcription`  | Client → Server | Process accumulated chunks | None                                    |
| `ai_processing_started`  | Server → Client | Processing started         | `{ message: string }`                   |
| `ai_processing_complete` | Server → Client | Processing completed       | `{ response: string, message: string }` |
| `aiprocessing_error`     | Server → Client | Processing error           | `{ error: string, message: string }`    |

---

## Examples

### Complete Interview Flow

```javascript
// Connect
const socket = io('http://localhost:4000/data-updates');

// Interview starts
socket.emit('transcription', {
  textChunk: 'So today we have a coding problem for you',
});

socket.emit('transcription', {
  textChunk: 'Can you implement a function to find the two sum problem?',
});

socket.emit('transcription', {
  textChunk: 'Given an array of integers and a target sum',
});

// Question complete - process
socket.emit('process_transcription');

// Receive answer
socket.on('ai_processing_complete', (data) => {
  console.log('Solution:', data.response);
  // Output:
  // Problem: Find two numbers in an array that sum to a target value
  //
  // function twoSum(nums, target) {
  //   const map = new Map();
  //   for (let i = 0; i < nums.length; i++) {
  //     const complement = target - nums[i];
  //     if (map.has(complement)) {
  //       return [map.get(complement), i];
  //     }
  //     map.set(nums[i], i);
  //   }
  //   return [];
  // }
  //
  // Complexity: Time O(n), Space O(n)
  // Constraints: Array contains integers, each input has exactly one solution
});
```

### Theoretical Question Example

```javascript
socket.emit('transcription', {
  textChunk: 'Can you explain what is the CAP theorem?',
});

socket.emit('process_transcription');

socket.on('ai_processing_complete', (data) => {
  console.log('Answer:', data.response);
  // Output:
  // Question: Can you explain what is the CAP theorem?
  //
  // Answer: The CAP theorem states that in a distributed system,
  // you can only guarantee two out of three properties: Consistency,
  // Availability, and Partition tolerance...
});
```

---

## Troubleshooting

### Issue: No response received

- **Check:** Are you listening for `ai_processing_complete` event?
- **Check:** Did you send chunks before calling `process_transcription`?
- **Check:** Are there any `aiprocessing_error` events?

### Issue: Chunks not accumulating

- **Check:** Are you sending valid `textChunk` as a string?
- **Check:** Are you connected to the correct namespace (`/data-updates`)?
- **Check:** Server logs for "Invalid transcription chunk received"

### Issue: AI response format unexpected

- **Check:** Transcription prompt file exists and is readable
- **Check:** Is the question clearly identifiable in transcription?
- **Review:** Transcription prompt may need adjustment for specific use cases

---

## Version History

- **v1.0.0** - Initial implementation
  - Basic transcription chunk accumulation
  - AI processing for coding problems
  - Support for theoretical questions
  - Per-connection chunk storage
  - Automatic cleanup on disconnect

---

## Support

For issues or questions:

1. Check server logs for detailed error messages
2. Verify WebSocket connection is established
3. Ensure AI providers are properly configured
4. Review transcription prompt if response quality is poor
