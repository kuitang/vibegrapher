# Backend Agent Instructions for Vibegrapher v0

## Your Mission
Build a FastAPI backend that enables users to "vibecode" OpenAI Agent workflows through natural language. No graph visualization in v0.

## Setup Phase

### 1. Read Specifications
- `SPEC_v0_DataModel_API.md` - Data models and contracts
- `SPEC_v0_Backend_REVISED.md` - Implementation guide
- Study https://openai.github.io/openai-agents-python/ - Especially sessions and handoffs

### 2. Environment Configuration
```bash
# .env (never commit this)
DATABASE_URL=sqlite:///./vibegrapher.db
OPENAI_API_KEY=sk-...
CORS_ORIGINS=*
PORT=8000
```

### 3. Check Git Security (CRITICAL)
```bash
# Verify gitleaks is installed
which gitleaks || echo "ERROR: Install gitleaks first!"

# Verify pre-commit hook exists
test -f .git/hooks/pre-commit || echo "ERROR: Set up pre-commit hook!"

# If missing, set it up:
echo 'gitleaks detect --source . --verbose' > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

**NEVER use `git add .`** - Always add specific files
**NEVER commit secrets** - Gitleaks will block you

### 4. Project Structure
```
backend/
├── app/
│   ├── models/      # SQLAlchemy models
│   ├── api/         # Endpoints
│   ├── agents/      
│   │   └── all_agents.py  # ALL OpenAI agents in ONE file
│   ├── services/    # Business logic
│   └── config.py    # Settings
├── tests/
├── alembic/
├── media/projects/  # Git repos
└── validated_test_evidence/  # Test artifacts
```

### 5. Install Dependencies
```bash
pip install fastapi uvicorn sqlalchemy alembic
pip install openai-agents pygit2 aiofiles
pip install pytest pytest-asyncio httpx
```

### 6. Hello World Test
```python
# app/main.py - Minimal FastAPI
# Must work before continuing
```

## Implementation Phases

### Phase 1: Core Infrastructure
1. SQLAlchemy models (Project, VibecodeSession, ConversationMessage, TestCase)
2. Alembic migrations
3. Git service with pygit2
4. Basic CRUD endpoints
5. **Tests**: Create project, verify git repo exists

**Validated Test Evidence**:
```bash
# After Phase 1 completion
git add -A && git commit -m "Phase 1: Core infrastructure complete"
HASH=$(git rev-parse HEAD)

# Create test evidence script
cat > validated_test_evidence/${HASH}-phase1.sh << 'EOF'
#!/bin/bash
OUTPUT_DIR="validated_test_evidence/${HASH}-phase1"
mkdir -p $OUTPUT_DIR

# Run integration tests for Phase 1
pytest tests/integration/test_phase1.py -v --tb=short > $OUTPUT_DIR/test_output.log 2>&1

# Test API endpoints
curl -X POST http://localhost:8000/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Project"}' > $OUTPUT_DIR/create_project.json

# Verify git repo created
ls -la media/projects/ > $OUTPUT_DIR/git_repos.txt

# Database state
sqlite3 vibegrapher.db ".schema" > $OUTPUT_DIR/db_schema.sql
sqlite3 vibegrapher.db "SELECT * FROM projects;" > $OUTPUT_DIR/projects.txt

echo "Phase 1 validation complete"
EOF

chmod +x validated_test_evidence/${HASH}-phase1.sh
./validated_test_evidence/${HASH}-phase1.sh

# Commit evidence
git add validated_test_evidence/
git commit -m "Phase 1: Validated test evidence"
```

### Phase 2: OpenAI Agents Integration (IMPORTANT: Use gpt-5 series)
1. Create `app/agents/all_agents.py` with ALL agents
2. Use MODEL_CONFIGS with THINKING_MODEL and SMALL_MODEL
3. Implement deterministic syntax checker (NOT an agent)
4. Create vibecoder with structured output (code + explanation)
5. **Tests**: Vibecode "add Spanish agent", verify diff contains Agent()

**Validated Test Evidence**:
```bash
# After Phase 2 completion
git commit -m "Phase 2: OpenAI Agents complete"
HASH=$(git rev-parse HEAD)

cat > validated_test_evidence/${HASH}-phase2.sh << 'EOF'
#!/bin/bash
OUTPUT_DIR="validated_test_evidence/${HASH}-phase2"
mkdir -p $OUTPUT_DIR

# Test vibecode functionality
pytest tests/integration/test_vibecode.py -v > $OUTPUT_DIR/test_output.log 2>&1

# Test session creation and message sending
PROJECT_ID="test-project-id"
curl -X POST http://localhost:8000/projects/${PROJECT_ID}/sessions \
  > $OUTPUT_DIR/session_create.json

