# Frontend Phase 006: Code Viewer

## ⚠️ BACKEND DEPENDENCY CHECK
**REQUIRED**: Backend phases must be completed:
- `plans/backend-phase-001-infrastructure.md` - For GET /projects/:id endpoint
- `plans/backend-phase-002-socketio.md` - For real-time code updates

**VERIFICATION**: Check each backend file header for "# DONE as of commit". If ANY are missing, DO NOT START this phase and inform the user which backend dependencies are not ready.

## Objectives
Implement Monaco editor for code display with WebSocket updates.

## Implementation Tasks
1. Monaco editor (read-only)
2. Python syntax highlighting
3. Refresh on WebSocket code changes
4. Theme synchronization with app

## Acceptance Criteria
- ✅ Monaco editor displays in right panel
- ✅ Python syntax highlighting active
- ✅ Read-only mode enforced
- ✅ Code updates when WebSocket broadcasts changes
- ✅ Line numbers visible
- ✅ Theme matches app theme (light/dark)

## Integration Tests (Vitest)
```typescript
// tests/integration/phase006-code-viewer.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { CodeViewer } from '../src/components/CodeViewer'
import { useAppStore } from '../src/store'

describe('Phase 006: Code Viewer', () => {
  test('monaco editor renders with Python highlighting', async () => {
    render(<CodeViewer projectId="test" />)
    
    await waitFor(() => {
      const editor = screen.getByTestId('monaco-container')
      expect(editor).toBeInTheDocument()
      expect(editor).toHaveAttribute('data-language', 'python')
    })
  })
  
  test('updates on WebSocket message', async () => {
    const { rerender } = render(<CodeViewer projectId="test" />)
    
    // Simulate WebSocket message via store
    const store = useAppStore.getState()
    store.updateCode('def new_function():\n    pass')
    
    rerender(<CodeViewer projectId="test" />)
    
    await waitFor(() => {
      const editor = screen.getByTestId('monaco-container')
      expect(editor).toHaveTextContent('new_function')
    })
  })
  
  test('read-only mode enforced', () => {
    render(<CodeViewer projectId="test" />)
    
    const editor = screen.getByTestId('monaco-container')
    expect(editor).toHaveAttribute('data-readonly', 'true')
  })
})
```

## E2E Test (Playwright - Headless)
```typescript
// tests/e2e/phase006-code-viewer.e2e.ts
import { test, expect } from '@playwright/test'

test.describe('Phase 006: Code Viewer E2E', () => {
  test('monaco displays and updates', async ({ page }) => {
    await page.goto('http://localhost:5173/project/test')
    
    // Verify Monaco loaded
    const editor = page.locator('.monaco-editor')
    await expect(editor).toBeVisible()
    
    // Verify Python syntax highlighting
    await expect(editor.locator('.mtk5')).toBeVisible()  // Python keyword
    
    // Verify read-only
    const isReadOnly = await editor.evaluate(el => 
      el.classList.contains('monaco-editor-readOnly')
    )
    expect(isReadOnly).toBeTruthy()
    
    // Test theme sync
    await page.click('[data-testid="theme-toggle"]')
    await expect(editor).toHaveClass(/monaco-editor-dark/)
  })
})
```

## Validation Script
```bash
#!/bin/bash
OUTPUT_DIR="frontend/validated_test_evidence/phase-006"
mkdir -p $OUTPUT_DIR

# Run integration tests
npm test -- --run tests/integration/phase006-code-viewer.test.tsx > $OUTPUT_DIR/vitest.log 2>&1

# Run E2E tests (headless)
npx playwright test tests/e2e/phase006-code-viewer.e2e.ts \
  --reporter=json \
  > $OUTPUT_DIR/playwright.json

# Capture editor screenshot
npx playwright screenshot \
  --selector='.monaco-editor' \
  http://localhost:5173/project/test \
  $OUTPUT_DIR/code-editor.png

echo "Phase 006 validation complete"
```

## Deliverables
- [ ] CodeViewer component with Monaco
- [ ] WebSocket integration for updates
- [ ] Theme synchronization
- [ ] Integration tests
- [ ] E2E tests
- [ ] Validation evidence in frontend/validated_test_evidence/phase-006/