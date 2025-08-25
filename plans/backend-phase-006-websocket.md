# Backend Phase 006: Socket.io & Real-time

## Objectives
Implement Socket.io for real-time updates and broadcasts (consistent with frontend).

## Implementation Tasks
1. Socket.io server setup with python-socketio
2. Subscribe to project updates via rooms
3. Broadcast vibecode responses with patches
4. Stream test results as they complete

## Acceptance Criteria
- ✅ Clients can join project room via Socket.io
- ✅ Vibecode responses broadcast to room subscribers
- ✅ Code changes include patch and trace_id
- ✅ Test results stream in real-time
- ✅ Socket.io handles reconnection automatically
- ✅ Disconnected clients cleaned up from rooms

## Integration Test Script (httpx + python-socketio client)
```python
# tests/integration/test_phase_006_socketio.py
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
        assert msg1["trace_id"] == response.json()["trace_id"]
        
        assert msg2 == msg1  # Both clients get same message
        
        await ws1.close()
        await ws2.close()

async def test_test_result_streaming():
    """Test real-time test result updates"""
    # Create project and test
    # Connect Socket.io client
    # Start test run async
    # Collect streaming messages until test_completed
    # Verify got test_started and test_completed events with trace_id

async def test_disconnection_handling():
    """Test that disconnected clients are cleaned up"""
    # Create project
    # Connect Socket.io and immediately disconnect
    # Verify server reports 0 active connections
```

## Validation Script
```bash
#!/bin/bash
OUTPUT_DIR="validated_test_evidence/phase-006"
mkdir -p $OUTPUT_DIR

# Run WebSocket integration tests
pytest tests/integration/test_phase_006_websocket.py -v > $OUTPUT_DIR/test_output.log 2>&1

# Manual WebSocket test with wscat
cat > $OUTPUT_DIR/ws_test.sh << 'EOF'
#!/bin/bash
# Install wscat if needed
npm install -g wscat

# Create project
PROJECT_ID=$(curl -X POST http://localhost:8000/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "Manual WS Test"}' | jq -r .id)

# Connect to WebSocket in background
wscat -c ws://localhost:8000/ws/${PROJECT_ID} > ws_output.log &
WS_PID=$!

# Create session and send message
SESSION_ID=$(curl -X POST http://localhost:8000/projects/${PROJECT_ID}/sessions | jq -r .session_id)

curl -X POST http://localhost:8000/sessions/${SESSION_ID}/messages \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Add feature"}' > http_response.json

sleep 2
kill $WS_PID

# Check if WebSocket received message
if grep -q "vibecode_response" ws_output.log; then
    echo "WebSocket broadcast received"
else
    echo "WebSocket broadcast failed"
fi
EOF

chmod +x $OUTPUT_DIR/ws_test.sh
$OUTPUT_DIR/ws_test.sh > $OUTPUT_DIR/ws_manual.log 2>&1

echo "Phase 006 validation complete"
```

## Deliverables
- [ ] ConnectionManager in app/services/websocket.py
- [ ] WebSocket endpoint in app/api/websocket.py
- [ ] Integration tests in tests/integration/test_phase_006_websocket.py
- [ ] Validation evidence in validated_test_evidence/phase-006/