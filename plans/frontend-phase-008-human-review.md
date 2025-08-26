# Frontend Phase 008: Human Review UI
# DONE

## ⚠️ BACKEND DEPENDENCY CHECK
**REQUIRED**: Backend phases must be completed:
- `plans/backend-phase-004-agents.md` - For Diff model creation
- `plans/backend-phase-005-sessions.md` - For session management
- `plans/backend-phase-006-human-review.md` - For all diff endpoints

**VERIFICATION**: Check each backend file header for "# DONE as of commit". If ANY are missing, DO NOT START this phase and inform the user which backend dependencies are not ready.

## Objectives
Implement UI components for human diff review, commit message editing, and page refresh recovery. No test execution in v0.

## Implementation Tasks
1. Create DiffReviewModal component
2. Create CommitMessageModal component  
3. Add diff management to Zustand store
4. Implement page refresh recovery
5. Handle WebSocket events for diff status updates

## Key Components

### DiffReviewModal
```typescript
// Shows Monaco diff editor with evaluator reasoning
// handleApprove: Opens CommitMessageModal
// handleReject: Requires reason, sends 'human_rejection' message type
// UI: Dialog with Badge status, MonacoDiffEditor, Accept/Reject buttons

interface DiffReviewModalProps {
  diff: Diff;
  onClose: () => void;
}

// Key features:
// - Diff viewer with Monaco editor
// - Evaluator reasoning displayed prominently
// - Token usage displayed clearly (prompt/completion/total)
// - Accept/Reject buttons with clear workflow
// - Rejection requires feedback reason
```

### CommitMessageModal
```typescript
// Editable commit message with "Refine with AI" button
// handleRefine: Calls evaluator for new suggestion
// handleCommit: Commits diff, refreshes project code
// Handles rebase_needed error if base commit changed
```

### Updated Zustand Store
```typescript
// DiffState: pendingDiffs, currentReviewDiff, modal visibility flags
// loadPendingDiffs: Auto-opens modal if pending diff exists
// sendHumanRejection: Sends message with 'human_rejection' type

interface DiffState {
  pendingDiffs: Diff[];
  currentReviewDiff: Diff | null;
  showDiffReviewModal: boolean;
  showCommitMessageModal: boolean;
}

// Actions:
// approveDiff(diffId): Approve diff and open commit modal
// rejectDiff(diffId, reason): Reject diff with feedback
```

### Page Refresh Recovery
```typescript
// useDiffRecovery hook: Checks for pending diffs on mount
// Auto-opens appropriate modal based on diff status
// ProjectPage uses hook to restore state after refresh
```

### WebSocket Event Handling
```typescript
// conversation_message: Handle agent responses and diff creation
// diff_committed: Shows success toast, refreshes project code
```

## Acceptance Criteria
- ✅ DiffReviewModal shows diff with Accept/Reject options
- ✅ Rejection requires reason and triggers new vibecode
- ✅ CommitMessageModal allows editing and refining message
- ✅ Page refresh recovers pending diff state
- ✅ WebSocket events trigger appropriate modals
- ✅ Successful commit refreshes project code
- ✅ Toast notifications for all actions
- ✅ Loading states during async operations

## Integration Tests
```typescript
// Test: Auto-opens modal for pending diff
// Test: Approval flow → CommitMessageModal
// Test: Rejection flow → New vibecode with feedback
// Test: Page refresh recovery restores modal state
```

## Deliverables
- [ ] DiffReviewModal component
- [ ] CommitMessageModal component
- [ ] Updated Zustand store with diff management
- [ ] useDiffRecovery hook for page refresh
- [ ] WebSocket event handlers for diff updates
- [ ] Tests in tests/integration/test_phase_008_human_review.tsx
- [ ] Validation evidence in frontend/validated_test_evidence/phase-008/

## 🔴 CRITICAL E2E TEST: Complete Vibecoder Workflow

### FINAL DELIVERABLE: `frontend/tests/e2e/vibecoder-workflow.spec.ts`

**IMPORTANT**: This comprehensive E2E test must be written AFTER all component tests pass. It validates the entire vibecoder workflow from spec_datamodel_v0.md section "Vibecoder Interactive Workflow".

```typescript
test.describe('Complete Vibecoder Iterative Refinement Workflow', () => {
  // Prerequisites: All phase 001-008 tests passing
  
  test('handles max iterations with context persistence', async ({ page }) => {
    // Setup: Create project and start session
    
    // 1. Send prompt that will trigger evaluator rejections
    // 2. Verify conversation history shows ALL messages:
    //    - User: "Add feature X"
    //    - VibeCoder: "Generated patch..." (iteration 1)
    //    - Evaluator: "Rejected: reason A" (iteration 1)
    //    - VibeCoder: "Updated patch..." (iteration 2)
    //    - Evaluator: "Rejected: reason B" (iteration 2)
    //    - VibeCoder: "Further refined..." (iteration 3)
    //    - Evaluator: "Rejected: reason C" (iteration 3)
    // 3. Verify each message shows token usage badge
    // 4. Verify error message: "Max iterations reached"
    // 5. Send NEW message with guidance
    // 6. Verify conversation continues with all previous context visible
    // 7. Verify successful patch generation using previous context
  });
  
  test('successful patch flow with human review', async ({ page }) => {
    // 1. Send prompt that generates valid patch
    // 2. Verify DiffReviewModal opens automatically
    // 3. Run tests on diff (verify token usage display)
    // 4. Accept → verify CommitMessageModal opens
    // 5. Refine message with AI
    // 6. Commit → verify success
    // 7. Send ANOTHER prompt
    // 8. Verify evaluator has fresh context (no bias from previous patch)
    // 9. Verify VibeCoder still has conversation history
  });
  
  test('human rejection triggers new iteration', async ({ page }) => {
    // 1. Generate patch that needs improvement
    // 2. DiffReviewModal opens
    // 3. Reject with specific feedback
    // 4. Verify new vibecode iteration starts with feedback
    // 5. Verify improved patch incorporates feedback
    // 6. Accept and commit
  });
  
  test('conversation persistence across multiple patches', async ({ page }) => {
    // 1. Generate and commit first patch
    // 2. Generate and commit second patch
    // 3. Verify VibeCoder maintains context across both
    // 4. Verify token usage accumulates correctly
    // 5. Verify conversation history shows all interactions
  });
});
```

### Why This Test Is Critical

This E2E test validates the CORE INNOVATION of vibegrapher:
- **VibeCoder persists context** enabling iterative refinement across messages
- **Evaluator resets after commit** ensuring fresh evaluation
- **Human feedback integrates** into the automated loop
- **Token usage tracks** across the entire conversation

### Test Must Verify

1. **Conversation history** displays ALL agent interactions (not just final results)
2. **Visual clarity** - Each message clearly labeled (User/VibeCoder/Evaluator)
3. **Token usage** visible on each message (💵 123 tokens)
4. **Patch previews** shown inline in conversation
5. **Max iterations error** allows continuation with new message
6. **Context persistence** - VibeCoder remembers everything
7. **Evaluator clearing** - fresh evaluation after commit
8. **Human rejection** properly feeds back into vibecode loop
9. **Scrollable history** - All messages remain accessible

### Prerequisites Before Writing This Test

✅ All component tests from phases 001-007 must pass
✅ DiffReviewModal, CommitMessageModal working
✅ WebSocket events properly handled
✅ Page refresh recovery functional

**DO NOT SKIP THIS TEST** - It validates the fundamental workflow that makes vibegrapher unique.