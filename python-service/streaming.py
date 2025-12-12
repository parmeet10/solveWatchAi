"""
WebSocket streaming handler for real-time transcription
"""
import asyncio
import json
import logging
import base64
import uuid
import time
from typing import Dict, Optional
from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect
from transcription import transcription_service
from vad import vad_service

logger = logging.getLogger(__name__)

# Real-time streaming logger - lightweight, no buffering
def log_chunk(session_id: str, size_bytes: int, status: str, details: str = ""):
    """Log audio chunk processing in real-time - immediate flush"""
    size_kb = size_bytes / 1024
    timestamp = time.strftime("%H:%M:%S", time.localtime())
    session_short = session_id[:8] if session_id else "unknown"
    print(f"[{timestamp}] [{session_short}] {status:8s} | {size_kb:5.1f}KB | {details}", flush=True)

def log_transcription(session_id: str, text: str, confidence: float):
    """Log transcription result - immediate flush"""
    timestamp = time.strftime("%H:%M:%S", time.localtime())
    session_short = session_id[:8] if session_id else "unknown"
    preview = text[:50] + "..." if len(text) > 50 else text
    print(f"[{timestamp}] [{session_short}] ✨ [{confidence:.0%}] {preview}", flush=True)


class StreamingSession:
    """Manages a single streaming transcription session"""
    
    def __init__(self, session_id: str, websocket: WebSocket):
        self.session_id = session_id
        self.websocket = websocket
        self.audio_buffer = bytearray()
        self.speech_buffer = bytearray()  # Buffer for detected speech
        self.is_active = True
        self.last_transcription_time = 0
        self.chunk_interval = 3  # Process chunks every 3 seconds
        self.consecutive_silence_chunks = 0
        self.min_speech_chunks = 2  # Minimum chunks with speech before processing
        self.process_until_timestamp = None  # Timestamp cutoff for flush operations
        self.pending_chunks = []  # Store chunks with timestamps during flush grace period
        
    async def process_audio_chunk(self, audio_data: bytes, chunk_timestamp: Optional[float] = None):
        """Process incoming audio chunk with VAD"""
        try:
            # If we're in flush mode, check if this chunk should be processed
            if self.process_until_timestamp is not None:
                # Use current time if timestamp not provided
                if chunk_timestamp is None:
                    chunk_timestamp = time.time() * 1000  # Convert to milliseconds
                
                # If chunk is after cutoff, ignore it (it's post-flush)
                if chunk_timestamp > self.process_until_timestamp:
                    logger.debug(f"Session {self.session_id}: Ignoring chunk after cutoff timestamp ({chunk_timestamp} > {self.process_until_timestamp})")
                    return
            
            self.audio_buffer.extend(audio_data)
            chunk_size = len(audio_data)
            
            # Check for speech activity using VAD
            is_speech = vad_service.is_speech(audio_data, sample_rate=16000)
            
            if is_speech:
                # Speech detected - add to speech buffer
                self.speech_buffer.extend(audio_data)
                self.consecutive_silence_chunks = 0
                
                # Log speech detection - immediate
                speech_buffer_kb = len(self.speech_buffer) / 1024
                log_chunk(self.session_id, chunk_size, "SPEECH", f"buf:{speech_buffer_kb:.1f}KB")
            else:
                # Silence detected
                self.consecutive_silence_chunks += 1
                
                # Log silence detection - immediate
                log_chunk(self.session_id, chunk_size, "SILENCE", f"sil:{self.consecutive_silence_chunks}")
                
                # If we have accumulated speech and hit silence, process the speech buffer
                if len(self.speech_buffer) > 0 and self.consecutive_silence_chunks >= 2:
                    await self._process_speech_buffer()
            
            # Also process if we have enough accumulated speech (3 seconds at 16kHz = 48000 samples = 96000 bytes for 16-bit)
            min_chunk_size = 16000 * 2 * self.chunk_interval  # 16kHz * 2 bytes * seconds
            
            if len(self.speech_buffer) >= min_chunk_size:
                buffer_kb = len(self.speech_buffer) / 1024
                print(f"[{time.strftime('%H:%M:%S', time.localtime())}] [{self.session_id[:8]}] THRESHOLD | buf:{buffer_kb:.1f}KB", flush=True)
                await self._process_speech_buffer()
                
        except WebSocketDisconnect:
            # WebSocket disconnected (debug only)
            self.is_active = False
        except Exception as e:
            logger.error(f"Error processing audio chunk for session {self.session_id}: {e}")
            error_msg = {
                "type": "error",
                "sessionId": self.session_id,
                "message": str(e)
            }
            try:
                await self.websocket.send_json(error_msg)
            except (WebSocketDisconnect, RuntimeError):
                self.is_active = False
            except:
                pass
    
    async def _process_speech_buffer(self):
        """Process accumulated speech buffer"""
        if len(self.speech_buffer) == 0:
            return
        
        try:
            buffer_size = len(self.speech_buffer)
            buffer_kb = buffer_size / 1024
            
            # Check if we have sufficient speech (avoid processing very short clips)
            if not vad_service.has_sufficient_speech(self.speech_buffer, sample_rate=16000, min_speech_duration_ms=250):
                # Clear buffer if insufficient speech
                timestamp = time.strftime("%H:%M:%S", time.localtime())
                session_short = self.session_id[:8] if self.session_id else "unknown"
                print(f"[{timestamp}] [{session_short}] ⚠️  Insufficient speech, clearing {buffer_kb:.1f}KB", flush=True)
                self.speech_buffer.clear()
                return
            
            # Process the speech buffer
            chunk_to_process = bytes(self.speech_buffer)
            self.speech_buffer.clear()
            
            # Log processing start - immediate
            timestamp = time.strftime("%H:%M:%S", time.localtime())
            session_short = self.session_id[:8] if self.session_id else "unknown"
            print(f"[{timestamp}] [{session_short}] 🔄 Transcribing {buffer_kb:.1f}KB...", flush=True)
            
            # Transcribe the chunk
            text, confidence = transcription_service.transcribe_chunk(
                chunk_to_process,
                sample_rate=16000
            )
            
            if text.strip():
                result = {
                    "type": "transcription",
                    "sessionId": self.session_id,
                    "text": text,
                    "confidence": confidence,
                    "timestamp": time.time()
                }
                
                await self.websocket.send_json(result)
                # Log transcription result
                log_transcription(self.session_id, text, confidence)
        except WebSocketDisconnect:
            # WebSocket disconnected (debug only)
            self.is_active = False
        except Exception as e:
            logger.error(f"Error processing speech buffer for session {self.session_id}: {e}")
            error_msg = {
                "type": "error",
                "sessionId": self.session_id,
                "message": str(e)
            }
            try:
                await self.websocket.send_json(error_msg)
            except (WebSocketDisconnect, RuntimeError):
                self.is_active = False
            except:
                pass
    
    async def flush_buffer(self):
        """Flush remaining audio buffer"""
        # Process any remaining speech in the buffer
        if len(self.speech_buffer) > 0:
            await self._process_speech_buffer()
        
        # Also check audio buffer for any remaining speech
        if len(self.audio_buffer) > 16000:  # At least 1 second of audio
            # Check if remaining audio contains speech
            if vad_service.has_sufficient_speech(self.audio_buffer, sample_rate=16000, min_speech_duration_ms=250):
                try:
                    text, confidence = transcription_service.transcribe_chunk(
                        bytes(self.audio_buffer),
                        sample_rate=16000
                    )
                    
                    if text.strip():
                        result = {
                            "type": "transcription",
                            "sessionId": self.session_id,
                            "text": text,
                            "confidence": confidence,
                            "timestamp": time.time(),
                            "final": True
                        }
                        
                        await self.websocket.send_json(result)
                        log_transcription(self.session_id, text, confidence)
                except WebSocketDisconnect:
                    self.is_active = False
                except Exception as e:
                    logger.error(f"Error flushing buffer for session {self.session_id}: {e}")
        
        self.audio_buffer.clear()
        self.speech_buffer.clear()
    
    async def flush_buffer_with_cutoff(self, cutoff_timestamp: float, grace_period_ms: int = 500):
        """
        Flush buffer with timestamp cutoff and grace period for in-transit packets
        
        Args:
            cutoff_timestamp: Timestamp in milliseconds - only process chunks before this
            grace_period_ms: Grace period in milliseconds to wait for in-transit packets
        """
        import time
        
        # Log flush operation - immediate
        timestamp = time.strftime("%H:%M:%S", time.localtime())
        session_short = self.session_id[:8] if self.session_id else "unknown"
        print(f"[{timestamp}] [{session_short}] 🧹 Flush (grace:{grace_period_ms}ms)", flush=True)
        
        # Set cutoff timestamp
        self.process_until_timestamp = cutoff_timestamp
        
        # Wait for grace period to catch in-transit packets
        grace_period_seconds = grace_period_ms / 1000.0
        await asyncio.sleep(grace_period_seconds)
        
        # Grace period ended, processing remaining buffers (debug only)
        
        # Process any remaining speech in the buffer (only chunks before cutoff)
        if len(self.speech_buffer) > 0:
            await self._process_speech_buffer()
        
        # Also check audio buffer for any remaining speech
        if len(self.audio_buffer) > 16000:  # At least 1 second of audio
            # Check if remaining audio contains speech
            if vad_service.has_sufficient_speech(self.audio_buffer, sample_rate=16000, min_speech_duration_ms=250):
                try:
                    text, confidence = transcription_service.transcribe_chunk(
                        bytes(self.audio_buffer),
                        sample_rate=16000
                    )
                    
                    if text.strip():
                        result = {
                            "type": "transcription",
                            "sessionId": self.session_id,
                            "text": text,
                            "confidence": confidence,
                            "timestamp": time.time(),
                            "final": True
                        }
                        
                        await self.websocket.send_json(result)
                        # Final transcription sent (debug only)
                except WebSocketDisconnect:
                    # WebSocket disconnected (debug only)
                    self.is_active = False
                except Exception as e:
                    logger.error(f"Error flushing buffer for session {self.session_id}: {e}")
        
        # Clear buffers
        self.audio_buffer.clear()
        self.speech_buffer.clear()
        
        # Reset cutoff timestamp to allow new chunks
        self.process_until_timestamp = None
        
        # Log flush completion - immediate
        timestamp = time.strftime("%H:%M:%S", time.localtime())
        session_short = self.session_id[:8] if self.session_id else "unknown"
        print(f"[{timestamp}] [{session_short}] ✅ Flush done", flush=True)


