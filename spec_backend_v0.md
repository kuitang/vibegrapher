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
class ASTParserService:
    async def parse_agents(code: str) -> List[AgentNode]
        # Parse Python AST, extract Agent() calls
        # Return node info with line numbers
    
    async def update_node(code: str, node_id: str, new_def: str) -> str
        # Replace specific agent in code
```

### 2. All OpenAI Agents (app/agents/all_agents.py)
```python
from agents import Agent, Runner, SQLiteSession, function_tool
from pydantic import BaseModel

# IMPORTANT: MUST use gpt-5 series models
MODEL_CONFIGS = {
    "THINKING_MODEL": "gpt-5-thinking",  # For complex reasoning
    "SMALL_MODEL": "gpt-5-mini"          # For simple tasks
}

class CodeOutput(BaseModel):
    code: str           # Python code ONLY, no markdown
    explanation: str    # Explanation of changes

class EvaluationResult(BaseModel):
    approved: bool
    reasoning: str
    suggestions: List[str]

# Deterministic syntax checker (NOT an agent)
def check_syntax(code: str) -> dict:
    """Returns Python's syntax error or success"""
    try:
        compile(code, '<string>', 'exec')
        return {"valid": True}
    except SyntaxError as e:
        return {
            "valid": False,
            "error": str(e),
            "line": e.lineno
        }

# Tools for vibecoder
@function_tool
async def validate_syntax(code: str) -> dict:
    return check_syntax(code)

@function_tool  
async def read_docs(topic: str) -> str:
    # Search OpenAI SDK documentation
    pass

# Main vibecoder agent
vibecoder_agent = Agent(
    name="Vibecoder",
    model=MODEL_CONFIGS["THINKING_MODEL"],
    instructions="""You generate Python code for OpenAI Agents SDK.
    IMPORTANT: Output ONLY valid Python code in the 'code' field.
    No markdown, no comments outside code, no explanations in code field.
    Put explanations in the 'explanation' field.""",
    tools=[validate_syntax, read_docs],
    output_type=CodeOutput,
    handoffs=["syntax_fixer", "evaluator"]
)

# Syntax fixer for handoff
syntax_fixer_agent = Agent(
    name="SyntaxFixer",
    model=MODEL_CONFIGS["SMALL_MODEL"],
    instructions="Fix Python syntax errors. Return valid code only.",
    output_type=CodeOutput
)

# Evaluator agent
evaluator_agent = Agent(
    name="Evaluator",
    model=MODEL_CONFIGS["THINKING_MODEL"],
    instructions="Evaluate if code meets requirements.",
    output_type=EvaluationResult
)

class VibecodeService:
    def __init__(self):
        self.sessions = {}  # session_key -> SQLiteSession
    
    async def get_or_create_session(self, project_id: str, node_id: str = None):
        session_key = f"{project_id}_{node_id}" if node_id else project_id
        if session_key not in self.sessions:
            self.sessions[session_key] = SQLiteSession(session_key)
        return self.sessions[session_key]
    
    async def clear_session(self, session_key: str):
        if session_key in self.sessions:
            await self.sessions[session_key].clear_session()
            del self.sessions[session_key]
    
    async def vibecode(self, project_id: str, prompt: str, node_id: str = None):
        session = await self.get_or_create_session(project_id, node_id)
        
        # Run with session to maintain history
        result = await Runner.run(
            vibecoder_agent,
            prompt,
            session=session
        )
        
        # Extract trace_id if available
        trace_id = getattr(result, 'trace_id', None)
        
        return result, trace_id
```

### 3. Git Service (using pygit2)
```python
import pygit2

class GitService:
    async def init_repository(project_id: str) -> str
    async def commit_changes(project_id: str, message: str) -> str
    async def get_current_code(project_id: str) -> str
    async def apply_diff(project_id: str, diff: str) -> str
```
```

### 6. Sandbox Service
```python
class SandboxService:
    async def run_test(code: str, test_input: str) -> TestResult
        # Subprocess with resource limits
        # timeout=30s, memory=512MB
```

