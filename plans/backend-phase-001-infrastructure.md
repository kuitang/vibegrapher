# Backend Phase 001: Core Infrastructure

## Objectives
Build foundational database models, Git integration, and basic CRUD endpoints with type safety.

## Implementation Tasks
1. Set up mypy for static type checking
2. SQLAlchemy models with type annotations (Project, VibecodeSession, ConversationMessage, TestCase)
3. Alembic migrations setup
4. Git service with pygit2 and type hints
5. Basic CRUD endpoints with Pydantic models

## Acceptance Criteria
- ✅ mypy passes with no errors (`mypy app/`)
- ✅ POST /projects creates project and returns {id, name, repository_path}
- ✅ Git repository initialized at media/projects/{project_id}/
- ✅ Database tables created with correct foreign keys
- ✅ GET /projects/{id} returns project with current_code field
- ✅ DELETE /projects/{id} removes project and git repo
- ✅ All functions have type hints
- ✅ Pydantic models validate request/response data

## Integration Tests (pytest + httpx)
```python
# tests/conftest.py - Shared test configuration
import pytest
import os

@pytest.fixture(scope="session", autouse=True)
def use_test_database():
    """Automatically use test database for all tests"""
    os.environ["DATABASE_URL"] = "sqlite:///./test_vibegrapher.db"
    # Run reset_db before test suite
    from app.management.reset_db import reset_and_seed_database
    reset_and_seed_database()

# tests/integration/test_phase_001_infrastructure.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_project():
    # POST /projects → verify 201 and git repo created
    # Project automatically saved to test_vibegrapher.db
    pass

def test_database_schema():
    # Verify all tables exist in test_vibegrapher.db
    pass
```

## Validation Script
```bash
#!/bin/bash
OUTPUT_DIR="backend/validated_test_evidence/phase-001"
mkdir -p $OUTPUT_DIR

# Run integration tests
pytest tests/integration/test_phase_001_infrastructure.py -v --tb=short > $OUTPUT_DIR/test_output.log 2>&1

# Test API endpoints
curl -X POST http://localhost:8000/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Project"}' > $OUTPUT_DIR/create_project.json

# Verify git repo created
ls -la media/projects/ > $OUTPUT_DIR/git_repos.txt

# Database state (using test database)
sqlite3 test_vibegrapher.db ".schema" > $OUTPUT_DIR/db_schema.sql
sqlite3 test_vibegrapher.db "SELECT * FROM projects;" > $OUTPUT_DIR/projects.txt

echo "Phase 001 validation complete"
```

## Setup Commands
```bash
# Create management directory
mkdir -p app/management

# Install dependencies with type checking and pygit2
pip install mypy sqlalchemy[mypy] types-python-dateutil types-requests pygit2

# Configure mypy
cat > mypy.ini << EOF
[mypy]
python_version = 3.11
warn_return_any = True
warn_unused_configs = True
disallow_untyped_defs = True
no_implicit_optional = True
check_untyped_defs = True
strict_equality = True

[mypy-tests.*]
ignore_errors = True

[mypy-alembic.*]
ignore_missing_imports = True
EOF

# Add to validation script
mypy app/ --show-error-codes
```

## Deliverables
- [ ] mypy.ini configuration
- [ ] Database models with type hints in app/models/
- [ ] Alembic migrations in alembic/versions/
- [ ] GitService with type hints in app/services/git_service.py
- [ ] CRUD endpoints with Pydantic models in app/api/projects.py
- [ ] Tests in tests/integration/test_phase_001_infrastructure.py
- [ ] Validation evidence in backend/validated_test_evidence/phase-001/