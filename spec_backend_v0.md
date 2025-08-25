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

### 1. OpenAI Agents (app/vibecoder_agents/)
```python
# IMPORTANT: MUST use gpt-5 series models - THESE ARE REAL MODELS, NOT PLACEHOLDERS!
# DO NOT USE gpt-4o or older models!
MODEL_CONFIGS = {
    "THINKING_MODEL": "gpt-5-thinking",  # REAL MODEL - USE THIS!
    "SMALL_MODEL": "gpt-5-mini"  # REAL MODEL - USE THIS!
}

# Organize agents in app/vibecoder_agents/ directory (not all in one file)
# Apply tenacity for exponential backoff on OpenAI API calls

# Validation function - apply unified diff patch using pygit2
def validate_patch(original: str, patch: str) -> dict:
    """Apply unified diff patch using pygit2, then check Python syntax
    Patch format: Unified diff (like git diff output)
    Returns: {valid: bool, error?: str} with verbatim error if invalid"""

# Import from agents package
from agents import Agent, Runner, function_tool, SQLiteSession
from pydantic import BaseModel
from tenacity import retry, wait_exponential, stop_after_attempt

# Define EvaluationResult Pydantic model - NOW INCLUDES COMMIT MESSAGE
class EvaluationResult(BaseModel):
    approved: bool
    reasoning: str
    commit_message: str  # Suggested commit message if approved

# Tool for VibeCoder - validates and submits patches
@function_tool
async def submit_patch(ctx, patch: str, description: str) -> dict:
    # 1. Get current_code from context
    # 2. Validate unified diff patch using pygit2
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
    
    @retry(wait=wait_exponential(multiplier=1, min=4, max=60), stop=stop_after_attempt(6))
    async def vibecode(project_id, prompt, current_code, node_id=None):
        # Create session key with correct format (uses project_id for key, slug for path)
        session_key = f"project_{project_id}_node_{node_id}" if node_id else f"project_{project_id}"
        # Use project.slug for filesystem paths to ensure valid filenames
        db_path = f"media/projects/{project.slug}_conversations.db"
        session = SQLiteSession(session_key, db_path)  # MUST use file persistence, not in-memory
        
        # Create trace for entire vibecode session (all iterations)
        from agents import trace
        with trace(
            workflow_name="vibecode_session",
            group_id=session_key,
            metadata={
                "project_id": project_id,
                "node_id": node_id,
                "prompt": prompt[:200]  # First 200 chars for debugging
            }
        ) as session_trace:
            trace_id = session_trace.trace_id
            
            for iteration in range(MAX_ITERATIONS=3):
                # Run VibeCoder
                if iteration == 0:
                    input = prompt
                else:
                    input = f"Rejected. Feedback: {evaluator_feedback}. Original: {prompt}"
                
                # Using OpenAI SDK's Runner with tenacity retry decorator
                vibecoder_result = await Runner.run(
                    vibecoder_agent, input, 
                    session=session, 
                    context={"current_code": current_code}
                )
                
                # CRITICAL: Log and stream token usage immediately
                if vibecoder_result.context_wrapper.usage:
                    usage_data = {
                        "prompt_tokens": vibecoder_result.context_wrapper.usage.input_tokens,
                        "completion_tokens": vibecoder_result.context_wrapper.usage.output_tokens,
                        "total_tokens": vibecoder_result.context_wrapper.usage.total_tokens,
                        "model": "gpt-5-thinking",
                        "agent": "vibecoder",
                        "iteration": iteration + 1,
                        "response_id": vibecoder_result.last_response_id,
                        "session_id": session.id,
                        "trace_id": trace_id  # Session-wide trace
                    }
                    
                    await self.socketio_manager.emit_to_room(
                        f"project_{project_id}",
                        "token_usage",
                        usage_data
                    )
            
                # Check if patch submitted
                if not vibecoder_result.context.state.get("submitted_patch"):
                    return {
                        "response": vibecoder_result.final_output,  # Text response
                        "trace_id": trace_id  # Include for debugging
                    }
            
            # Run Evaluator (also using OpenAI SDK's Runner) - track usage
            evaluator_result = await Runner.run(evaluator_agent, patch_details, session=session)
            
            # CRITICAL: Log evaluator token usage too
            if evaluator_result.context_wrapper.usage:
                evaluator_usage = {
                    "prompt_tokens": evaluator_result.context_wrapper.usage.input_tokens,
                    "completion_tokens": evaluator_result.context_wrapper.usage.output_tokens,
                    "total_tokens": evaluator_result.context_wrapper.usage.total_tokens,
                    "model": "gpt-5-thinking",
                    "agent": "evaluator", 
                    "iteration": iteration + 1,
                    "response_id": evaluator_result.last_response_id,
                    "session_id": session.id,
                    "trace_id": trace_id  # Session-wide trace
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
                    "commit_message": evaluator_result.commit_message,
                    "trace_id": trace_id  # Include for debugging
                }
            else:
                evaluator_feedback = evaluator_result.reasoning
                # ALWAYS emit evaluator feedback to frontend for display
                await self.socketio_manager.emit_to_room(
                    f"project_{project_id}",
                    "evaluator_feedback",
                    {
                        "reasoning": evaluator_feedback, 
                        "iteration": iteration + 1,
                        "trace_id": trace_id
                    }
                )
        
            # After max iterations, return error with all feedback to user
            # User can continue conversation - VibeCoder maintains context via SQLiteSession
            return {
                "error": "Max iterations reached", 
                "final_feedback": evaluator_feedback,
                "message": "Please provide additional guidance or adjust your request",
                "trace_id": trace_id  # Include for debugging
            }
```