SESSION_ID=$(cat $OUTPUT_DIR/session_create.json | jq -r .session_id)
curl -X POST http://localhost:8000/sessions/${SESSION_ID}/messages \
  -d '{"prompt": "Create a triage agent"}' \
  > $OUTPUT_DIR/vibecode_response.json

# Verify OpenAI session files created
ls -la *.db > $OUTPUT_DIR/sqlite_sessions.txt

echo "Phase 2 validation complete"
EOF

chmod +x validated_test_evidence/${HASH}-phase2.sh
./validated_test_evidence/${HASH}-phase2.sh
git add validated_test_evidence/
git commit -m "Phase 2: Validated test evidence"
```

### Phase 3: AST Parser
1. Parse Python to extract Agent() definitions
2. Track node positions in file
3. Update specific nodes
4. **Tests**: Parse sample code, extract agent names

### Phase 4: Session Management
1. Endpoint: POST /projects/{id}/sessions (start session)
2. Endpoint: POST /sessions/{id}/messages (send message)
3. Endpoint: DELETE /sessions/{id} (clear session)
4. Store FULL OpenAI response including trace_id
5. **Tests**: Send multiple messages, verify history maintained

### Phase 5: Testing Framework
1. Sandbox with subprocess + resource limits
2. Test case CRUD
3. Run tests endpoint with trace_id in response
4. **Tests**: Run malicious code, verify sandbox blocks it

### Phase 6: WebSocket & Real-time
1. Connection manager
2. Broadcast code changes with trace_id
3. Test results streaming
4. **Tests**: Two clients, one vibes, other receives update

**Final Validated Test Evidence**:
```bash
# After all phases complete
git commit -m "v0 Complete: All phases implemented"
HASH=$(git rev-parse HEAD)

cat > validated_test_evidence/${HASH}-final.sh << 'EOF'
#!/bin/bash
OUTPUT_DIR="validated_test_evidence/${HASH}-final"
mkdir -p $OUTPUT_DIR

# Run ALL tests
pytest --cov=app --cov-report=html:$OUTPUT_DIR/coverage > $OUTPUT_DIR/all_tests.log 2>&1

# Full E2E test
python tests/e2e/test_full_system.py > $OUTPUT_DIR/e2e.log 2>&1

# API smoke tests
for endpoint in projects sessions tests; do
  curl http://localhost:8000/${endpoint} > $OUTPUT_DIR/${endpoint}.json 2>&1
done

# Database final state
sqlite3 vibegrapher.db ".dump" > $OUTPUT_DIR/db_dump.sql

echo "Final validation complete - v0 ready!"
EOF

chmod +x validated_test_evidence/${HASH}-final.sh
./validated_test_evidence/${HASH}-final.sh
git add validated_test_evidence/
git commit -m "v0: Final validated test evidence"
```

## Critical OpenAI Agents SDK Usage

### Correct Session Management
```python
# WRONG - Don't create new agents each time
agent = Agent(...)  # This loses history!

# RIGHT - Reuse session
session = SQLiteSession(session_key)
result = await Runner.run(base_agent, prompt, session=session)
```

### Model Configuration (MUST use gpt-5)
```python
MODEL_CONFIGS = {
    "THINKING_MODEL": "gpt-5-thinking",
    "SMALL_MODEL": "gpt-5-mini"
}
# NO temperature settings for gpt-5
```

### Store Full Response with Trace
```python
result, trace_id = await vibecode_service.vibecode(...)
conversation_message.openai_response = {
    "content": result.final_output,
    "tool_calls": result.tool_calls,
    "trace_id": trace_id,
    # ... all fields
}
```

## Testing Strategy

Write tests FIRST for each phase:

```python
# Test example
@pytest.mark.asyncio
async def test_session_management():
    # Start session
    session = await start_session(project_id)
    
    # Send first message
    response1 = await send_message(session.id, "Create a triage agent")
    
    # Send second message (should remember first)
    response2 = await send_message(session.id, "Make it speak Spanish")
    
    # Should modify existing agent, not create new
    assert "triage_agent" in response2.diff
    assert response2.diff.count("Agent(") == 1
```

## Quality Checklist

Before EVERY commit:
- [ ] Tests pass
- [ ] No hardcoded URLs/ports
- [ ] No secrets in code
- [ ] Used `git add <specific files>`
- [ ] SQLiteSession used correctly
- [ ] Full OpenAI responses stored with trace_id
- [ ] Validated test evidence created for milestone

## Remember
- OpenAI Agents SDK sessions are KEY
- Store FULL responses with trace_id
- MUST use gpt-5 series models
- Validated test evidence after each phase
- Test-driven development
- Small, working commits
- No graph visualization in v0