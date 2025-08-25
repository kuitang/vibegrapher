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
# .env (never commit this)
DATABASE_URL=sqlite:///./vibegrapher.db
OPENAI_API_KEY=sk-...
CORS_ORIGINS=*
PORT=8000
```

## Project Organization

### Code Structure
```
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
└── validated_test_evidence/  # Test artifacts
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

# Run all tests
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
2. **Phase 002**: OpenAI Agents → `plans/backend-phase-002-agents.md`
3. **Phase 003**: AST Parser → `plans/backend-phase-003-ast.md`
4. **Phase 004**: Session Management → `plans/backend-phase-004-sessions.md`
5. **Phase 005**: Testing Framework → `plans/backend-phase-005-sandbox.md`
6. **Phase 006**: WebSocket → `plans/backend-phase-006-websocket.md`

## Critical Requirements

### OpenAI Agents SDK Usage
```python
# MUST use gpt-5 series models
MODEL_CONFIGS = {
    "THINKING_MODEL": "gpt-5-thinking",
    "SMALL_MODEL": "gpt-5-mini"
}

# CORRECT Session Management
session = SQLiteSession(session_key)
result = await Runner.run(agent, prompt, session=session)

# WRONG - Don't create new agents each time
agent = Agent(...)  # This loses history!
```

### Store Full Responses
```python
# ALWAYS store complete OpenAI response
message = ConversationMessage(
    session_id=session_id,
    openai_response=result  # Store everything!
)
```

## Quality Checklist

Before EVERY commit:
- [ ] Type checking passes (`mypy app/`)
- [ ] Tests pass (`pytest`)
- [ ] No hardcoded URLs/ports
- [ ] No secrets in code
- [ ] Virtual environment active
- [ ] All functions have type hints
- [ ] Pydantic models validate all API data
- [ ] SQLiteSession used correctly
- [ ] Full OpenAI responses stored with trace_id
- [ ] Integration tests cover full flows

## Remember
- VibeCoder has TWO modes: patch submission OR text response
- Evaluator loop runs MAX 3 iterations
- All agents in ONE file: `app/agents/all_agents.py`
- Focus on integration tests, not unit tests
- Store FULL OpenAI responses
- MUST use gpt-5 series models
- No graph visualization in v0