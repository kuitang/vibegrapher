# DONE as of commit 7d1d2e3

# Backend Phase 006: Human Review Flow

## Objectives
Implement human approval workflow for evaluator-approved diffs with git synchronization. No test execution in v0.

## Implementation Tasks
1. Create Diff model with git tracking (base_commit, target_branch)
2. Implement diff management endpoints (review, commit, refine-message)
3. Add human feedback loop to VibecodeService
4. Integrate commit flow with GitService
5. Handle page refresh recovery

## Key Components

### Diff Model
```python
# Diff model is defined in spec_datamodel_v0.md lines 229-258
# See interface Diff with fields for git tracking, status, test results, etc.
# Status: 'evaluator_approved', 'human_rejected', 'committed'
# Stores: vibecoder_prompt, evaluator_reasoning, commit_message, human_feedback
```

### Diff Management Endpoints
```python
# GET /sessions/{session_id}/diffs/pending - For page refresh recovery
# POST /diffs/{diff_id}/review - Set status based on approval/rejection
# POST /diffs/{diff_id}/commit - Verify base_commit, commit diff, clear evaluator context
# POST /diffs/{diff_id}/refine-message - Run evaluator for new commit message
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
- ✅ POST /diffs/:id/commit commits approved diff to git
- ✅ Human rejection triggers new vibecode iteration
- ✅ Commit message can be refined via evaluator
- ✅ Page refresh recovers pending diff state
- ✅ Evaluator context cleared after successful commit

## Integration Tests
```python
# Test: Diff validation (invalid syntax fails, valid succeeds)
# Test: Human review flow (approval changes status)
# Test: Human rejection triggers new vibecode iteration
# Test: Commit flow creates git commit and clears evaluator context
# Test: Page refresh recovery via GET /sessions/:id/diffs/pending
```

## Deliverables
- [ ] Diff model in app/models/diff.py
- [ ] Diff endpoints in app/api/diffs.py
- [ ] Updated VibecodeService with diff creation
- [ ] GitService methods for diff operations
- [ ] Tests in tests/integration/test_phase_006_human_review.py
- [ ] Validation evidence in backend/validated_test_evidence/phase-006/