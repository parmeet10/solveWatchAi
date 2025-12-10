"""
WebSocket streaming handler for real-time transcription
"""
import asyncio
import json
import logging
import base64
import uuid
from typing import Dict, Optional
from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect
from transcription import transcription_service

logger = logging.getLogger(__name__)


class StreamingSession:
    """Manages a single streaming transcription session"""
    
    def __init__(self, session_id: str, websocket: WebSocket):
        self.session_id = session_id
        self.websocket = websocket
        self.audio_buffer = bytearray()
        self.is_active = True
        self.last_transcription_time = 0
        self.chunk_interval = 3  # Process chunks every 3 seconds
        self.chunks_received = 0
        
    async def process_audio_chunk(self, audio_data: bytes):
        """Process incoming audio chunk"""
        try:
            self.audio_buffer.extend(audio_data)
            self.chunks_received += 1
            
            # Process chunk if we have enough data (3 seconds at 16kHz = 48000 samples = 96000 bytes for 16-bit)
            min_chunk_size = 16000 * 2 * self.chunk_interval  # 16kHz * 2 bytes * seconds
            
            logger.debug(f"Session {self.session_id}: Received chunk {self.chunks_received}, buffer size: {len(self.audio_buffer)} bytes, need: {min_chunk_size} bytes")
            
            if len(self.audio_buffer) >= min_chunk_size:
                chunk_to_process = bytes(self.audio_buffer[:min_chunk_size])
                self.audio_buffer = self.audio_buffer[min_chunk_size:]
                
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
                        "timestamp": asyncio.get_event_loop().time()
                    }
                    
                    await self.websocket.send_json(result)
                    logger.info(f"Session {self.session_id}: Transcribed chunk - {text[:50]}...")
                    
        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected while processing chunk for session {self.session_id}")
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
    
    async def flush_buffer(self):
        """Flush remaining audio buffer"""
        if len(self.audio_buffer) > 16000:  # At least 1 second of audio
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
                        "timestamp": asyncio.get_event_loop().time(),
                        "final": True
                    }
                    
                    await self.websocket.send_json(result)
                    logger.info(f"Session {self.session_id}: Final transcription - {text[:50]}...")
            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected while flushing buffer for session {self.session_id}")
                self.is_active = False
            except Exception as e:
                logger.error(f"Error flushing buffer for session {self.session_id}: {e}")
        
        self.audio_buffer.clear()


class StreamingManager:
    """Manages multiple streaming sessions"""
    
    def __init__(self):
        self.sessions: Dict[str, StreamingSession] = {}
        
    def create_session(self, session_id: str, websocket: WebSocket) -> StreamingSession:
        """Create a new streaming session"""
        session = StreamingSession(session_id, websocket)
        self.sessions[session_id] = session
        logger.info(f"Created streaming session: {session_id}")
        return session
    
    def get_session(self, session_id: str) -> Optional[StreamingSession]:
        """Get an existing session"""
        return self.sessions.get(session_id)
    
    def remove_session(self, session_id: str):
        """Remove a session"""
        if session_id in self.sessions:
            del self.sessions[session_id]
            logger.info(f"Removed streaming session: {session_id}")
    
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
                
                logger.info(f"WebSocket connected: {session_id}")
                
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
                            if audio_data_b64:
                                audio_data = base64.b64decode(audio_data_b64)
                                await session.process_audio_chunk(audio_data)
                        
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
                        logger.info(f"WebSocket disconnected for session {session_id}")
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
            logger.info(f"WebSocket disconnected: {session_id or 'unknown'}")
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
                logger.info(f"WebSocket disconnected: {session_id}")


# Global streaming manager
streaming_manager = StreamingManager()
