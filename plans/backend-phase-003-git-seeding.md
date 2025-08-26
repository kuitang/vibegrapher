# DONE as of commit 0882337

# Backend Phase 003: Git Service & Database Seeding

## Objectives
Implement GitService for repository management and create seed data with sample agent code for testing and demonstrations.

## Prerequisites
- Phase 001 (Database models) completed
- Phase 002 (Socket.io) completed

## Implementation Tasks
1. Implement GitService with pygit2
2. Create management command for database reset and seeding
3. Write unit tests for GitService operations
4. Write integration tests using seeded data
5. Update project endpoints to use GitService

## GitService Implementation

### Core Methods Required
- `create_repository(project_id: str) -> str`: Initialize git repo, return path
- `get_current_code(project_id: str) -> str`: Read current file content
- `get_head_commit(project_id: str) -> str`: Get current HEAD SHA
- `get_current_branch(project_id: str) -> str`: Get active branch name
- `commit_changes(project_id: str, content: str, message: str) -> str`: Create commit, return SHA
- `delete_repository(project_id: str) -> bool`: Remove git repository

### Error Handling
- Handle missing repositories gracefully
- Validate project_id format
- Handle file I/O errors
- Proper cleanup on failures

## Seed Data Requirements

### Management Command: reset_and_seed_database()
Create a management command that:
1. Drops all existing tables
2. Runs Alembic migrations to recreate schema
3. Creates sample project with git repository
4. Initializes repository with sample agent code
5. Can be run with `python -m backend.app.management.reset_db`

### Sample Project Data
**Project 1: "Agent Triage System"**
- Name: "Agent Triage System"
- Git repository initialized at: `backend/media/projects/{project_id}/`
- Initial code file: `agents.py` with content adapted from OpenAI quickstart:
  - Import statements for OpenAI Agents SDK
  - One simple Agent definition (e.g., TriageAgent)
  - Basic Runner setup
  - Comments explaining the structure
- Git commit: "Initial agent code"
- This provides a realistic starting point for vibecoding

### Git Repository Initialization Steps
1. Create directory at `backend/media/projects/{project_id}/`
2. Initialize git repository with pygit2
3. Create `agents.py` file with sample agent code
4. Add file to git index
5. Create initial commit with message "Initial agent code"
6. Store commit SHA in Project.current_commit field
7. Store file content in Project.current_code field

### Database State After Seeding
- 1 Project record with:
  - Valid UUID id
  - name: "Agent Triage System"
  - repository_path: "backend/media/projects/{id}/"
  - current_code: Content of agents.py
  - current_commit: SHA of initial commit
  - current_branch: "main"
- No VibecodeSession records (created in phase 005)
- No ConversationMessage records (created in phase 005)
- 2 TestCase records:
  - Test 1: "Test triage routing" - Simple test that verifies agent responds
  - Test 2: "Test quick response" - Test with quick_test=True (5s timeout)

### Why This Level of Detail?
- Frontend needs a real project to display immediately
- Integration tests need consistent data to verify
- Git repository must be valid for all GitService operations
- Sample code provides context for vibecoding demonstrations
- Based on OpenAI's official quickstart for familiarity

## Update Project Endpoints
Modify the project endpoints from Phase 001:
- POST /projects: Use GitService to create repository
- GET /projects/{id}: Use GitService to get current code
- DELETE /projects/{id}: Use GitService to delete repository

## Testing Requirements

### Unit Tests for GitService
- Test repository creation
- Test commit operations
- Test branch operations
- Test error handling
- Mock file system for isolation

### Integration Tests with Seeding
- Run reset_and_seed_database
- Verify project exists with correct data
- Test GitService operations on seeded repository
- Verify git history is correct
- Test that frontend can load seeded project
- Run the 2 seeded test cases to verify they execute:
  - Execute both tests in sandbox environment
  - Verify quick test completes within 5 seconds
  - Verify test results are stored correctly

## Acceptance Criteria
- ✅ GitService implements all required methods
- ✅ Management command creates valid seed data
- ✅ Git repository properly initialized with sample code
- ✅ Unit tests cover all GitService methods
- ✅ Integration tests verify seeded data works
- ✅ Project endpoints use GitService
- ✅ Sample agent code based on OpenAI quickstart
- ✅ All git operations handle errors gracefully

## Deliverables
- [ ] GitService with type hints in backend/app/services/git_service.py
- [ ] Management command in backend/app/management/reset_db.py
- [ ] Unit tests in backend/tests/unit/test_git_service.py
- [ ] Integration tests in backend/tests/integration/test_phase_003_git_seeding.py
- [ ] Updated project endpoints using GitService
- [ ] Sample agent code file for seeding
- [ ] Validation evidence in backend/validated_test_evidence/phase-003/