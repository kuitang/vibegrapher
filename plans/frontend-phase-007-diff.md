# Frontend Phase 007: Diff Handling
# DONE as of commit: Phase 007 Complete - Diff Viewer with Monaco DiffEditor

## ⚠️ BACKEND DEPENDENCY CHECK
**REQUIRED**: Backend phases must be completed:
- `plans/backend-phase-004-agents.md` - For vibecode responses with diffs (creates Diff model)
- `plans/backend-phase-006-human-review.md` - For diff management endpoints

**VERIFICATION**: Check each backend file header for "# DONE as of commit". If ANY are missing, DO NOT START this phase and inform the user which backend dependencies are not ready.

## Objectives
Implement diff viewer with shadcn components for patch review.

## Implementation Tasks
1. Monaco Diff Editor in Card component
2. Tabs for unified/split view
3. Button variants (success/destructive) for Accept/Reject
4. AlertDialog for confirmation
5. Tooltip showing session info

## Acceptance Criteria
- ✅ Diff viewer appears when patch received
- ✅ Tabs switch between unified/split view
- ✅ Accept Button (green) applies changes
- ✅ Reject Button (red) dismisses diff
- ✅ AlertDialog confirms before accepting
- ✅ Tooltip shows session_id on hover
- ✅ Code view updates after accept

## Integration Tests (Vitest + MSW)
```typescript
// tests/integration/phase007-diff.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiffViewer } from '../src/components/DiffViewer'

describe('Phase 007: Diff Viewer', () => {
  test('diff viewer with shadcn components', async () => {
    const user = userEvent.setup()
    const onAccept = vi.fn()
    const onReject = vi.fn()
    
    render(
      <DiffViewer
        original="old code"
        proposed="new code"
        patch="--- old\n+++ new"
        sessionId="session-123"
        onAccept={onAccept}
        onReject={onReject}
      />
    )
    
    // Verify diff editor in Card
    expect(screen.getByTestId('diff-card')).toHaveClass('card')
    
    // Test tab switching
    const splitTab = screen.getByRole('tab', { name: /split/i })
    await user.click(splitTab)
    expect(screen.getByTestId('monaco-diff')).toHaveAttribute('data-view', 'split')
    
    // Verify button variants
    const acceptBtn = screen.getByRole('button', { name: /accept/i })
    expect(acceptBtn).toHaveClass('bg-green-600')
    
    const rejectBtn = screen.getByRole('button', { name: /reject/i })
    expect(rejectBtn).toHaveClass('destructive')
    
    // Test AlertDialog on accept
    await user.click(acceptBtn)
    expect(screen.getByRole('alertdialog')).toBeVisible()
    
    const confirmBtn = screen.getByRole('button', { name: /confirm/i })
    await user.click(confirmBtn)
    expect(onAccept).toHaveBeenCalled()
    
    // Test session_id tooltip
    const sessionInfo = screen.getByTestId('session-info')
    await user.hover(sessionInfo)
    await waitFor(() => {
      expect(screen.getByText('session-123')).toBeVisible()
    })
  })
})
```

## E2E Test (Playwright - Headless)
```typescript
// tests/e2e/phase007-diff.e2e.ts
import { test, expect } from '@playwright/test'

test.describe('Phase 007: Diff Viewer E2E', () => {
  test('complete diff flow', async ({ page }) => {
    await page.goto('http://localhost:5173/project/test')
    
    // Trigger diff display (simulate WebSocket message)
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('ws-message', {
        detail: {
          type: 'vibecode_response',
          patch: '--- old\n+++ new\n@@ -1 +1 @@\n-old code\n+new code',
          session_id: 'session-123'
        }
      }))
    })
    
    // Verify diff viewer appears
    await expect(page.locator('.monaco-diff-editor')).toBeVisible()
    
    // Test tab switching
    await page.click('button[role="tab"]:has-text("Split")')
    await expect(page.locator('.monaco-diff-editor.side-by-side')).toBeVisible()
    
    // Test AlertDialog flow
    await page.click('button:has-text("Accept")')
    await expect(page.locator('[role="alertdialog"]')).toBeVisible()
    await page.click('button:has-text("Confirm")')
    
    // Verify code updated
    await expect(page.locator('.monaco-editor')).toContainText('new code')
    
    // Test tooltip
    await page.hover('[data-testid="trace-info"]')
    await expect(page.locator('text=trace-123')).toBeVisible()
  })
})
```

## Validation Script
```bash
#!/bin/bash
OUTPUT_DIR="frontend/validated_test_evidence/phase-007"
mkdir -p $OUTPUT_DIR

# Run integration tests
npm test -- --run tests/integration/phase007-diff.test.tsx > $OUTPUT_DIR/vitest.log 2>&1

# Run E2E tests (headless)
npx playwright test tests/e2e/phase007-diff.e2e.ts \
  --reporter=json \
  > $OUTPUT_DIR/playwright.json

# Capture diff viewer screenshot
npx playwright screenshot \
  --selector='.diff-viewer' \
  http://localhost:5173/project/test \
  $OUTPUT_DIR/diff-viewer.png

echo "Phase 007 validation complete"
```

## shadcn Components Used
```bash
# Required shadcn components for this phase
npx shadcn-ui@latest add tabs alert-dialog tooltip
```

## Deliverables
- [ ] DiffViewer component with Monaco Diff Editor
- [ ] Tab switching for view modes
- [ ] Accept/Reject with AlertDialog
- [ ] Trace ID tooltip
- [ ] Integration tests
- [ ] E2E tests
- [ ] Validation evidence in frontend/validated_test_evidence/phase-007/