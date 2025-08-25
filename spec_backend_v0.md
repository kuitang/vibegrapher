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

### 1. AST Parser Service
```python
class AgentNode:
    name: str
    line_start: int
    line_end: int
    children: List[str]  # Names of child agents if any

class ASTParserService:
    # Extract Agent() calls with line numbers and replace specific agents
    pass
```

### 2. All OpenAI Agents (app/agents/all_agents.py)
```python
# IMPORTANT: MUST use gpt-5 series models - THESE ARE REAL MODELS, NOT PLACEHOLDERS!
# DO NOT USE gpt-4o or older models!
MODEL_CONFIGS = {
    "THINKING_MODEL": "gpt-5-thinking",  # REAL MODEL - USE THIS!
    "SMALL_MODEL": "gpt-5-mini"  # REAL MODEL - USE THIS!
}

# Validation functions - check syntax, test/apply patches

# Import from agents package
from agents import Agent, Runner, function_tool, SQLiteSession
from pydantic import BaseModel

# Define EvaluationResult Pydantic model
class EvaluationResult(BaseModel):
    approved: bool
    reasoning: str

# Tool for VibeCoder - validates and submits patches
@function_tool
async def submit_patch(ctx, patch: str, description: str) -> dict:
    # 1. Check patch applies cleanly to current_code from context
    # 2. Apply patch to get new_code
    # 3. Check syntax of new_code
    # 4. If all valid, store in ctx.state for evaluator
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
    instructions="Evaluate patches for quality/correctness...",
    output_type=EvaluationResult  # {approved: bool, reasoning: str}
)

class VibecodeService:
    def __init__(self, socketio_manager):
        self.socketio_manager = socketio_manager
    
    async def vibecode(project_id, prompt, current_code, node_id=None):
        # Create session key with correct format
        session_key = f"project_{project_id}_node_{node_id}" if node_id else f"project_{project_id}"
        session = SQLiteSession(session_key)  # From OpenAI SDK
        
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
                return {"patch": submitted_patch, "accepted": True}
            else:
                evaluator_feedback = evaluator_result.reasoning
        
        return {"error": "Max iterations reached"}
```

### 3. Git Service
```python
# GitService: Standard git operations (init, commit, get code, apply diff) using pygit2
```

### 4. Sandbox Service
```python
# SandboxService: Run code in subprocess with timeout=30s, memory=512MB
```

## Database Models

```python
# SQLAlchemy models - see spec_datamodel_v0.md for full schemas
# Project, VibecodeSession, ConversationMessage, TestCase
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
POST /tests                     - Create test case  
POST /tests/:id/run            - Run single test
```

### Key Endpoint: Start Session
```python
@app.post("/projects/{project_id}/sessions")
async def start_session(project_id: str, request: StartSessionRequest):
    # IMPORTANT: Creates/retrieves OpenAI SQLiteSession with correct format
    session_key = f"project_{project_id}_node_{request.node_id}" if request.node_id else f"project_{project_id}"
    # Store session_key in VibecodeSession.openai_session_key
    # Return session_id for frontend tracking
```

### Key Endpoint: Send Message
```python
@app.post("/sessions/{session_id}/messages")
async def send_message(session_id: str, request: MessageRequest):
    # Get current code from project
    current_code = await git_service.get_current_code(session.project_id)
    
    # Run vibecoder with OpenAI session (may loop with evaluator)
    result = await vibecode_service.vibecode(
        session.project_id,
        request.prompt,
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
    
    # Socket.io broadcast with trace_id AND token usage
    await socketio_manager.emit_to_room(
        f"project_{session.project_id}",
        "vibecode_response",
        {
            "patch": result.get("patch"),
            "trace_id": result.get("trace_id"),
            "session_id": session_id,
            "token_usage": token_usage  # Stream usage in real-time
        }
    )
    
    # Also emit separate usage event for tracking
    await socketio_manager.emit_to_room(
        f"project_{session.project_id}",
        "token_usage",
        {
            "session_id": session_id,
            "message_id": message.id,
            "usage": token_usage,
            "timestamp": datetime.utcnow().isoformat()
        }
    )
```

### Other Endpoints
```python
# DELETE /sessions/{session_id} - Clear OpenAI SQLiteSession
# GET /messages/{id}/full - Return full openai_response JSON  
# POST /tests/{id}/run - Run test in sandbox
```

## Socket.io Manager
```python
# SocketIOManager: Handle real-time events
# - emit_to_room: Send events with trace_id to project rooms
# - join_project_room: Subscribe clients to project updates
# - start_heartbeat: Send alive status every 30s for debugging
# Events: vibecode_response, token_usage, test_completed, heartbeat
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
- Unit tests: AST parser
- Integration tests: vibecode flow  
- E2E test: Create project → Vibecode → Run test
- Management command test: Reset DB → Verify sample data