# Python Transcription Service

FastAPI microservice for speech-to-text transcription using faster-whisper.

## Features

- **REST API** for file upload transcription
- **WebSocket** for real-time streaming transcription
- **faster-whisper** with M1 GPU acceleration (MPS)
- Voice Activity Detection (VAD)
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

**Note:** On first run, faster-whisper will download the Whisper model (distil-medium.en, ~1.5GB). This is a one-time download.

3. **Configure environment (optional):**

Copy `.env.example` to `.env` and modify if needed:

```bash
cp .env.example .env
```

Default configuration:

- Port: 8000
- Model: distil-medium.en
- Device: mps (M1 Mac), cuda (NVIDIA GPU), or cpu

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
- `WHISPER_MODEL`: Whisper model name (default: distil-medium.en)
- `WHISPER_DEVICE`: Device to use - mps, cuda, or cpu (default: mps)
- `CHUNK_LENGTH_S`: Chunk length for file transcription (default: 30)
- `STREAMING_CHUNK_LENGTH_S`: Chunk length for streaming (default: 5)
- `ENABLE_VAD`: Enable Voice Activity Detection (default: true)
- `VAD_THRESHOLD`: VAD threshold (default: 0.5)

## Supported Audio Formats

- MP3
- WAV
- M4A
- MPEG
- MP4 (audio)
- WebM (audio)

## Performance

- **M1 Mac (MPS):** ~2-3x faster than CPU
- **NVIDIA GPU (CUDA):** ~5-10x faster than CPU
- **CPU:** Slower but works on any system

For best performance on M1 Mac, ensure `WHISPER_DEVICE=mps` in `.env`.

## Troubleshooting

### Model download fails

- Check internet connection
- Ensure sufficient disk space (~2GB for model)
- Try downloading manually from Hugging Face

### MPS device not available

- Ensure you're on macOS with M1/M2 chip
- Check PyTorch installation: `python -c "import torch; print(torch.backends.mps.is_available())"`
- Fall back to CPU by setting `WHISPER_DEVICE=cpu`

### Out of memory errors

- Use a smaller model (e.g., `distil-small.en`)
- Reduce `CHUNK_LENGTH_S` for file transcription
- Process shorter audio segments

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
