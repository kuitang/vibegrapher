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

## Core Services (Pseudocode)

### 1. All OpenAI Agents (app/agents/all_agents.py)
```python
# IMPORTANT: MUST use gpt-5 series models - THESE ARE REAL MODELS, NOT PLACEHOLDERS!
# DO NOT USE gpt-4o or older models!
MODEL_CONFIGS = {
    "THINKING_MODEL": "gpt-5-thinking",  # REAL MODEL - USE THIS!
    "SMALL_MODEL": "gpt-5-mini"  # REAL MODEL - USE THIS!
}

# Validation function - apply patch then check syntax in one step
def validate_patch(original: str, patch: str) -> dict:
    """Apply patch to temp copy, then check Python syntax
    Returns: {valid: bool, error?: str} with verbatim error if invalid"""

# Import from agents package
from agents import Agent, Runner, function_tool, SQLiteSession
from pydantic import BaseModel

# Define EvaluationResult Pydantic model - NOW INCLUDES COMMIT MESSAGE
class EvaluationResult(BaseModel):
    approved: bool
    reasoning: str
    commit_message: str  # Suggested commit message if approved

# Tool for VibeCoder - validates and submits patches
@function_tool
async def submit_patch(ctx, patch: str, description: str) -> dict:
    # 1. Get current_code from context
    # 2. Validate patch (applies + syntax check in one step)
    # 3. If invalid, return verbatim error to user
    # 4. If valid, store in ctx.state for evaluator
    # 5. Return {status: "submitted", handoff_to_evaluator: True}

# VibeCoder agent - TWO modes:
# 1. submit_patch() -> triggers evaluator loop
# 2. return text -> direct response to user
vibecoder_agent = Agent(
    name="Vibecoder",
    model=MODEL_CONFIGS["THINKING_MODEL"],
    instructions="Generate patches OR answer questions...",
    tools=[submit_patch]
)

# Evaluator agent
evaluator_agent = Agent(
    name="Evaluator",
    model=MODEL_CONFIGS["THINKING_MODEL"],
    instructions="Evaluate patches and suggest commit messages...",
    output_type=EvaluationResult  # {approved: bool, reasoning: str, commit_message: str}
)

class VibecodeService:
    def __init__(self, socketio_manager):
        self.socketio_manager = socketio_manager
    
    async def vibecode(project_id, prompt, current_code, node_id=None):
        # Create session key with correct format
        session_key = f"project_{project_id}_node_{node_id}" if node_id else f"project_{project_id}"
        db_path = f"media/projects/{project_id}_conversations.db"
        session = SQLiteSession(session_key, db_path)  # MUST use file persistence, not in-memory
        
        for iteration in range(MAX_ITERATIONS=3):
            # Run VibeCoder
            if iteration == 0:
                input = prompt
            else:
                input = f"Rejected. Feedback: {evaluator_feedback}. Original: {prompt}"
            
            # Using OpenAI SDK's Runner - stream token usage in real-time
            vibecoder_result = await Runner.run(
                vibecoder_agent, input, 
                session=session, 
                context={"current_code": current_code}
            )
            
            # CRITICAL: Log and stream token usage immediately
            if hasattr(vibecoder_result, 'usage') and vibecoder_result.usage:
                usage_data = {
                    "prompt_tokens": vibecoder_result.usage.get("prompt_tokens", 0),
                    "completion_tokens": vibecoder_result.usage.get("completion_tokens", 0),
                    "total_tokens": vibecoder_result.usage.get("total_tokens", 0),
                    "model": vibecoder_result.model or "gpt-5-thinking",
                    "agent": "vibecoder",
                    "iteration": iteration + 1
                }
                
                await self.socketio_manager.emit_to_room(
                    f"project_{project_id}",
                    "token_usage",
                    usage_data
                )
            
            # Check if patch submitted
            if not vibecoder_result.context.state.get("submitted_patch"):
                return {"response": vibecoder_result.final_output}  # Text response
            
            # Run Evaluator (also using OpenAI SDK's Runner) - track usage
            evaluator_result = await Runner.run(evaluator_agent, patch_details, session=session)
            
            # CRITICAL: Log evaluator token usage too
            if hasattr(evaluator_result, 'usage') and evaluator_result.usage:
                evaluator_usage = {
                    "prompt_tokens": evaluator_result.usage.get("prompt_tokens", 0),
                    "completion_tokens": evaluator_result.usage.get("completion_tokens", 0),
                    "total_tokens": evaluator_result.usage.get("total_tokens", 0),
                    "model": evaluator_result.model or "gpt-5-thinking",
                    "agent": "evaluator", 
                    "iteration": iteration + 1
                }
                
                await self.socketio_manager.emit_to_room(
                    f"project_{project_id}",
                    "token_usage",
                    evaluator_usage
                )
            
            if evaluator_result.approved:
                # Create Diff record for human review
                diff = await self.create_diff(
                    session_id=session.id,
                    project_id=project_id,
                    diff_content=submitted_patch,
                    commit_message=evaluator_result.commit_message,
                    evaluator_reasoning=evaluator_result.reasoning
                )
                return {
                    "diff_id": diff.id,
                    "diff": submitted_patch,
                    "status": "pending_human_review",
                    "commit_message": evaluator_result.commit_message
                }
            else:
                evaluator_feedback = evaluator_result.reasoning
        
        return {"error": "Max iterations reached"}
```

