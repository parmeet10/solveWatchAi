# Python Transcription Service

FastAPI microservice for speech-to-text transcription using mlx-whisper (optimized for Apple Silicon).

## Features

- **REST API** for file upload transcription
- **WebSocket** for real-time streaming transcription
- **mlx-whisper** with M1/M2/M3 GPU acceleration (MPS)
- **Voice Activity Detection (VAD)** using Silero VAD to filter silence
- Session management for multiple concurrent users

## Prerequisites

- Python 3.8 or higher
- macOS with M1/M2 chip (for MPS acceleration) OR CUDA-capable GPU OR CPU
- At least 4GB RAM
- Internet connection (for downloading Whisper models on first run)

## Installation

1. **Create a virtual environment:**

```bash
cd python-service
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. **Install dependencies:**

```bash
pip install -r requirements.txt
```

**Note:** On first run, mlx-whisper will download the Whisper model (default: small, ~466MB). This is a one-time download. The model is cached for subsequent uses.

3. **Configure environment (optional):**

Copy `.env.example` to `.env` and modify if needed:

```bash
cp .env.example .env
```

Default configuration:

- Port: 8000
- Model: small (mlx-community/whisper-small-mlx)
- VAD: Enabled (threshold: 0.5)
- Device: Automatically uses MPS on Apple Silicon (M1/M2/M3)

## Running the Service

```bash
python app.py
```

Or using uvicorn directly:

```bash
uvicorn app:app --host 0.0.0.0 --port 8000
```

The service will be available at:

- REST API: `http://localhost:8000`
- WebSocket: `ws://localhost:8000/ws/stream`
- Health check: `http://localhost:8000/health`

## API Endpoints

### REST API

#### POST /transcribe

Transcribe an uploaded audio file.

**Request:**

- Method: POST
- Content-Type: multipart/form-data
- Body: `file` (audio file: MP3, WAV, M4A, etc.)

**Response:**

```json
{
  "success": true,
  "text": "Transcribed text here...",
  "confidence": 0.95,
  "filename": "audio.mp3"
}
```

### WebSocket API

#### /ws/stream

Real-time streaming transcription.

**Connection:**

1. Connect to `ws://localhost:8000/ws/stream`
2. Send initial message:

```json
{
  "type": "connect",
  "sessionId": "optional-session-id"
}
```

3. Receive confirmation:

```json
{
  "type": "connected",
  "sessionId": "session-id"
}
```

**Send audio chunks:**

```json
{
  "type": "audio_chunk",
  "chunk": "base64-encoded-audio-data",
  "timestamp": 1234567890
}
```

**Receive transcriptions:**

```json
{
  "type": "transcription",
  "sessionId": "session-id",
  "text": "Transcribed text",
  "confidence": 0.95,
  "timestamp": 1234567890,
  "final": false
}
```

**End stream:**

```json
{
  "type": "end_stream"
}
```

## Configuration

Environment variables (in `.env` file):

- `PYTHON_SERVICE_PORT`: Port number (default: 8000)
- `PYTHON_SERVICE_HOST`: Host address (default: 0.0.0.0)
- `WHISPER_MODEL`: Whisper model name - tiny, base, small, medium, or large (default: small)
  - Available models: `tiny` (~39M params), `base` (~74M), `small` (~244M), `medium` (~769M), `large` (~1550M)
  - Can also use full HuggingFace path: `mlx-community/whisper-small-mlx`
- `CHUNK_LENGTH_S`: Chunk length for file transcription (default: 30)
- `ENABLE_VAD`: Enable Voice Activity Detection (default: true)
  - When enabled, only audio chunks with detected speech are transcribed
  - Reduces processing of silence and background noise
- `VAD_THRESHOLD`: VAD speech probability threshold 0.0-1.0 (default: 0.5)
  - Lower values = more sensitive (may detect noise as speech)
  - Higher values = less sensitive (may miss quiet speech)

## Supported Audio Formats

- MP3
- WAV
- M4A
- MPEG
- MP4 (audio)
- WebM (audio)

## Performance

### Model Size vs Accuracy Trade-offs

- **tiny**: ~39M params, ~75MB, fastest, lowest accuracy
- **base**: ~74M params, ~142MB, good balance
- **small**: ~244M params, ~466MB, better accuracy (default)
- **medium**: ~769M params, ~1.5GB, high accuracy
- **large**: ~1550M params, ~3GB, highest accuracy

### Performance Notes

- **M1/M2/M3 Mac (MPS)**: MLX automatically uses MPS acceleration
- **CPU**: Falls back to CPU if MPS unavailable
- **VAD**: Reduces processing by ~30-50% by filtering silence
- **Memory**: Small model requires ~2-4GB RAM, medium requires ~4-8GB

For best accuracy on M1/M2/M3 Macs with 8GB+ RAM, use `small` or `medium` model.

## Troubleshooting

### Model download fails

- Check internet connection
- Ensure sufficient disk space (small model: ~466MB, medium: ~1.5GB)
- Models are cached in HuggingFace cache directory

### Out of memory errors

- Use a smaller model (e.g., `base` or `tiny` instead of `small`)
- Reduce `CHUNK_LENGTH_S` for file transcription
- Process shorter audio segments
- Close other applications to free memory

### VAD not working

- Ensure `ENABLE_VAD=true` in environment
- Check that Silero VAD model downloaded successfully
- Adjust `VAD_THRESHOLD` if too many false positives/negatives
- VAD requires 16kHz sample rate audio

### WebSocket connection issues

- Check firewall settings
- Ensure port 8000 is not in use
- Verify CORS settings if accessing from different origin

## Development

To run in development mode with auto-reload:

```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

## License

Same as main project.
