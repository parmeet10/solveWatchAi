"""
Transcription service using mlx-whisper (optimized for M1 GPU with MPS acceleration)
"""
import os
import mlx_whisper
from typing import Optional, Tuple
import logging
import numpy as np
import tempfile
import wave

logger = logging.getLogger(__name__)


class TranscriptionService:
    """Service for transcribing audio using mlx-whisper with MPS acceleration"""
    
    def __init__(self):
        self.model_name = os.getenv("WHISPER_MODEL", "small")
        # Convert model name to mlx-whisper format (e.g., "tiny" -> "mlx-community/whisper-tiny")
        # mlx-whisper uses HuggingFace model names
        if not self.model_name.startswith("mlx-community/"):
            # Map simple names to full HuggingFace repo names
            model_map = {
                "tiny": "mlx-community/whisper-tiny-mlx",
                "base": "mlx-community/whisper-base-mlx",
                "small": "mlx-community/whisper-small-mlx",
                "medium": "mlx-community/whisper-medium-mlx",
                "large": "mlx-community/whisper-large-v3-mlx"
            }
            self.model_path = model_map.get(self.model_name, f"mlx-community/whisper-{self.model_name}")
        else:
            self.model_path = self.model_name
        
        # mlx-whisper automatically uses MPS on Apple Silicon (M1/M2/M3)
        # No need to specify device - MLX handles it automatically
        # Only log during actual initialization, not on import
        
    def load_model(self):
        """Load the Whisper model - mlx-whisper loads models on-demand, so this is a no-op"""
        # mlx-whisper.transcribe() loads the model automatically on first use
        # Models are cached by HuggingFace, so subsequent calls are fast
        # Model will be loaded on first transcription request
    
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
            chunk_length_s: Length of audio chunks in seconds (used for processing)
            language: Language code (optional, auto-detect if None)
            
        Returns:
            Tuple of (transcribed_text, confidence_score)
        """
        try:
            # Transcribing file (debug only)
            
            # mlx-whisper.transcribe() function - loads model automatically
            # It automatically handles chunking and returns full transcription
            transcribe_kwargs = {
                'path_or_hf_repo': self.model_path
            }
            if language:
                transcribe_kwargs['language'] = language
            
            result = mlx_whisper.transcribe(audio_path, **transcribe_kwargs)
            
            # Extract text from result
            # mlx-whisper returns a dict with 'text' and 'segments'
            full_text = result.get('text', '')
            segments = result.get('segments', [])
            
            # Calculate confidence from segments
            # mlx-whisper segments have 'no_speech_prob' - we'll use (1 - no_speech_prob) as confidence
            total_confidence = 0.0
            segment_count = 0
            
            for segment in segments:
                # Get confidence from segment (no_speech_prob is inverse confidence)
                no_speech_prob = segment.get('no_speech_prob', 0.5)
                segment_confidence = 1.0 - no_speech_prob
                total_confidence += segment_confidence
                segment_count += 1
            
            # Average confidence across all segments
            avg_confidence = total_confidence / segment_count if segment_count > 0 else 0.8
            
            # If no segments but we have text, use a default confidence
            if segment_count == 0 and full_text.strip():
                avg_confidence = 0.8
            
            # Transcription completed (debug only)
            return full_text.strip(), avg_confidence
            
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
        try:
            # Convert bytes to numpy array
            # Assuming audio_data is PCM 16-bit mono
            audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
            
            # Check if we have enough audio data (at least 0.5 seconds)
            min_samples = sample_rate // 2
            if len(audio_array) < min_samples:
                return "", 0.0
            
            # mlx-whisper needs audio file path, so we'll create a temporary WAV file
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
                    
                    # Transcribe from temporary file using mlx_whisper.transcribe()
                    transcribe_kwargs = {
                        'path_or_hf_repo': self.model_path
                    }
                    if language:
                        transcribe_kwargs['language'] = language
                    
                    result = mlx_whisper.transcribe(tmp_path, **transcribe_kwargs)
                finally:
                    # Clean up temporary file
                    if os.path.exists(tmp_path):
                        os.unlink(tmp_path)
            
            # Extract text and confidence from result
            full_text = result.get('text', '')
            segments = result.get('segments', [])
            
            # Calculate confidence from segments
            total_confidence = 0.0
            segment_count = 0
            
            for segment in segments:
                no_speech_prob = segment.get('no_speech_prob', 0.5)
                segment_confidence = 1.0 - no_speech_prob
                total_confidence += segment_confidence
                segment_count += 1
            
            avg_confidence = total_confidence / segment_count if segment_count > 0 else 0.8
            
            # If no segments but we have text, use a default confidence
            if segment_count == 0 and full_text.strip():
                avg_confidence = 0.8
            
            return full_text.strip(), avg_confidence
            
        except Exception as e:
            logger.error(f"Error transcribing chunk: {e}")
            raise


# Global instance
transcription_service = TranscriptionService()
