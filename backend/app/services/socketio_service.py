import asyncio
import logging
from datetime import datetime
from typing import Dict, Set, Optional
import socketio

logger = logging.getLogger(__name__)


class SocketIOManager:
    def __init__(self) -> None:
        self.sio = socketio.AsyncServer(
            async_mode="asgi",
            cors_allowed_origins="*",
            logger=False,
            engineio_logger=False,
        )
        self.app: Optional[socketio.ASGIApp] = None
        self.connections: int = 0
        self.project_rooms: Dict[str, Set[str]] = {}
        self.heartbeat_task: Optional[asyncio.Task] = None
        
    def create_app(self, app) -> socketio.ASGIApp:
        """Wrap FastAPI app with Socket.io"""
        self.app = socketio.ASGIApp(self.sio, app)
        self._register_handlers()
        return self.app
    
    def _register_handlers(self) -> None:
        """Register Socket.io event handlers"""
        
        @self.sio.event
        async def connect(sid: str, environ: dict) -> None:
            self.connections += 1
            logger.info(f"Client connected: {sid}, total connections: {self.connections}")
            await self.sio.emit("connected", {"sid": sid}, room=sid)
            
        @self.sio.event
        async def disconnect(sid: str) -> None:
            self.connections -= 1
            logger.info(f"Client disconnected: {sid}, total connections: {self.connections}")
            
            # Remove from all project rooms
            for project_id, sids in self.project_rooms.items():
                if sid in sids:
                    sids.discard(sid)
                    logger.info(f"Removed {sid} from project room {project_id}")
        
        @self.sio.event
        async def subscribe(sid: str, data: dict) -> None:
            project_id = data.get("project_id")
            if not project_id:
                await self.sio.emit("error", {"message": "project_id required"}, room=sid)
                return
                
            # Add to project room
            self.sio.enter_room(sid, f"project_{project_id}")
            
            # Track in our rooms dict
            if project_id not in self.project_rooms:
                self.project_rooms[project_id] = set()
            self.project_rooms[project_id].add(sid)
            
            logger.info(f"Client {sid} subscribed to project {project_id}")
            await self.sio.emit(
                "subscribed", 
                {"project_id": project_id, "sid": sid}, 
                room=sid
            )
    
    async def emit_to_project(self, project_id: str, event: str, data: dict) -> None:
        """Emit event to all clients subscribed to a project"""
        room = f"project_{project_id}"
        await self.sio.emit(event, data, room=room)
        logger.info(f"Emitted {event} to project room {project_id}")
    
    async def emit_conversation_message(
        self, 
        session_id: str,
        project_id: str,
        message_id: str,
        role: str,
        agent: Optional[str],
        content: str,
        patch_preview: Optional[str],
        iteration: int,
        token_usage: Optional[dict]
    ) -> None:
        """Emit conversation message event"""
        data = {
            "message_id": message_id,
            "session_id": session_id,
            "role": role,
            "agent": agent,
            "content": content,
            "patch_preview": patch_preview,
            "iteration": iteration,
            "token_usage": token_usage,
            "created_at": datetime.now().isoformat(),
        }
        await self.emit_to_project(project_id, "conversation_message", data)
    
    async def emit_code_changed(self, project_id: str, new_code: str) -> None:
        """Emit code change event"""
        await self.emit_to_project(
            project_id, 
            "code_changed",
            {"project_id": project_id, "new_code": new_code}
        )
    
    async def emit_test_completed(
        self, 
        diff_id: str,
        project_id: str,
        test_name: str,
        status: str,
        output: Optional[str]
    ) -> None:
        """Emit test completion event"""
        data = {
            "diff_id": diff_id,
            "test_name": test_name,
            "status": status,
            "output": output,
        }
        await self.emit_to_project(project_id, "test_completed", data)
    
    async def emit_token_usage(
        self,
        session_id: str,
        project_id: str,
        message_id: Optional[str],
        usage: dict
    ) -> None:
        """Emit token usage event"""
        data = {
            "session_id": session_id,
            "message_id": message_id,
            "usage": usage,
            "timestamp": datetime.now().isoformat(),
        }
        await self.emit_to_project(project_id, "token_usage", data)
    
    async def start_heartbeat(self) -> None:
        """Start heartbeat task"""
        if self.heartbeat_task:
            return
            
        async def heartbeat_loop():
            while True:
                await asyncio.sleep(30)
                data = {
                    "server_time": datetime.now().isoformat(),
                    "status": "alive",
                    "connections": self.connections,
                }
                await self.sio.emit("heartbeat", data)
                logger.info(f"Heartbeat sent: {self.connections} connections")
        
        self.heartbeat_task = asyncio.create_task(heartbeat_loop())
        logger.info("Heartbeat task started")
    
    async def stop_heartbeat(self) -> None:
        """Stop heartbeat task"""
        if self.heartbeat_task:
            self.heartbeat_task.cancel()
            try:
                await self.heartbeat_task
            except asyncio.CancelledError:
                pass
            self.heartbeat_task = None
            logger.info("Heartbeat task stopped")


# Global instance
socketio_manager = SocketIOManager()