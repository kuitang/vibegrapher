# Vibegrapher v0 Backend Specification (Simplified)

## Overview
FastAPI backend for vibecoding OpenAI Agents SDK workflows via natural language. No graph visualization in v0.

## Technology Stack
- FastAPI + asyncio
- SQLAlchemy + Alembic
- SQLite (dev) → PostgreSQL (prod)
- OpenAI Agents SDK with SQLiteSession (MUST use gpt-5 series)
- pygit2 for version control
- Deployment: Docker + fly.io (with volumes and Postgres)

## Database Models

```python
# SQLAlchemy models - see spec_datamodel_v0.md for full schemas
# Project (with UNIQUE slug constraint), VibecodeSession, ConversationMessage, TestCase, Diff
# Project.slug: UniqueConstraint, generated from name using slugify
# All models follow the TypeScript interfaces defined in spec_datamodel_v0.md
```

### Key Endpoint: Start Session
```python
# POST /projects/{project_id}/sessions
# Creates OpenAI Agents SQLiteSession with key: project_{slug}_node_{node_id}
# Stored under "media/projects/{project.slug}_conversations.db"
```

### Key Endpoint: Send Message
```python
@app.post("/sessions/{session_id}/messages")
async def send_message(session_id: str, request: MessageRequest):
    # Run vibecoder with OpenAI session (may loop with evaluator)
    # Ensure this Vibecoder is use the SQLiteSession
    # See plans/backend-phase-004-agents.md
    result = await vibecode_service.vibecode(
        session.project_id,
        prompt,
        current_code,  # Pass current code for patching
        session.node_id
    )
    
    # CRITICAL: Store FULL OpenAI response AND extract usage
    token_usage = {...}
    
    message = ConversationMessage(
        session_id=session_id,
        openai_response=result,  # Store everything!
        token_usage=token_usage,  # Track usage separately
        response_id=result.last_response_id,  # Track response_id for audit trail
    )
    
    # Emit vibecode_response with diff_id and trace_id for human review
    await socketio_manager.emit_to_room(
        f"project_{project_id}",
        "vibecode_response",
        {
            "diff_id": result.get("diff_id"),
            "status": result.get("status", "completed")
        }
    )
```

### Human Review Endpoints
```python
# POST /diffs/{diff_id}/review - Approve/reject with feedback
# POST /diffs/{diff_id}/commit - Commit approved diff
#   IMPORTANT: After commit, evaluator context is cleared for next vibecode
#   This ensures fresh evaluation for new changes
# POST /diffs/{diff_id}/refine-message - Get new commit message from evaluator
```

### Other Endpoints
```python
# DELETE /sessions/{session_id} - Clear OpenAI SQLiteSession
# GET /messages/{id}/full - Return full openai_response JSON  
# POST /tests/{id}/run - Run test in sandbox
```


## Configuration
```python
# Settings loaded from .env:
# - database_url, test_database_url, openai_api_key
# - cors_origins="*", media_path="media"
# - host="0.0.0.0" (all interfaces), port=8000

# Logging Configuration (Python logging library):
import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Log ALL OpenAI calls (not in exception handler, always log):
logger.info(f"OPENAI REQUEST: {prompt[:200]}...")
result = await Runner.run(agent, prompt, session)
logger.info(f"OPENAI RESPONSE: {result.final_output[:200]}...")  
logger.info(f"💵 OPENAI TOKENS: prompt={result.context_wrapper.usage.input_tokens}, completion={result.context_wrapper.usage.output_tokens}, total={result.context_wrapper.usage.total_tokens}")

# Only use logger.exception() when you DO catch for a reason:
try:
    # Only catch when you need to add context or retry
    result = await some_operation()
except SpecificError as e:
    logger.exception("Operation failed with context")
    # Then either handle it or re-raise
    raise

# Error Handling: FAIL LOUDLY
# - Let FastAPI handle uncaught exceptions (returns JSON with status 500)
# - FastAPI sends: {"detail": "error message"} on exceptions
# - Frontend must display these errors to user
# - Never catch exceptions just to log - let them bubble up

# Deployment Notes:
# - Backend binds to 0.0.0.0
# - Frontend URLs: localhost:8000 (local), SERVER_IP:8000 (dev), your-api.fly.dev (prod)
```

## Management Commands

```python
# app/management/reset_db.py
# reset_and_seed_database(): Drop tables, recreate, add sample data
# Usage: python -m app.management.reset_db
```

## Testing
- Integration tests: vibecode flow with real OpenAI calls
- Test output style: minimal, factual (no emojis/checkmarks)
- Print: command run, actual result, expected result
- Must show OpenAI token usage in test logs
- E2E test: Create project → Vibecode → Review diff
- Management command test: Reset DB → Verify sample data
- Acceptance criteria: Integration tests using OpenAI must print log output