## Database Models (SQLAlchemy)

```python
class Project(Base):
    id: str (UUID)
    name: str
    repository_path: str
    owner_id: str
    created_at: datetime
    
class VibecodeSession(Base):
    id: str (UUID) 
    project_id: str (FK)
    node_id: str (nullable)
    type: str  # 'global' or 'node'
    status: str
    openai_session_key: str  # Links to SQLiteSession
    
class ConversationMessage(Base):
    id: str (UUID)
    session_id: str (FK)
    role: str
    content: str
    openai_response: JSON  # Full response data
    timestamp: datetime
    
class TestCase(Base):
    id: str (UUID)
    project_id: str (FK)
    input_prompt: str
    expected_behavior: str
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

### Start Session Endpoint
```python
@app.post("/projects/{project_id}/sessions")
async def start_session(
    project_id: str,
    request: StartSessionRequest,  # {node_id?: str}
    db: AsyncSession = Depends(get_db)
):
    # Create or get existing session
    session_type = "node" if request.node_id else "global"
    session_key = f"{project_id}_{request.node_id}" if request.node_id else project_id
    
    # Check if session exists
    existing = await db.query(VibecodeSession).filter_by(
        project_id=project_id,
        node_id=request.node_id
    ).first()
    
    if existing:
        return {"session_id": existing.id, "type": session_type}
    
    # Create new session
    session = VibecodeSession(
        project_id=project_id,
        node_id=request.node_id,
        type=session_type,
        openai_session_key=session_key
    )
    db.add(session)
    await db.commit()
    
    return {"session_id": session.id, "type": session_type}
```

### Send Message Endpoint
```python
@app.post("/sessions/{session_id}/messages")
async def send_message(
    session_id: str,
    request: MessageRequest,  # {prompt: str}
    db: AsyncSession = Depends(get_db)
):
    # Get session
    session = await db.get(VibecodeSession, session_id)
    
    # Run vibecoder with persistent session
    result, trace_id = await vibecode_service.vibecode(
        session.project_id,
        request.prompt,
        session.node_id
    )
    
    # Store message with full OpenAI response
    message = ConversationMessage(
        session_id=session_id,
        content=request.prompt,
        role="user",
        openai_response=result.to_dict()
    )
    db.add(message)
    await db.commit()
    
    # Broadcast via WebSocket
    await ws_manager.broadcast(session.project_id, {
        "type": "vibecode_response",
        "session_id": session_id,
        "diff": result.code if hasattr(result, 'code') else None,
        "trace_id": trace_id
    })
    
    return {
        "message_id": message.id,
        "diff": result.code if hasattr(result, 'code') else None,
        "status": "success",
        "trace_id": trace_id
    }
```

### Clear Session Endpoint
```python
@app.delete("/sessions/{session_id}")
async def clear_session(session_id: str, db: AsyncSession = Depends(get_db)):
    session = await db.get(VibecodeSession, session_id)
    
    # Clear OpenAI session
    await vibecode_service.clear_session(session.openai_session_key)
    
    # Delete messages
    await db.execute(
        delete(ConversationMessage).where(
            ConversationMessage.session_id == session_id
        )
    )
    
    # Reset session status
    session.status = "cleared"
    await db.commit()
    
    return {"status": "cleared"}
```

## WebSocket Manager
```python
class ConnectionManager:
    async def connect(websocket, project_id: str, user_id: str)
    async def broadcast(project_id: str, message: dict)
    async def disconnect(websocket)
```

## Configuration
```python
# app/config.py
class Settings(BaseSettings):
    database_url: str = "sqlite:///./vibegrapher.db"
    openai_api_key: str
    cors_origins: List[str] = ["*"]  # Allow all origins
    media_path: str = "./media"
    
    class Config:
        env_file = ".env"
```

## Testing
- Unit tests for AST parser
- Integration tests for vibecode flow
- E2E test: Create project → Vibecode → Run test