"""
FastAPI application for speech-to-text transcription
"""
import os
import logging
from fastapi import FastAPI, File, UploadFile, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from dotenv import load_dotenv
from transcription import transcription_service
from streaming import streaming_manager
from vad import vad_service

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Speech-to-Text Transcription Service")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load transcription model on startup
@app.on_event("startup")
async def startup_event():
    """Initialize transcription service and VAD"""
    try:
        transcription_service.load_model()
        logger.info("Transcription service initialized")
        
        # VAD is initialized when imported (vad_service)
        if vad_service.enabled:
            logger.info("VAD service initialized and enabled")
        else:
            logger.info("VAD service is disabled")
    except Exception as e:
        logger.error(f"Failed to initialize transcription service: {e}")


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "service": "speech-to-text-transcription"}


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": True,  # mlx-whisper loads models on-demand
        "model_name": transcription_service.model_path,
        "vad_enabled": vad_service.enabled,
        "vad_threshold": vad_service.threshold if vad_service.enabled else None
    }


@app.post("/transcribe")
async def transcribe_file(file: UploadFile = File(...)):
    """
    Transcribe an uploaded audio file
    
    Accepts: MP3, WAV, M4A formats
    Returns: JSON with transcribed text and confidence score
    """
    try:
        # Validate file type
        allowed_extensions = {".mp3", ".wav", ".m4a", ".mpeg", ".mp4", ".webm"}
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Save uploaded file temporarily
        import tempfile
        import aiofiles
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        try:
            # Transcribe the file
            chunk_length_s = int(os.getenv("CHUNK_LENGTH_S", "30"))
            text, confidence = transcription_service.transcribe_file(
                tmp_path,
                chunk_length_s=chunk_length_s
            )
            
            return JSONResponse({
                "success": True,
                "text": text,
                "confidence": confidence,
                "filename": file.filename
            })
            
        finally:
            # Clean up temporary file
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error transcribing file: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


# WebSocket endpoint for streaming
@app.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    """WebSocket endpoint for real-time audio streaming transcription"""
    await streaming_manager.handle_websocket(websocket)


if __name__ == "__main__":
    port = int(os.getenv("PYTHON_SERVICE_PORT", "8000"))
    host = os.getenv("PYTHON_SERVICE_HOST", "0.0.0.0")
    
    logger.info(f"Starting transcription service on {host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="info")