### 2. Git Service
```python
# GitService: Git operations with diff tracking
class GitService:
    async def get_head_commit() -> str  # Current HEAD SHA
    async def get_current_branch() -> str  # Active branch name
    async def get_code_at_commit(sha: str) -> str  # Code at specific commit
    async def create_temp_branch_with_diff(diff: Diff) -> str  # Preview branch
    async def commit_diff(diff: Diff, message: str) -> str  # Commit approved diff
```

### 3. Socket.io Manager
```python
# SocketIOManager: Handle real-time events
# - emit_to_room: Send events with trace_id to project rooms
# - join_project_room: Subscribe clients to project updates
# - start_heartbeat: Send alive status every 30s for debugging
# Events: vibecode_response, token_usage, heartbeat
```

## Database Models

```python
# SQLAlchemy models - see spec_datamodel_v0.md for full schemas
# Project, VibecodeSession, ConversationMessage, TestCase, Diff
# All models follow the TypeScript interfaces defined in spec_datamodel_v0.md
```

## API Endpoints (Simplified)

```
POST /projects                  - Create project
GET  /projects/:id              - Get project with code
POST /projects/:id/sessions     - Start vibecode session (global or node)
POST /sessions/:id/messages     - Send message to session
GET  /sessions/:id/messages     - Get conversation history
DELETE /sessions/:id            - Clear session
GET  /messages/:id/full         - Get full OpenAI response

# Diff Management (NEW)
GET  /projects/:id/diffs        - All diffs for project
GET  /sessions/:id/diffs        - All diffs for session
GET  /sessions/:id/diffs/pending - Pending review diffs
GET  /diffs/:id                 - Single diff details
GET  /diffs/:id/preview         - Preview applied diff
POST /diffs/:id/review          - Human approve/reject with feedback
POST /diffs/:id/test            - Run tests on uncommitted diff
POST /diffs/:id/commit          - Commit approved diff
POST /diffs/:id/refine-message  - Get new commit message suggestion

# Test Management (Minimal - Only for Diff Testing)
POST /projects/:id/tests        - Create test case for diff validation
GET  /projects/:id/tests        - List available tests
GET  /projects/:id/tests/quick  - Get quick tests (5s timeout) for human review
# Note: No standalone test runner UI - tests only shown in DiffReviewModal

```

### Key Endpoint: Start Session
```python
# POST /projects/{project_id}/sessions
# Creates SQLiteSession with key: project_{id}_node_{node_id}
```

### Key Endpoint: Send Message
```python
@app.post("/sessions/{session_id}/messages")
async def send_message(session_id: str, request: MessageRequest):
    # Get current code from project
    current_code = await git_service.get_current_code(session.project_id)
    
    # Handle human rejection feedback (NEW)
    if request.feedback_type == 'human_rejection':
        # Get rejected diff and create new prompt
        rejected_diff = get_diff(request.diff_id)
        prompt = f"Human rejected: {request.feedback}. Original: {rejected_diff.vibecoder_prompt}"
    else:
        prompt = request.prompt
    
    # Run vibecoder with OpenAI session (may loop with evaluator)
    result = await vibecode_service.vibecode(
        session.project_id,
        prompt,
        current_code,  # Pass current code for patching
        session.node_id
    )
    
    # CRITICAL: Store FULL OpenAI response AND extract usage
    usage_data = result.get("usage", {})
    token_usage = {
        "prompt_tokens": usage_data.get("prompt_tokens", 0),
        "completion_tokens": usage_data.get("completion_tokens", 0), 
        "total_tokens": usage_data.get("total_tokens", 0),
        "model": result.get("model", "unknown")
    }
    
    message = ConversationMessage(
        session_id=session_id,
        openai_response=result,  # Store everything!
        token_usage=token_usage  # Track usage separately
    )
    
    # Emit vibecode_response with diff_id for human review
    # Emit token_usage for tracking
```

### Human Review Endpoints (NEW)
```python
# POST /diffs/{diff_id}/review - Approve/reject with feedback
# POST /diffs/{diff_id}/commit - Commit approved diff, clear evaluator context
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
- Integration tests: vibecode flow  
- E2E test: Create project → Vibecode → Review diff
- Management command test: Reset DB → Verify sample data