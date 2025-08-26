# Backend Phase 002: Socket.io & Real-time

## Objectives
Implement Socket.io for real-time updates and broadcasts (consistent with frontend).
Provide early so frontend can connect and develop in parallel.

## Implementation Tasks
1. Socket.io server setup with python-socketio
2. Subscribe to project updates via rooms
3. Heartbeat events every 30 seconds for debug visibility
4. Connection tracking and management
5. Broadcast infrastructure for later phases

## Acceptance Criteria
- ✅ Clients can join project room via Socket.io
- ✅ Heartbeat events sent every 30 seconds with connection count
- ✅ Frontend logs heartbeats for debug visibility
- ✅ Socket.io handles reconnection automatically
- ✅ Disconnected clients cleaned up from rooms
- ✅ Connection tracking (increment/decrement on connect/disconnect)
- ✅ Ready for future vibecode/token usage events

## Integration Test Script (httpx + python-socketio client)
```python
# backend/tests/integration/test_phase_002_socketio.py
import httpx
import socketio
import json
import asyncio

async def test_socketio_broadcast():
    """Test that multiple clients receive broadcasts"""
    async with httpx.AsyncClient(base_url="http://localhost:8000") as client:
        # Create project
        project = await client.post("/projects", json={"name": "WS Test"})
        project_id = project.json()["id"]
        
        # Create session
        session = await client.post(f"/projects/{project_id}/sessions")
        session_id = session.json()["session_id"]
        
        # Connect two Socket.io clients
        sio1 = socketio.AsyncClient()
        sio2 = socketio.AsyncClient()
        await sio1.connect(f"http://localhost:8000", socketio_path="/socket.io/")
        await sio2.connect(f"http://localhost:8000", socketio_path="/socket.io/")
        
        # Join project room
        await sio1.emit('subscribe', {'project_id': project_id})
        await sio2.emit('subscribe', {'project_id': project_id})
        
        # Send vibecode message via HTTP
        response = await client.post(f"/sessions/{session_id}/messages", json={
            "prompt": "Add a new feature"
        })
        
        # Both clients should receive broadcast
        msg1 = json.loads(await asyncio.wait_for(ws1.recv(), timeout=5))
        msg2 = json.loads(await asyncio.wait_for(ws2.recv(), timeout=5))
        
        assert msg1["type"] == "vibecode_response"
        assert msg1["patch"] is not None
        assert msg1["session_id"] == session_id
        assert msg1["token_usage"] is not None  # Verify REAL usage data
        
        assert msg2 == msg1  # Both clients get same message
        
        await sio1.disconnect()
        await sio2.disconnect()

async def test_test_result_streaming():
    """Test real-time test result updates"""
    # Create project and test
    # Connect Socket.io client
    # Start test run async
    # Collect streaming messages until test_completed
    # Verify got test_started and test_completed events

async def test_disconnection_handling():
    """Test that disconnected clients are cleaned up"""
    # Create project
    # Connect Socket.io and immediately disconnect
    # Verify server reports 0 active connections
```

## Validation Requirements
- Write pytest + python-socketio integration tests for real-time broadcasting
- Test manually with Socket.io client: connect, subscribe to rooms, verify events received
- Test with curl: create projects/sessions, send messages, confirm Socket.io broadcasts
- Verify token usage data is streamed in real-time via 'token_usage' events
- Test disconnection handling and room cleanup
- Save test evidence in backend/validated_test_evidence/phase-002/

## Deliverables
- [ ] SocketIOManager in app/services/socketio_service.py
- [ ] Socket.io event handlers in app/api/socketio_events.py
- [ ] Integration tests in backend/tests/integration/test_phase_002_socketio.py
- [ ] Validation evidence in backend/validated_test_evidence/phase-002/