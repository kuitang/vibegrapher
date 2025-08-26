# DONE as of commit 93bb73a

# Backend Phase 001: Core Infrastructure

## Objectives
Build foundational database models and basic CRUD endpoints with type safety.

## Implementation Tasks
1. Set up mypy for static type checking
2. Create TimestampMixin for automatic created_at/updated_at handling
3. SQLAlchemy models with type annotations inheriting TimestampMixin (Project, VibecodeSession, ConversationMessage, TestCase)
4. Alembic migrations setup
5. Basic CRUD endpoints with Pydantic models

## Acceptance Criteria
- ✅ mypy passes with no errors (`mypy backend/app/`)
- ✅ POST /projects creates project and returns {id, name, repository_path}
- ✅ Database tables created with correct foreign keys
- ✅ GET /projects/{id} returns project (repository_path will be set in phase 003)
- ✅ DELETE /projects/{id} removes project record
- ✅ All functions have type hints
- ✅ Pydantic models validate request/response data

## Integration Tests (pytest + httpx)

### Test Framework Requirements
**CRITICAL: Each test suite MUST use isolated test environment:**
1. Start NEW backend server instance (not the dev server)
2. Use tempfile for test database (e.g., `/tmp/test_vibegrapher_{uuid}.db`)
3. Run management command to clear/seed test data
4. Execute tests against isolated server
5. Cleanup: Stop server, remove temp database

```python
# backend/tests/conftest.py - Test fixtures for isolated server
import tempfile
import asyncio
from pathlib import Path

@pytest.fixture
async def test_server():
    # Create temp database
    db_file = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
    db_path = db_file.name
    
    # Start isolated test server on random port
    server = await start_test_server(db_path, port=0)
    
    # Clear and seed database
    await run_management_command('reset_db', db_path)
    
    yield server.url
    
    # Cleanup
    await server.stop()
    Path(db_path).unlink()

# backend/tests/integration/test_phase_001_infrastructure.py:
# - test_create_project: POST /projects → verify 201
# - test_get_project: GET /projects/{id} → verify project returned
# - test_delete_project: DELETE /projects/{id} → verify 204
# - test_database_schema: Verify all tables exist

# Test output style (minimal, factual):
# Running: POST /projects
# Result: 201, id=abc123
# Expected: 201
```

## Validation Requirements
- Write pytest + httpx integration tests covering all acceptance criteria
- Test manually with curl commands for POST /projects, GET /projects/{id}, DELETE /projects/{id}
- Check database schema and sample data with sqlite3 commands
- Save test evidence in backend/validated_test_evidence/phase-001/

## Setup Commands
```bash
# Standard setup: backend/, app/management/, validated_test_evidence/
# Dependencies: mypy, sqlalchemy[mypy], pygit2
# mypy.ini: Strict type checking configuration
```

## Deliverables
- [ ] mypy.ini configuration
- [ ] Database models with type hints in backend/app/models/
- [ ] Alembic migrations in backend/alembic/versions/
- [ ] CRUD endpoints with Pydantic models in backend/app/api/projects.py
- [ ] Tests in backend/tests/integration/test_phase_001_infrastructure.py
- [ ] Validation evidence in backend/validated_test_evidence/phase-001/