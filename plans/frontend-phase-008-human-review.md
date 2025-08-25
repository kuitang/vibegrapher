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