### 2. Git Service
```python
# GitService: Git operations with pygit2 - NO shelling out to git

# ################################################################################
# Git Operations with pygit2 - RESOLVED
# ################################################################################
# How to find docs: Use mcp__deepwiki__ask_question with repoName="libgit2/pygit2"
# 
# Key pygit2 APIs for implementation:
# 1. Applying unified diff: 
#    - pygit2.Diff.parse_diff(patch_text) - requires FULL git diff format with headers
#    - repo.apply(diff, ApplyLocation.WORKDIR/INDEX/BOTH)
#    - repo.applies(diff, location) - check if patch applies without modifying
# 2. Branches: repo.branches.create(name, commit), repo.checkout(ref)
# 3. Commits: repo.create_commit("HEAD", sig, sig, message, tree, [parent.id])
# 4. Read at commit: repo[commit_id].tree["filename"], then repo[blob.id].data
#
# IMPORTANT: Unified diff must include git headers (diff --git a/file b/file)
# ################################################################################

class GitService:
    async def get_head_commit() -> str  # Current HEAD SHA using pygit2
    async def get_current_branch() -> str  # Active branch name
    async def get_code_at_commit(sha: str) -> str  # Code at specific commit
    async def apply_unified_diff(diff: str) -> bool  # Apply unified diff using pygit2
    async def create_temp_branch_with_diff(diff: Diff) -> str  # Preview branch
    async def commit_diff(diff: Diff, message: str) -> str  # Commit approved diff
```

### 3. Socket.io Manager
```python
# SocketIOManager: Handle real-time events
# - emit_to_room: Send events to project rooms (all events include trace_id when available)
# - join_project_room: Subscribe clients to project updates
# - start_heartbeat: Send alive status every 30s for debugging
# Events: vibecode_response (includes trace_id), token_usage (includes trace_id), evaluator_feedback, heartbeat
```

## Database Models

```python
# SQLAlchemy models - see spec_datamodel_v0.md for full schemas
# Project (with UNIQUE slug constraint), VibecodeSession, ConversationMessage, TestCase, Diff
# Project.slug: UniqueConstraint, generated from name using slugify
# All models follow the TypeScript interfaces defined in spec_datamodel_v0.md
```

## API Endpoints (Simplified)

```
GET  /projects                  - List projects (also serves as health check)
POST /projects                  - Create project (generates unique slug from name)
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
    token_usage = {
        "prompt_tokens": result.context_wrapper.usage.input_tokens,
        "completion_tokens": result.context_wrapper.usage.output_tokens,
        "total_tokens": result.context_wrapper.usage.total_tokens,
        "model": "gpt-5-thinking"  # Or from config
    }
    
    message = ConversationMessage(
        session_id=session_id,
        openai_response=result,  # Store everything!
        token_usage=token_usage,  # Track usage separately
        response_id=result.last_response_id,  # Track response_id for audit trail
        trace_id=result.get("trace_id")  # Store trace_id from vibecode result
    )
    
    # Emit vibecode_response with diff_id and trace_id for human review
    await socketio_manager.emit_to_room(
        f"project_{project_id}",
        "vibecode_response",
        {
            "diff_id": result.get("diff_id"),
            "trace_id": result.get("trace_id"),
            "status": result.get("status", "completed")
        }
    )
```

### Human Review Endpoints (NEW)
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

# Log ALL OpenAI calls with trace_id (not in exception handler, always log):
logger.info(f"[{trace_id}] OPENAI REQUEST: {prompt[:200]}...")
result = await Runner.run(agent, prompt, session)
logger.info(f"[{trace_id}] OPENAI RESPONSE: {result.final_output[:200]}...")  
logger.info(f"[{trace_id}] 💵 OPENAI TOKENS: prompt={result.context_wrapper.usage.input_tokens}, completion={result.context_wrapper.usage.output_tokens}, total={result.context_wrapper.usage.total_tokens}")

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