# Backend Agent Instructions for Vibegrapher v0

## Your Mission
Build a FastAPI backend that enables users to "vibecode" OpenAI Agent workflows through natural language. No graph visualization in v0.

## Environment Setup

### Virtual Environment (REQUIRED)
```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate  # Windows

# Install dependencies including type checking
pip install -r requirements.txt
pip install mypy sqlalchemy[mypy] types-python-dateutil types-requests

# Configure mypy for type checking
mypy --install-types --non-interactive
```

### Environment Configuration
```bash
# .env (NEVER commit this file - add to .gitignore)
DATABASE_URL=sqlite:///./vibegrapher.db
OPENAI_API_KEY=sk-...
CORS_ORIGINS=*
PORT=8000
```

## Project Organization

### Code Structure
```
# Start from project root, then cd backend
backend/
├── app/
│   ├── models/         # SQLAlchemy models
│   ├── api/            # FastAPI endpoints  
│   ├── agents/         
│   │   └── all_agents.py  # ALL OpenAI agents in ONE file
│   ├── services/       # Business logic
│   └── config.py       # Settings
├── tests/
│   ├── integration/    # PRIMARY: httpx integration tests
│   └── unit/          # MINIMAL: Only for critical logic
├── alembic/           # Database migrations
├── media/projects/    # Git repositories
└── validated_test_evidence/  # Test artifacts (backend/validated_test_evidence/phase-XXX/)
```

### Testing Strategy (pytest + httpx)
- **PRIMARY**: Integration tests using httpx AsyncClient
- **Test Database**: Use separate `test_vibegrapher.db` for tests
- **Setup**: Run database reset command before each test suite
- **MINIMAL**: Unit tests only for:
  - Git operations (pygit2)
  - AST parsing
  - Sandbox isolation
- **FOCUS**: Stateful integration tests that:
  - Create projects
  - Start sessions
  - Send multiple messages
  - Verify conversation context

### Running Tests
```bash
# Set test database environment variable
export DATABASE_URL=sqlite:///./test_vibegrapher.db

# Reset test database before running tests
python -m app.management.reset_db --test-db

# Run all tests (use http://localhost:8000 in test examples)
# Backend binds to 0.0.0.0:8000 but test clients connect to localhost:8000
pytest

# Run specific phase tests
pytest tests/integration/test_phase001_infrastructure.py -v

# Run with coverage
pytest --cov=app --cov-report=html

# Run tests headless (no UI)
pytest --no-header --tb=short
```

## Implementation Phases

See `plans/backend-phase-*.md` for detailed requirements:

1. **Phase 001**: Core Infrastructure → `plans/backend-phase-001-infrastructure.md`
2. **Phase 002**: Socket.io & Real-time → `plans/backend-phase-002-socketio.md`
3. **Phase 003**: Testing Framework (Sandbox) → `plans/backend-phase-003-sandbox.md`
4. **Phase 004**: OpenAI Agents → `plans/backend-phase-004-agents.md`
5. **Phase 005**: Session Management → `plans/backend-phase-005-sessions.md`
6. **Phase 006**: AST Parser → `plans/backend-phase-006-ast.md`

## Critical Requirements

### OpenAI Agents SDK Usage (REAL API ONLY)
```python
# MUST use gpt-5 series models - THESE ARE REAL!
MODEL_CONFIGS = {
    "THINKING_MODEL": "gpt-5-thinking",
    "SMALL_MODEL": "gpt-5-mini"
}

# CRITICAL: NEVER MOCK OpenAI APIs
# ALL tests MUST use real OpenAI API calls with valid API key
# NO mock responses, NO fake agents, NO stubbed models
# This ensures real token usage tracking and authentic responses

# CORRECT Session Management
session = SQLiteSession(session_key)
result = await Runner.run(agent, prompt, session=session)
# ALWAYS extract and log usage: result.usage

# WRONG - Don't create new agents each time
agent = Agent(...)  # This loses history!
```

### Store Full Responses + Token Usage
```python
# ALWAYS store complete OpenAI response AND usage
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

# CRITICAL: Stream usage via Socket.io immediately
# MUST include agent name and iteration number
await socketio_manager.emit_to_room(
    f"project_{project_id}",
    "token_usage", 
    {
        **token_usage,
        "agent": "vibecoder",  # or "evaluator"
        "iteration": iteration_num
    }
)
```

## Quality Checklist

Before EVERY commit:
- [ ] Type checking passes (`mypy app/`)
- [ ] Tests pass (`pytest`) - ALL USING REAL OpenAI API
- [ ] No hardcoded URLs/ports
- [ ] No secrets in code (except valid OPENAI_API_KEY in .env)
- [ ] Virtual environment active
- [ ] All functions have type hints
- [ ] Pydantic models validate all API data
- [ ] SQLiteSession used correctly
- [ ] Full OpenAI responses stored with trace_id AND token usage
- [ ] Token usage streamed via Socket.io
- [ ] Integration tests cover full flows
- [ ] NO MOCKED OpenAI calls anywhere

## Remember
- VibeCoder has TWO modes: patch submission OR text response
- Evaluator loop runs MAX 3 iterations
- All agents in ONE file: `app/agents/all_agents.py`
- Focus on integration tests, not unit tests
- Store FULL OpenAI responses
- MUST use gpt-5 series models

# Final Instructions - Infinite Loop Workflow
**Work continuously in this loop until you get stuck with errors:**

1. Read the specs files: `spec_datamodel_v0.md` and `spec_backend_v0.md`
2. Go into the `plans/` directory and find the first backend document that is not done
3. Check first few lines to see if done - do not read whole file
4. Complete that phase entirely
5. Once done, write a header `# DONE as of commit [commit-hash]`
6. **Re-read specs and this prompt file (to refresh context)**
7. **LOOP BACK TO STEP 2** - find the next incomplete backend document
8. **Continue this infinite loop until you get stuck with bugs**
9. **ONLY COMMIT WORKING CODE!** - Stop if code doesn't work