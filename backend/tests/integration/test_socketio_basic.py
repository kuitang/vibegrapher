import asyncio
import pytest
import socketio
import threading
import time
from fastapi import FastAPI
from fastapi.testclient import TestClient
import uvicorn
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@pytest.mark.asyncio
async def test_basic_socketio_room_messaging():
    """Test basic Socket.io room messaging functionality"""
    
    # Create a simple FastAPI app with Socket.io
    app = FastAPI()
    
    # Import socketio here to avoid conflicts
    import socketio as siolib
    
    # Create Socket.io server
    sio = siolib.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
    app.mount('/socket.io/', siolib.ASGIApp(sio))
    
    # Room tracking
    rooms = {}
    
    @sio.event
    async def connect(sid, environ):
        logger.info(f"Client connected: {sid}")
        await sio.emit('connected', {'sid': sid})
    
    @sio.event
    async def disconnect(sid):
        logger.info(f"Client disconnected: {sid}")
        # Clean up rooms
        for room_name, sids in list(rooms.items()):
            if sid in sids:
                sids.remove(sid)
                logger.info(f"Removed {sid} from room {room_name}")
    
    @sio.event
    async def subscribe(sid, data):
        project_id = data.get('project_id')
        if not project_id:
            await sio.emit('error', {'message': 'project_id required'})
            return
            
        # Add to project room
        room_name = f"project_{project_id}"
        await sio.enter_room(sid, room_name)
        
        # Track in our rooms dict
        if project_id not in rooms:
            rooms[project_id] = set()
        rooms[project_id].add(sid)
        
        logger.info(f"Client {sid} subscribed to project {project_id} (room: {room_name})")
        await sio.emit('subscribed', {'project_id': project_id, 'sid': sid})
    
    @sio.event
    async def test_message(sid, data):
        # Echo back to sender only
        logger.info(f"Echoing test message to {sid}: {data}")
        await sio.emit('test_reply', data, room=sid)
    
    async def emit_to_project(project_id: str, event: str, data: dict):
        """Emit event to all clients subscribed to a project"""
        room = f"project_{project_id}"
        logger.info(f"Emitting {event} to room {room}")
        await sio.emit(event, data, room=room)
        logger.info(f"Emitted {event} to project room {project_id}")
    
    # Start server in a separate thread
    config = uvicorn.Config(app, host="127.0.0.1", port=0, log_level="info")
    server = uvicorn.Server(config)
    
    # Run server in background
    def run_server():
        server.run()
    
    thread = threading.Thread(target=run_server, daemon=True)
    thread.start()
    
    # Wait for server to start
    start_time = time.time()
    while not server.started and (time.time() - start_time) < 10:
        await asyncio.sleep(0.1)
    
    if not server.started:
        pytest.fail("Server failed to start")
    
    # Get the actual port
    port = server.servers[0].sockets[0].getsockname()[1]
    url = f"http://127.0.0.1:{port}"
    logger.info(f"Test server started on {url}")
    
    # Connect client
    client_sio = siolib.AsyncClient()
    received_messages = []
    
    @client_sio.event
    async def connect():
        logger.info("Client connected")
    
    @client_sio.event
    async def disconnect():
        logger.info("Client disconnected")
    
    @client_sio.event
    async def connected(data):
        logger.info(f"Connected event: {data}")
    
    @client_sio.event
    async def subscribed(data):
        logger.info(f"Subscribed event: {data}")
    
    @client_sio.event
    async def test_reply(data):
        logger.info(f"Test reply: {data}")
        received_messages.append(data)
    
    @client_sio.event
    async def conversation_message(data):
        logger.info(f"Conversation message: {data}")
        received_messages.append(data)
    
    # Connect to server
    await client_sio.connect(url)
    
    # Subscribe to a project room
    project_id = "test-project-123"
    await client_sio.emit("subscribe", {"project_id": project_id})
    
    # Wait a bit for subscription to process
    await asyncio.sleep(1)
    
    # Emit a message to the project room
    await emit_to_project(project_id, "conversation_message", {"test": "message"})
    
    # Wait for messages
    await asyncio.sleep(1)
    
    # Check if we received the message
    assert len(received_messages) == 1, f"Expected 1 message, but received {len(received_messages)}. Messages: {received_messages}"
    
    # Disconnect client
    await client_sio.disconnect()
    
    # Stop server
    server.should_exit = True
    thread.join(timeout=5)