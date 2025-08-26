# Backend Phase 005: Session Management

## Objectives
Implement session endpoints with OpenAI SQLiteSession integration and real-time Socket.io streaming.

## Implementation Tasks
1. POST /projects/{id}/sessions - Start/retrieve session
2. POST /sessions/{id}/messages - Send to VibeCoder with real-time updates
3. DELETE /sessions/{id} - Clear OpenAI session
4. GET /messages/{id}/full - Return complete OpenAI response
5. Store FULL responses with session context
6. Stream token usage via Socket.io in real-time
7. Broadcast vibecode responses immediately

## Acceptance Criteria
- ✅ Sessions link to OpenAI SQLiteSession via openai_session_key
- ✅ Multiple messages maintain conversation context
- ✅ Node-specific sessions isolated from global
- ✅ Full OpenAI response stored as JSON
- ✅ Session ID included in all responses
- ✅ Token usage streamed via Socket.io 'token_usage' events
- ✅ Vibecode responses broadcast via 'vibecode_response' events
- ✅ Real-time updates for each agent iteration

## Real-time Streaming Implementation
```python
# In POST /sessions/{id}/messages endpoint
async def send_message(session_id: str, request: MessageRequest):
    # Run vibecoder with real-time token streaming
    result = await vibecode_service.vibecode(...)
    
    # Stream token usage immediately
    await socketio_manager.emit_to_room(
        f"project_{session.project_id}",
        "token_usage",
        {
            "prompt_tokens": result.usage.prompt_tokens,
            "completion_tokens": result.usage.completion_tokens,
            "total_tokens": result.usage.total_tokens,
            "model": result.model,
            "agent": "vibecoder",
            "iteration": 1
        }
    )
    
    # Broadcast vibecode response
    await socketio_manager.emit_to_room(
        f"project_{session.project_id}",
        "vibecode_response",
        {
            "patch": result.get("patch"),
            "session_id": session_id,
            "token_usage": token_usage
        }
    )
```

## Expected Test Results (Pseudocode)
```python
def test_session_with_socket_streaming():
    # Connect Socket.io client
    # Join project room
    # Send message via HTTP
    # Verify Socket.io receives 'token_usage' event
    # Verify Socket.io receives 'vibecode_response' event
    # Check session_id matches

def test_session_persistence():
    # Start session → get session_id
    # Send first message "Create a triage agent" → verify session_id
    # Send second message "Make it Spanish" 
    # GET messages → verify count=2 and context maintained

def test_full_response_storage():
    # Send message → get message_id
    # GET /messages/{id}/full → verify has tool_calls, usage, model

## Validation Requirements
- Run pytest + python-socketio integration tests for session management with streaming
- Test with curl: create sessions, send messages, verify Socket.io broadcasts
- Test with Socket.io client: connect, subscribe, verify real-time token usage
- Save test evidence in backend/validated_test_evidence/phase-005/

## Deliverables
- [ ] Session endpoints in app/api/sessions.py with Socket.io integration
- [ ] Message storage with full OpenAI response and token usage
- [ ] Real-time Socket.io broadcasting in send_message endpoint
- [ ] Tests in tests/integration/test_phase_005_sessions.py
- [ ] Validation evidence in backend/validated_test_evidence/phase-005/