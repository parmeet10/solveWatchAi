"""
Transcription service using faster-whisper
"""
import os
from faster_whisper import WhisperModel
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class TranscriptionService:
    """Service for transcribing audio using faster-whisper"""
    
    def __init__(self):
        self.model = None
        self.model_name = os.getenv("WHISPER_MODEL", "distil-medium.en")
        # faster-whisper doesn't support MPS, only CPU and CUDA
        # Auto-detect device: prefer CUDA if available, otherwise CPU
        device_env = os.getenv("WHISPER_DEVICE", "").lower()
        if device_env == "cuda":
            self.device = "cuda"
        elif device_env == "mps":
            # MPS not supported, fall back to CPU
            logger.warning("MPS device requested but not supported by faster-whisper. Using CPU instead.")
            self.device = "cpu"
        else:
            # Default to CPU (faster-whisper doesn't support MPS)
            self.device = "cpu"
        
        self.compute_type = "float16" if self.device == "cuda" else "int8"
        
    def load_model(self):
        """Load the Whisper model"""
        if self.model is None:
            try:
                logger.info(f"Loading Whisper model: {self.model_name} on device: {self.device}")
                self.model = WhisperModel(
                    self.model_name,
                    device=self.device,
                    compute_type=self.compute_type
                )
                logger.info(f"Whisper model loaded successfully on {self.device}")
            except Exception as e:
                logger.error(f"Error loading Whisper model: {e}")
                # Try falling back to CPU if other device fails
                if self.device != "cpu":
                    logger.warning(f"Failed to load on {self.device}, falling back to CPU")
                    self.device = "cpu"
                    self.compute_type = "int8"
                    try:
                        self.model = WhisperModel(
                            self.model_name,
                            device="cpu",
                            compute_type="int8"
                        )
                        logger.info("Whisper model loaded successfully on CPU (fallback)")
                    except Exception as e2:
                        logger.error(f"Error loading Whisper model on CPU: {e2}")
                        raise
                else:
                    raise
    
    def transcribe_file(
        self, 
        audio_path: str, 
        chunk_length_s: int = 30,
        language: Optional[str] = None
    ) -> Tuple[str, float]:
        """
        Transcribe an audio file
        
        Args:
            audio_path: Path to audio file
            chunk_length_s: Length of audio chunks in seconds
            language: Language code (optional, auto-detect if None)
            
        Returns:
            Tuple of (transcribed_text, confidence_score)
        """
        if self.model is None:
            self.load_model()
        
        try:
            logger.info(f"Transcribing file: {audio_path}")
            
            segments, info = self.model.transcribe(
                audio_path,
                language=language,
                chunk_length_s=chunk_length_s,
                beam_size=5,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500)
            )
            
            # Combine all segments
            full_text = ""
            total_confidence = 0.0
            segment_count = 0
            
            for segment in segments:
                full_text += segment.text + " "
                if hasattr(segment, 'avg_logprob'):
                    total_confidence += segment.avg_logprob
                    segment_count += 1
            
            avg_confidence = total_confidence / segment_count if segment_count > 0 else 0.0
            # Convert logprob to confidence (rough approximation)
            confidence = min(1.0, max(0.0, (avg_confidence + 1.0) / 2.0))
            
            logger.info(f"Transcription completed. Length: {len(full_text)} chars")
            return full_text.strip(), confidence
            
        except Exception as e:
            logger.error(f"Error transcribing file: {e}")
            raise
    
    def transcribe_chunk(
        self,
        audio_data: bytes,
        sample_rate: int = 16000,
        language: Optional[str] = None
    ) -> Tuple[str, float]:
        """
        Transcribe an audio chunk (for streaming)
        
        Args:
            audio_data: Raw audio bytes (PCM 16-bit)
            sample_rate: Sample rate of audio (default 16kHz)
            language: Language code (optional)
            
        Returns:
            Tuple of (transcribed_text, confidence_score)
        """
        if self.model is None:
            self.load_model()
        
        try:
            import numpy as np
            import tempfile
            import wave
            
            # Convert bytes to numpy array
            # Assuming audio_data is PCM 16-bit mono
            audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
            
            # Check if we have enough audio data (at least 0.5 seconds)
            min_samples = sample_rate // 2
            if len(audio_array) < min_samples:
                return "", 0.0
            
            # faster-whisper transcribe() doesn't accept sample_rate when passing numpy array
            # The array should already be at the correct sample rate (16kHz)
            # We need to create a temporary WAV file or use the array directly
            # For numpy arrays, we'll create a temporary WAV file
            import os
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
                tmp_path = tmp_file.name
                try:
                    # Write WAV file
                    with wave.open(tmp_path, 'wb') as wav_file:
                        wav_file.setnchannels(1)  # Mono
                        wav_file.setsampwidth(2)  # 16-bit
                        wav_file.setframerate(sample_rate)
                        # Convert float32 back to int16 for WAV
                        int16_array = (audio_array * 32767).astype(np.int16)
                        wav_file.writeframes(int16_array.tobytes())
                    
                    # Transcribe from file (this allows sample_rate parameter)
                    segments, info = self.model.transcribe(
                        tmp_path,
                        language=language,
                        beam_size=5,
                        vad_filter=True,
                        vad_parameters=dict(min_silence_duration_ms=300)
                    )
                finally:
                    # Clean up temporary file
                    if os.path.exists(tmp_path):
                        os.unlink(tmp_path)
            
            # Combine segments
            full_text = ""
            total_confidence = 0.0
            segment_count = 0
            
            for segment in segments:
                full_text += segment.text + " "
                if hasattr(segment, 'avg_logprob'):
                    total_confidence += segment.avg_logprob
                    segment_count += 1
            
            avg_confidence = total_confidence / segment_count if segment_count > 0 else 0.0
            confidence = min(1.0, max(0.0, (avg_confidence + 1.0) / 2.0))
            
            return full_text.strip(), confidence
            
        except Exception as e:
            logger.error(f"Error transcribing chunk: {e}")
            raise


# Global instance
transcription_service = TranscriptionService()

