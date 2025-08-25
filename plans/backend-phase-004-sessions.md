# Backend Phase 004: Session Management

## Objectives
Implement session endpoints with OpenAI SQLiteSession integration.

## Implementation Tasks
1. POST /projects/{id}/sessions - Start/retrieve session
2. POST /sessions/{id}/messages - Send to VibeCoder
3. DELETE /sessions/{id} - Clear OpenAI session
4. GET /messages/{id}/full - Return complete OpenAI response
5. Store FULL responses with trace_id

## Acceptance Criteria
- ✅ Sessions link to OpenAI SQLiteSession via openai_session_key
- ✅ Multiple messages maintain conversation context
- ✅ Node-specific sessions isolated from global
- ✅ Full OpenAI response stored as JSON
- ✅ trace_id included in all responses

## Expected Test Results (Pseudocode)
```python
def test_session_persistence():
    # Start session → get session_id
    # Send first message "Create a triage agent" → verify trace_id
    # Send second message "Make it Spanish" 
    # GET messages → verify count=2 and context maintained

def test_full_response_storage():
    # Send message → get message_id
    # GET /messages/{id}/full → verify has tool_calls, usage, model

def test_node_session_isolation():
    # Create global session and node session
    # Send messages to each → verify isolation
    global_session = client.post(f"/projects/{project_id}/sessions")
    global_id = global_session.json()["session_id"]
    
    # Node session
    node_session = client.post(f"/projects/{project_id}/sessions",
                               json={"node_id": "agent1"})
    node_id = node_session.json()["session_id"]
    
    # Messages should be isolated
    client.post(f"/sessions/{global_id}/messages",
                json={"prompt": "global message"})
    client.post(f"/sessions/{node_id}/messages",
                json={"prompt": "node message"})
    
    global_msgs = client.get(f"/sessions/{global_id}/messages")
    assert len(global_msgs.json()) == 1
    assert "global" in global_msgs.json()[0]["content"]
```

## Validation Script
```bash
#!/bin/bash
OUTPUT_DIR="validated_test_evidence/phase-004"
mkdir -p $OUTPUT_DIR

# Run session tests
pytest tests/integration/test_phase_004_sessions.py -v > $OUTPUT_DIR/test_output.log 2>&1

# Test session flow
PROJECT_ID=$(curl -X POST http://localhost:8000/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "Session Test"}' | jq -r .id)

# Create and use session
SESSION_ID=$(curl -X POST http://localhost:8000/projects/${PROJECT_ID}/sessions | jq -r .session_id)

# Send messages
curl -X POST http://localhost:8000/sessions/${SESSION_ID}/messages \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create agent"}' > $OUTPUT_DIR/msg1.json

curl -X POST http://localhost:8000/sessions/${SESSION_ID}/messages \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Add Spanish"}' > $OUTPUT_DIR/msg2.json

# Get full response
MSG_ID=$(cat $OUTPUT_DIR/msg1.json | jq -r .message_id)
curl http://localhost:8000/messages/${MSG_ID}/full > $OUTPUT_DIR/full_response.json

echo "Phase 004 validation complete"
```

## Deliverables
- [ ] Session endpoints in app/api/sessions.py
- [ ] Message storage with full OpenAI response
- [ ] Tests in tests/integration/test_phase_004_sessions.py
- [ ] Validation evidence in validated_test_evidence/phase-004/