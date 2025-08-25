# Backend Phase 006: Human Review Flow with Test Execution

## Objectives
Implement human approval workflow for evaluator-approved diffs with test execution and git synchronization.

## Implementation Tasks
1. Create Diff model with git tracking (base_commit, target_branch)
2. Implement diff management endpoints including test execution
3. Add DiffTestService for running tests on uncommitted diffs
4. Add human feedback loop to VibecodeService
5. Integrate commit flow with GitService
6. Handle page refresh recovery

## Key Components

### Diff Model
```python
# Diff model is defined in spec_datamodel_v0.md lines 229-258
# See interface Diff with fields for git tracking, status, test results, etc.
# Status: 'evaluator_approved', 'human_reviewing', 'human_rejected', 'committed'
# Stores: vibecoder_prompt, evaluator_reasoning, commit_message, human_feedback
```

### Diff Management Endpoints
```python
# GET /sessions/{session_id}/diffs/pending - For page refresh recovery
# POST /diffs/{diff_id}/review - Set status based on approval/rejection
# POST /diffs/{diff_id}/test - Run tests on diff before committing
# POST /diffs/{diff_id}/commit - Verify base_commit, commit diff, clear evaluator context
# POST /diffs/{diff_id}/refine-message - Run evaluator for new commit message
```

### DiffTestService
```python
class DiffTestService:
    async def test_diff(diff_id: str, test_ids: List[str] = None):
        """Apply diff to temp code and run tests in sandbox"""
        # 1. Load diff and project from database
        # 2. Apply diff to temporary copy of project code
        # 3. Get tests to run:
        #    - If test_ids provided: run those specific tests
        #    - Otherwise: run all quick_test=True tests
        # 4. For each test:
        #    - Run in sandbox with temp code
        #    - Use 5s timeout for quick tests, 30s for others
        #    - Capture status, output, error, trace_id, token_usage
        # 5. Cache results on diff:
        #    - Store as JSON in test_results field
        #    - Update tests_run_at timestamp
        # 6. Return summary:
        #    - Total tests run, passed, failed
        #    - Individual test results with OpenAI traces
```

### Modified VibecodeService
```python
class VibecodeService:
    async def create_diff(session_id, project_id, diff_content, 
                         commit_message, evaluator_reasoning):
        # Validate diff before storing
        # 1. Apply patch to temp copy and check Python syntax
        # 2. If invalid, raise error with verbatim validation message
        # 3. Create Diff record with:
        #    - Git state (base_commit, target_branch)
        #    - Status: 'evaluator_approved'
        #    - Content: diff, commit message, reasoning
        # 4. Store in database
        # 5. Return diff for human review
```

## Acceptance Criteria
- ✅ Diff model tracks git state (base_commit, target_branch)
- ✅ All diffs validated before storage (syntax + applies cleanly)
- ✅ GET /sessions/:id/diffs/pending returns pending review diffs
- ✅ POST /diffs/:id/review handles human approval/rejection
- ✅ POST /diffs/:id/test runs tests on uncommitted diff
- ✅ Tests run in sandbox with 5s timeout for quick tests, 30s for full
- ✅ Test results cached on diff to avoid re-running
- ✅ POST /diffs/:id/commit commits approved diff to git
- ✅ Human rejection triggers new vibecode iteration
- ✅ Commit message can be refined via evaluator
- ✅ Page refresh recovers pending diff state
- ✅ Evaluator context cleared after successful commit

## Integration Tests
```python
# Test: Diff validation (invalid syntax fails, valid succeeds)
# Test: Test execution on diff (quick tests run < 5s)
# Test: Test results cached and not re-run if called again
# Test: Human review flow (approval changes status)
# Test: Human rejection triggers new vibecode iteration
# Test: Commit flow creates git commit and clears evaluator context
# Test: Page refresh recovery via GET /sessions/:id/diffs/pending
# Test: Failed tests don't block approval but are shown to user
```

## Deliverables
- [ ] Diff model with test_results field in app/models/diff.py
- [ ] Diff endpoints including /test in app/api/diffs.py
- [ ] DiffTestService in app/services/diff_test.py
- [ ] Updated VibecodeService with diff creation
- [ ] GitService methods for diff operations
- [ ] Updated TestCase model with quick_test flag
- [ ] Tests in tests/integration/test_phase_006_human_review.py
- [ ] Validation evidence in backend/validated_test_evidence/phase-006/