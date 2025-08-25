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
# Define the AgentNode class
class AgentNode:
    name: str
    line_start: int
    line_end: int
    children: List[str]  # Names of child agents if any

class ASTParserService:
    async def parse_agents(code: str) -> List[AgentNode]  # Extract Agent() calls with line numbers
    async def update_node(code: str, node_id: str, new_def: str) -> str  # Replace specific agent
```

### 2. All OpenAI Agents (app/agents/all_agents.py)
```python
# IMPORTANT: MUST use gpt-5 series models - THESE ARE REAL MODELS, NOT PLACEHOLDERS!
# DO NOT USE gpt-4o or older models!
MODEL_CONFIGS = {
    "THINKING_MODEL": "gpt-5-thinking",  # REAL MODEL - USE THIS!
    "SMALL_MODEL": "gpt-5-mini"  # REAL MODEL - USE THIS!
}

# Validation functions
def check_syntax(code: str) -> dict  # Returns {valid: bool, error?: str, line?: int}
def check_patch_applies(original: str, patch: str) -> dict  # Test patch with dry-run
def apply_patch(original: str, patch: str) -> str  # Actually apply patch

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
class GitService:
    # Using pygit2 for repository operations
    async def init_repository(project_id: str) -> str
    async def commit_changes(project_id: str, message: str) -> str
    async def get_current_code(project_id: str) -> str
    async def apply_diff(project_id: str, diff: str) -> str
```

### 4. Sandbox Service
```python
class SandboxService:
    async def run_test(code: str, test_input: str) -> TestResult
    # Subprocess with timeout=30s, memory=512MB
```

## Database Models

```python
# SQLAlchemy models (see spec_datamodel_v0.md for full schemas)
class Project(Base): ...  # id, name, repository_path, owner_id
class VibecodeSession(Base): ...  # Links to OpenAI SQLiteSession
class ConversationMessage(Base): ...  # Stores full openai_response JSON
class TestCase(Base): ...  # Test definitions
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
@app.delete("/sessions/{session_id}")  # Clear OpenAI SQLiteSession
@app.get("/messages/{id}/full")  # Return full openai_response JSON
@app.post("/tests/{id}/run")  # Run test in sandbox
```

## Socket.io Manager
```python
import socketio

class SocketIOManager:
    def __init__(self):
        self.sio = socketio.AsyncServer(cors_allowed_origins="*")
        self.active_connections = 0
    
    async def emit_to_room(self, room: str, event: str, data: dict):
        # Include trace_id in all messages
        await self.sio.emit(event, data, room=room)
    
    async def join_project_room(self, sid: str, project_id: str):
        await self.sio.enter_room(sid, f"project_{project_id}")
    
    async def start_heartbeat(self):
        """Send heartbeat every 30 seconds for debug visibility"""
        while True:
            await asyncio.sleep(30)
            await self.sio.emit('heartbeat', {
                'server_time': datetime.utcnow().isoformat(),
                'status': 'alive',
                'connections': self.active_connections
            })
```

## Configuration
```python
from pydantic import BaseSettings

class Settings(BaseSettings):
    # Load from .env
    database_url: str = "sqlite:///./vibegrapher.db"
    test_database_url: str = "sqlite:///./test_vibegrapher.db"
    openai_api_key: str
    cors_origins: str = "*"
    media_path: str = "media"
    host: str = "0.0.0.0"  # Server listens on all interfaces
    port: int = 8000
    
    class Config:
        env_file = ".env"

# Deployment Notes:
# - Backend ALWAYS binds to 0.0.0.0 (listens on all interfaces)
# - Frontend connects to different URLs based on environment:
#   * Local: http://localhost:8000
#   * Remote dev: http://SERVER_IP:8000  
#   * Production: https://your-api.fly.dev
```

## Management Commands

### Database Reset Command
```python
# Create management directory: mkdir -p app/management
# File: app/management/reset_db.py
async def reset_and_seed_database():
    # 1. Drop all tables (CASCADE)
    # 2. Create all tables from Base.metadata
    # 3. Create sample project with git repo
    # 4. Add sample agents code
    # 5. Add test cases
    # Usage: python -m app.management.reset_db
```

## Testing
- Unit tests for AST parser
- Integration tests for vibecode flow
- E2E test: Create project → Vibecode → Run test
- Management command test: Reset DB → Verify sample data