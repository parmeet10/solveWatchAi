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
        self.audio_buffer = bytearray()  # Buffer for audio chunks (already filtered by client VAD)
        self.is_active = True
        self.last_transcription_time = 0
        self.chunk_interval = 1.5  # Process chunks every 1.5 seconds (faster feedback)
        self.silence_timeout = 0.8  # Trigger transcription after 0.8s of silence (no chunks received)
        self.last_chunk_time = time.time()  # Track when last chunk was received
        self.process_until_timestamp = None  # Timestamp cutoff for flush operations
        self.silence_check_task = None  # Background task for silence detection
        
    async def process_audio_chunk(self, audio_data: bytes, chunk_timestamp: Optional[float] = None):
        """Process incoming audio chunk (already filtered by client VAD)"""
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
            
            # Add chunk to buffer (client VAD already filtered out silence)
            self.audio_buffer.extend(audio_data)
            chunk_size = len(audio_data)
            self.last_chunk_time = time.time()  # Update last chunk timestamp
            
            # Log chunk received - immediate
            buffer_kb = len(self.audio_buffer) / 1024
            log_chunk(self.session_id, chunk_size, "RECEIVED", f"buf:{buffer_kb:.1f}KB")
            
            # Process if we have enough accumulated audio (1.5 seconds at 16kHz = 48000 samples = 96000 bytes for 16-bit)
            min_chunk_size = int(16000 * 2 * self.chunk_interval)  # 16kHz * 2 bytes * seconds
            
            if len(self.audio_buffer) >= min_chunk_size:
                # Cancel silence check since we're processing due to threshold
                if self.silence_check_task and not self.silence_check_task.done():
                    self.silence_check_task.cancel()
                buffer_kb = len(self.audio_buffer) / 1024
                print(f"[{time.strftime('%H:%M:%S', time.localtime())}] [{self.session_id[:8]}] THRESHOLD | buf:{buffer_kb:.1f}KB", flush=True)
                await self._process_audio_buffer()
            
            # Cancel any existing silence check and start new one
            if self.silence_check_task and not self.silence_check_task.done():
                self.silence_check_task.cancel()
            self.silence_check_task = asyncio.create_task(self._check_silence_timeout())
                
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
    
    async def _check_silence_timeout(self):
        """Check if silence timeout has been reached (no chunks received)"""
        try:
            await asyncio.sleep(self.silence_timeout)
            # Check if enough time has passed since last chunk and buffer has content
            time_since_last_chunk = time.time() - self.last_chunk_time
            if time_since_last_chunk >= self.silence_timeout and len(self.audio_buffer) > 0:
                # Silence detected - process accumulated buffer
                min_bytes = int(16000 * 2 * 0.25)  # Minimum 250ms
                if len(self.audio_buffer) >= min_bytes:
                    buffer_kb = len(self.audio_buffer) / 1024
                    timestamp = time.strftime("%H:%M:%S", time.localtime())
                    session_short = self.session_id[:8] if self.session_id else "unknown"
                    print(f"[{timestamp}] [{session_short}] SILENCE | buf:{buffer_kb:.1f}KB (silence detected)", flush=True)
                    await self._process_audio_buffer()
        except asyncio.CancelledError:
            # Task was cancelled (new chunk arrived or processing triggered) - this is expected
            pass
        except Exception as e:
            logger.error(f"Error in silence check for session {self.session_id}: {e}")
    
    async def _process_audio_buffer(self):
        """Process accumulated audio buffer (already filtered by client VAD)"""
        if len(self.audio_buffer) == 0:
            return
        
        try:
            buffer_size = len(self.audio_buffer)
            buffer_kb = buffer_size / 1024
            
            # Minimum audio duration check (250ms at 16kHz = 8000 bytes)
            min_bytes = 16000 * 2 * 0.25  # 16kHz * 2 bytes * 0.25 seconds
            if buffer_size < min_bytes:
                # Buffer too small, wait for more data
                return
            
            # Process the audio buffer
            chunk_to_process = bytes(self.audio_buffer)
            self.audio_buffer.clear()
            
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
            logger.error(f"Error processing audio buffer for session {self.session_id}: {e}")
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
        # Cancel silence check task
        if self.silence_check_task and not self.silence_check_task.done():
            self.silence_check_task.cancel()
            try:
                await self.silence_check_task
            except asyncio.CancelledError:
                pass
        
        # Process any remaining audio in the buffer
        if len(self.audio_buffer) > 0:
            await self._process_audio_buffer()
        
        # Also check if there's any remaining audio (minimum 250ms)
        min_bytes = 16000 * 2 * 0.25  # 250ms at 16kHz
        if len(self.audio_buffer) >= min_bytes:
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
        
        # Cancel silence check task
        if self.silence_check_task and not self.silence_check_task.done():
            self.silence_check_task.cancel()
            try:
                await self.silence_check_task
            except asyncio.CancelledError:
                pass
        
        # Set cutoff timestamp
        self.process_until_timestamp = cutoff_timestamp
        
        # Wait for grace period to catch in-transit packets
        grace_period_seconds = grace_period_ms / 1000.0
        await asyncio.sleep(grace_period_seconds)
        
        # Grace period ended, processing remaining buffers (debug only)
        
        # Process any remaining audio in the buffer (only chunks before cutoff)
        if len(self.audio_buffer) > 0:
            await self._process_audio_buffer()
        
        # Also check if there's any remaining audio (minimum 250ms)
        min_bytes = 16000 * 2 * 0.25  # 250ms at 16kHz
        if len(self.audio_buffer) >= min_bytes:
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
        
        # Clear buffer
        self.audio_buffer.clear()
        
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
