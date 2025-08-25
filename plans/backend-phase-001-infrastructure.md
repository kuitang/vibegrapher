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
# tests/conftest.py - Use test database for all tests
# tests/integration/test_phase_001_infrastructure.py:
# - test_create_project: POST /projects → verify 201 and git repo created
# - test_git_repository_structure: Assert files exist at correct paths
#   IMPORTANT: Git integration tests must assert file structure/content
# - test_database_schema: Verify all tables exist
```

## Validation Requirements
- Write pytest + httpx integration tests covering all acceptance criteria
- Test manually with curl commands for POST /projects, GET /projects/{id}, DELETE /projects/{id}
- Verify git repositories are created in media/projects/{project_id}/
- Check database schema and sample data with sqlite3 commands
- Save test evidence in validated_test_evidence/phase-001/

## Setup Commands
```bash
# Standard setup: backend/, app/management/, validated_test_evidence/
# Dependencies: mypy, sqlalchemy[mypy], pygit2
# mypy.ini: Strict type checking configuration
```

## Deliverables
- [ ] mypy.ini configuration
- [ ] Database models with type hints in app/models/
- [ ] Alembic migrations in alembic/versions/
- [ ] GitService with type hints in app/services/git_service.py
- [ ] CRUD endpoints with Pydantic models in app/api/projects.py
- [ ] Tests in tests/integration/test_phase_001_infrastructure.py
- [ ] Validation evidence in backend/validated_test_evidence/phase-001/