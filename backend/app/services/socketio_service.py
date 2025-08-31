import asyncio
import contextlib
import logging
from datetime import datetime

import socketio

logger = logging.getLogger(__name__)


class SocketIOManager:
    def __init__(self) -> None:
        self.sio = socketio.AsyncServer(
            async_mode="asgi",
            cors_allowed_origins="*",
            logger=True,
            engineio_logger=True,
            ping_timeout=60,
            ping_interval=25,
        )
        self.app: socketio.ASGIApp | None = None
        self.connections: int = 0
        self.project_rooms: dict[str, set[str]] = {}
        self.heartbeat_task: asyncio.Task | None = None

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
            logger.info(
                f"Client connected: {sid}, total connections: {self.connections}"
            )
            await self.sio.emit("connected", {"sid": sid}, room=sid)

        @self.sio.event
        async def disconnect(sid: str) -> None:
            self.connections -= 1
            logger.info(
                f"Client disconnected: {sid}, total connections: {self.connections}"
            )

            # Remove from all project rooms
            for project_id, sids in self.project_rooms.items():
                if sid in sids:
                    sids.discard(sid)
                    logger.info(f"Removed {sid} from project room {project_id}")

        @self.sio.event
        async def subscribe(sid: str, data: dict) -> None:
            project_id = data.get("project_id")
            if not project_id:
                await self.sio.emit(
                    "error", {"message": "project_id required"}, room=sid
                )
                return

            # Add to project room
            await self.sio.enter_room(sid, f"project_{project_id}")

            # Track in our rooms dict
            if project_id not in self.project_rooms:
                self.project_rooms[project_id] = set()
            self.project_rooms[project_id].add(sid)

            logger.info(f"Client {sid} subscribed to project {project_id}")
            await self.sio.emit(
                "subscribed", {"project_id": project_id, "sid": sid}, room=sid
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
        message_type: str = "stream_event",
        content: str | None = None,
        # Streaming fields
        stream_event_type: str | None = None,
        stream_sequence: int | None = None,
        event_data: dict | None = None,
        # Tool tracking
        tool_calls: list[dict] | None = None,
        tool_outputs: list[dict] | None = None,
        handoffs: list[dict] | None = None,
        # Token usage (typed)
        usage_input_tokens: int | None = None,
        usage_output_tokens: int | None = None,
        usage_total_tokens: int | None = None,
        usage_cached_tokens: int | None = None,
        usage_reasoning_tokens: int | None = None,
        # Legacy fields
        agent: str | None = None,
        iteration: int | None = None,
        token_usage: dict | None = None,
        patch_preview: str | None = None,
    ) -> None:
        """Emit comprehensive conversation message event with all ConversationMessage fields"""
        data = {
            # Core fields
            "message_id": message_id,
            "session_id": session_id,
            "role": role,
            "message_type": message_type,
            "content": content,
            # Streaming metadata
            "stream_event_type": stream_event_type,
            "stream_sequence": stream_sequence,
            "event_data": event_data,
            # Tool tracking
            "tool_calls": tool_calls,
            "tool_outputs": tool_outputs,
            "handoffs": handoffs,
            # Token usage (typed)
            "usage_input_tokens": usage_input_tokens,
            "usage_output_tokens": usage_output_tokens,
            "usage_total_tokens": usage_total_tokens,
            "usage_cached_tokens": usage_cached_tokens,
            "usage_reasoning_tokens": usage_reasoning_tokens,
            # Legacy fields for backward compatibility
            "agent": agent,
            "iteration": iteration,
            "token_usage": token_usage,
            "patch_preview": patch_preview,
            # Timestamp
            "created_at": datetime.now().isoformat(),
        }
        await self.emit_to_project(project_id, "conversation_message", data)

    async def emit_code_changed(self, project_id: str, new_code: str) -> None:
        """Emit code change event"""
        await self.emit_to_project(
            project_id, "code_changed", {"project_id": project_id, "new_code": new_code}
        )

    async def emit_test_completed(
        self,
        diff_id: str,
        project_id: str,
        test_name: str,
        status: str,
        output: str | None,
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
        self, session_id: str, project_id: str, message_id: str | None, usage: dict
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
            with contextlib.suppress(asyncio.CancelledError):
                await self.heartbeat_task
            self.heartbeat_task = None
            logger.info("Heartbeat task stopped")


# Global instance
socketio_manager = SocketIOManager()
