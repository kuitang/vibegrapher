# Frontend Phase 008: Human Review UI with Test Execution

## ⚠️ BACKEND DEPENDENCY CHECK
**REQUIRED**: Backend phases must be completed:
- `plans/backend-phase-004-agents.md` - For Diff model creation
- `plans/backend-phase-005-sessions.md` - For session management
- `plans/backend-phase-006-human-review.md` - For all diff endpoints including /diffs/:id/test

**VERIFICATION**: Check each backend file header for "# DONE as of commit". If ANY are missing, DO NOT START this phase and inform the user which backend dependencies are not ready.

## Objectives
Implement UI components for human diff review with test execution, commit message editing, and page refresh recovery.

## Implementation Tasks
1. Create DiffReviewModal component with test execution
2. Create CommitMessageModal component  
3. Add diff management and test results to Zustand store
4. Implement page refresh recovery
5. Handle WebSocket events for diff status and test results

## Key Components

### DiffReviewModal
```typescript
// Shows Monaco diff editor with evaluator reasoning and test execution
// handleRunTests: Runs selected tests on diff
// handleApprove: Opens CommitMessageModal (with or without tests)
// handleReject: Requires reason, sends 'human_rejection' message type
// UI: Dialog with Badge status, MonacoDiffEditor, Test runner, Accept/Reject buttons

interface DiffReviewModalProps {
  diff: Diff;
  onClose: () => void;
}

// Key features:
// - "Run Tests" button with dropdown to select quick/all/specific tests
// - Test results display with pass/fail badges inline
// - OpenAI trace_id shown prominently as clickable link
// - Token usage displayed clearly (prompt/completion/total)
// - Three approval modes: "Accept", "Test & Accept", "Accept without Testing"
// - Progress indicator during test execution
// - Cached test results shown if already run
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
// DiffState: pendingDiffs, currentReviewDiff, testResults, modal visibility flags
// loadPendingDiffs: Auto-opens modal if pending diff exists
// runDiffTests: Calls POST /diffs/:id/test endpoint
// sendHumanRejection: Sends message with 'human_rejection' type

interface DiffState {
  pendingDiffs: Diff[];
  currentReviewDiff: Diff | null;
  testResults: TestResult[] | null;
  isRunningTests: boolean;
  showDiffReviewModal: boolean;
  showCommitMessageModal: boolean;
  approvalMode: 'accept' | 'test-accept' | 'test-first';
}

// Actions:
// runDiffTests(diffId, testIds?): Run tests and store results
// setApprovalMode(mode): Set user preference for approval workflow
```

### Page Refresh Recovery
```typescript
// useDiffRecovery hook: Checks for pending diffs on mount
// Auto-opens appropriate modal based on diff status
// ProjectPage uses hook to restore state after refresh
```

### WebSocket Event Handling
```typescript
// vibecode_response: Opens DiffReviewModal if status='pending_human_review'
// diff_committed: Shows success toast, refreshes project code
```

## Acceptance Criteria
- ✅ DiffReviewModal shows diff with Accept/Reject/Test options
- ✅ "Run Tests" button executes tests on uncommitted diff
- ✅ Test results displayed with pass/fail badges
- ✅ Quick tests run with 5s timeout
- ✅ Three approval modes: Accept, Test & Accept, Test First
- ✅ Test results cached to avoid re-running
- ✅ Rejection requires reason and triggers new vibecode
- ✅ CommitMessageModal allows editing and refining message
- ✅ Page refresh recovers pending diff state and test results
- ✅ WebSocket events trigger appropriate modals
- ✅ Successful commit refreshes project code
- ✅ Toast notifications for all actions
- ✅ Loading states during test execution and async operations

## Integration Tests
```typescript
// Test: Auto-opens modal for pending diff
// Test: Run Tests button executes tests and shows results
// Test: Test results cached on second run
// Test: Approval flow → CommitMessageModal
// Test: Test & Accept mode runs tests then auto-approves if all pass
// Test: Rejection flow → New vibecode with feedback
// Test: Page refresh recovery restores modal state and test results
// Test: Failed tests shown but don't block approval
```

## Deliverables
- [ ] DiffReviewModal component with test runner
- [ ] CommitMessageModal component
- [ ] Test results display with OpenAI trace links
- [ ] Updated Zustand store with diff and test management
- [ ] useDiffRecovery hook for page refresh
- [ ] WebSocket event handlers for diff and test updates
- [ ] Tests in tests/integration/test_phase_007_human_review.tsx
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