class StreamingManager:
    """Manages multiple streaming sessions"""
    
    def __init__(self):
        self.sessions: Dict[str, StreamingSession] = {}
        
    def create_session(self, session_id: str, websocket: WebSocket) -> StreamingSession:
        """Create a new streaming session"""
        session = StreamingSession(session_id, websocket)
        self.sessions[session_id] = session
        timestamp = time.strftime("%H:%M:%S", time.localtime())
        session_short = session_id[:8] if session_id else "unknown"
        print(f"[{timestamp}] [{session_short}] 🟢 Session started", flush=True)
        return session
    
    def get_session(self, session_id: str) -> Optional[StreamingSession]:
        """Get an existing session"""
        return self.sessions.get(session_id)
    
    def remove_session(self, session_id: str):
        """Remove a session"""
        if session_id in self.sessions:
            del self.sessions[session_id]
            timestamp = time.strftime("%H:%M:%S", time.localtime())
            session_short = session_id[:8] if session_id else "unknown"
            print(f"[{timestamp}] [{session_short}] 🔴 Session closed", flush=True)
    
    async def handle_websocket(self, websocket: WebSocket):
        """Handle WebSocket connection"""
        session_id = None
        session = None
        
        try:
            # Accept the connection first
            await websocket.accept()
            logger.debug("WebSocket connection accepted")
            
            # Wait for initial connection message
            initial_message = await websocket.receive_text()
            data = json.loads(initial_message)
            
            if data.get("type") == "connect":
                session_id = data.get("sessionId")
                if not session_id:
                    session_id = str(uuid.uuid4())
                
                session = self.create_session(session_id, websocket)
                
                # Send connection confirmation
                await websocket.send_json({
                    "type": "connected",
                    "sessionId": session_id
                })
                
                # WebSocket connected (debug only)
                
                # Listen for audio chunks
                while True:
                    try:
                        message = await websocket.receive_text()
                        data = json.loads(message)
                        
                        if data.get("type") == "audio_chunk":
                            if not session:
                                logger.warning(f"Received audio chunk but no session exists for {session_id}")
                                continue
                            audio_data_b64 = data.get("chunk")
                            chunk_timestamp = data.get("timestamp")  # Get timestamp if provided
                            if audio_data_b64:
                                audio_data = base64.b64decode(audio_data_b64)
                                await session.process_audio_chunk(audio_data, chunk_timestamp)
                        
                        elif data.get("type") == "flush_buffer":
                            if not session:
                                logger.warning(f"Received flush_buffer but no session exists for {session_id}")
                                continue
                            cutoff_timestamp = data.get("cutoffTimestamp")
                            grace_period_ms = data.get("gracePeriodMs", 500)  # Default 500ms
                            
                            if cutoff_timestamp:
                                # Flush with timestamp cutoff
                                await session.flush_buffer_with_cutoff(cutoff_timestamp, grace_period_ms)
                            else:
                                # Fallback to regular flush
                                await session.flush_buffer()
                            
                            # Send confirmation
                            await websocket.send_json({
                                "type": "buffer_flushed",
                                "sessionId": session_id
                            })
                            # Buffer flushed (debug only)
                        
                        elif data.get("type") == "end_stream":
                            if session:
                                await session.flush_buffer()
                                await websocket.send_json({
                                    "type": "stream_ended",
                                    "sessionId": session_id
                                })
                            # Close with normal closure code (1000)
                            await websocket.close(code=1000, reason="Stream ended normally")
                            break
                            
                    except WebSocketDisconnect:
                        # WebSocket disconnected (debug only)
                        break
                    except json.JSONDecodeError as e:
                        logger.error(f"Invalid JSON received from session {session_id}: {e}")
                    except Exception as e:
                        logger.error(f"Error handling message from session {session_id}: {e}", exc_info=True)
                        # If we can't receive messages, the connection is likely broken
                        break
            else:
                logger.warning(f"Expected 'connect' message, got: {data.get('type')}")
                await websocket.close(code=1008, reason="Invalid initial message")
                        
        except WebSocketDisconnect:
            # WebSocket disconnected (debug only)
            pass
        except Exception as e:
            logger.error(f"WebSocket error: {e}", exc_info=True)
            try:
                await websocket.close(code=1011, reason="Internal server error")
            except:
                pass
        finally:
            if session_id:
                try:
                    if session:
                        await session.flush_buffer()
                except Exception as e:
                    logger.error(f"Error flushing buffer for session {session_id}: {e}")
                self.remove_session(session_id)
                # WebSocket disconnected (debug only)


# Global streaming manager
streaming_manager = StreamingManager()
