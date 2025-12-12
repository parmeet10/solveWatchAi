"""
Voice Activity Detection (VAD) service using Silero VAD
"""
import os
import logging
import numpy as np
import torch
from typing import Optional

logger = logging.getLogger(__name__)


class VADService:
    """Service for detecting voice activity in audio chunks"""
    
    def __init__(self):
        self.enabled = os.getenv("ENABLE_VAD", "true").lower() == "true"
        self.threshold = float(os.getenv("VAD_THRESHOLD", "0.5"))
        self.model = None
        self.sample_rate = 16000  # Silero VAD requires 16kHz
        
        if self.enabled:
            try:
                self._load_model()
                logger.info(f"VAD service initialized (threshold: {self.threshold})")
            except Exception as e:
                logger.error(f"Failed to load VAD model: {e}. VAD will be disabled.")
                self.enabled = False
        else:
            logger.info("VAD is disabled")
    
    def _load_model(self):
        """Load Silero VAD model"""
        try:
            # Silero VAD model loading
            model, utils = torch.hub.load(
                repo_or_dir='snakers4/silero-vad',
                model='silero_vad',
                force_reload=False,
                onnx=False
            )
            self.model = model
            self.model.eval()  # Set to evaluation mode
            logger.info("Silero VAD model loaded successfully")
        except Exception as e:
            logger.error(f"Error loading Silero VAD model: {e}")
            raise
    
    def is_speech(
        self,
        audio_data: bytes,
        sample_rate: int = 16000
    ) -> bool:
        """
        Detect if audio chunk contains speech
        
        Args:
            audio_data: Raw audio bytes (PCM 16-bit)
            sample_rate: Sample rate of audio (must be 16kHz for Silero VAD)
            
        Returns:
            True if speech is detected, False otherwise
        """
        if not self.enabled or self.model is None:
            # If VAD is disabled, assume all audio contains speech
            return True
        
        try:
            # Convert bytes to numpy array
            audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
            
            # Resample if necessary (Silero VAD requires 16kHz)
            if sample_rate != self.sample_rate:
                # Simple resampling (for production, use proper resampling library)
                if sample_rate > self.sample_rate:
                    # Downsample
                    step = sample_rate // self.sample_rate
                    audio_array = audio_array[::step]
                else:
                    # Upsample (repeat samples)
                    repeat_factor = self.sample_rate // sample_rate
                    audio_array = np.repeat(audio_array, repeat_factor)
            
            # Silero VAD requires exactly 512 samples for 16kHz (or 256 for 8kHz)
            # We need to split the audio into windows and process each
            window_size = 512  # For 16kHz
            num_samples = len(audio_array)
            
            # If audio is shorter than one window, pad it
            if num_samples < window_size:
                audio_array = np.pad(audio_array, (0, window_size - num_samples), mode='constant')
                num_samples = window_size
            
            # Process audio in windows
            speech_detections = 0
            total_windows = 0
            
            # Process windows with 50% overlap for better coverage
            step_size = window_size // 2
            
            for start_idx in range(0, num_samples - window_size + 1, step_size):
                window = audio_array[start_idx:start_idx + window_size]
                
                # Ensure exactly 512 samples
                if len(window) != window_size:
                    continue
                
                # Convert to torch tensor (add batch dimension)
                audio_tensor = torch.from_numpy(window).float().unsqueeze(0)
                
                # Get speech probability
                with torch.no_grad():
                    speech_prob = self.model(audio_tensor, self.sample_rate).item()
                
                total_windows += 1
                if speech_prob >= self.threshold:
                    speech_detections += 1
            
            # If we have no windows (shouldn't happen), assume speech
            if total_windows == 0:
                logger.warning("VAD: No windows processed, assuming speech")
                return True
            
            # Return True if at least 30% of windows detect speech
            speech_ratio = speech_detections / total_windows
            is_speech_detected = speech_ratio >= 0.3
            
            logger.debug(f"VAD: {speech_detections}/{total_windows} windows detected speech (ratio={speech_ratio:.2f}), threshold={self.threshold}, is_speech={is_speech_detected}")
            
            return is_speech_detected
            
        except Exception as e:
            logger.error(f"Error in VAD detection: {e}")
            # On error, assume speech to avoid missing transcriptions
            return True
    
    def has_sufficient_speech(
        self,
        audio_buffer: bytearray,
        sample_rate: int = 16000,
        min_speech_duration_ms: int = 250
    ) -> bool:
        """
        Check if buffer has sufficient speech duration
        
        Args:
            audio_buffer: Buffer of audio bytes
            sample_rate: Sample rate of audio
            min_speech_duration_ms: Minimum speech duration in milliseconds
            
        Returns:
            True if buffer contains sufficient speech
        """
        if not self.enabled:
            # If VAD is disabled, check if buffer has minimum size
            min_bytes = sample_rate * 2 * (min_speech_duration_ms / 1000)  # 16-bit = 2 bytes
            return len(audio_buffer) >= min_bytes
        
        # Check if we have enough data
        min_samples = int(sample_rate * (min_speech_duration_ms / 1000))
        min_bytes = min_samples * 2  # 16-bit = 2 bytes
        
        if len(audio_buffer) < min_bytes:
            return False
        
        # Use is_speech which handles proper windowing internally
        # Sample a few portions of the buffer for robustness
        buffer_size = len(audio_buffer)
        num_samples = min(3, buffer_size // min_bytes)
        
        speech_detections = 0
        for i in range(num_samples):
            # Sample from different parts of the buffer
            start = i * (buffer_size // (num_samples + 1))
            # Take at least min_bytes, but not more than what's available
            end = min(start + min_bytes, buffer_size)
            chunk = bytes(audio_buffer[start:end])
            if self.is_speech(chunk, sample_rate):
                speech_detections += 1
        
        # Require at least 50% of samples to have speech
        return speech_detections >= (num_samples / 2) if num_samples > 0 else False


# Global VAD service instance
vad_service = VADService()
