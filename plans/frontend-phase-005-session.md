# Frontend Phase 005: Session & Message Flow

## ⚠️ BACKEND DEPENDENCY CHECK
**REQUIRED**: Backend phases must be completed:
- `plans/backend-phase-001-infrastructure.md` - For project endpoints
- `plans/backend-phase-004-agents.md` - For vibecode functionality  
- `plans/backend-phase-005-sessions.md` - For session management endpoints

**VERIFICATION**: Check each backend file header for "# DONE as of commit". If ANY are missing, DO NOT START this phase and inform the user which backend dependencies are not ready.

## Objectives
Implement session management and message flow with shadcn components.

## Implementation Tasks
1. Button components for session actions
2. ScrollArea for message history
3. Avatar + Card for message bubbles
4. Textarea with auto-resize for input
5. Badge for session status

## Acceptance Criteria
- ✅ "Start Session" Button creates session via API
- ✅ Session Badge shows "active" status
- ✅ Messages display in ScrollArea with Avatar icons
- ✅ Textarea auto-resizes as user types
- ✅ Send message on Enter key
- ✅ "Clear Session" Button resets conversation
- ✅ Session persists in Zustand store

## Integration Tests (Vitest + MSW v2)
```typescript
// tests/integration/phase005-session.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'  // MSW v2
import { setupServer } from 'msw/node'
import { VibecodePanel } from '../src/components/VibecodePanel'

const server = setupServer(
  http.post('http://localhost:8000/projects/:id/sessions', () => {
    return HttpResponse.json({ session_id: 'test-session', type: 'global' })
  }),
  http.post('http://localhost:8000/sessions/:id/messages', () => {
    return HttpResponse.json({
      message_id: 'msg-123',
      trace_id: 'trace-123',
      status: 'success'
    })
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('Phase 005: Session Management', () => {
  test('complete session flow with shadcn components', async () => {
    const user = userEvent.setup()
    render(<VibecodePanel projectId="test-project" />)
    
    // Start session
    const startBtn = screen.getByRole('button', { name: /start session/i })
    await user.click(startBtn)
    
    // Verify Badge shows active
    await waitFor(() => {
      expect(screen.getByText('active')).toHaveClass('badge')
    })
    
    // Type and send message
    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'Create a triage agent')
    await user.keyboard('{Enter}')
    
    // Verify message appears with Avatar
    await waitFor(() => {
      expect(screen.getByText('Create a triage agent')).toBeInTheDocument()
      expect(screen.getByRole('img', { name: /user avatar/i })).toBeInTheDocument()
    })
    
    // Clear session
    const clearBtn = screen.getByRole('button', { name: /clear session/i })
    await user.click(clearBtn)
    
    await waitFor(() => {
      expect(screen.queryByText('active')).not.toBeInTheDocument()
    })
  })
  
  test('textarea auto-resizes', async () => {
    const user = userEvent.setup()
    render(<VibecodePanel projectId="test-project" />)
    
    const textarea = screen.getByRole('textbox')
    const initialHeight = textarea.clientHeight
    
    // Type multiline text
    await user.type(textarea, 'Line 1\nLine 2\nLine 3')
    
    expect(textarea.clientHeight).toBeGreaterThan(initialHeight)
  })
})
```

## E2E Test (Playwright - Headless)
```typescript
// tests/e2e/phase005-session.e2e.ts
import { test, expect } from '@playwright/test'

test.describe('Phase 005: Session E2E', () => {
  test('full session flow', async ({ page }) => {
    await page.goto('http://localhost:5173/project/test')
    
    // Start session
    await page.click('button:has-text("Start Session")')
    await expect(page.locator('.badge:has-text("active")')).toBeVisible()
    
    // Send message
    const textarea = page.locator('textarea[placeholder*="Enter"]')
    await textarea.fill('Create a triage agent')
    await textarea.press('Enter')
    
    // Verify message with Avatar in ScrollArea
    await expect(page.locator('.avatar').first()).toBeVisible()
    await expect(page.locator('[data-radix-scroll-area]')).toContainText('Create a triage agent')
    
    // Clear session
    await page.click('button:has-text("Clear Session")')
    await expect(page.locator('.badge:has-text("active")')).not.toBeVisible()
  })
})
```

## Validation Script
```bash
#!/bin/bash
OUTPUT_DIR="frontend/validated_test_evidence/phase-005"
mkdir -p $OUTPUT_DIR

# Run integration tests with MSW mocks
npm test -- --run tests/integration/phase005-session.test.tsx > $OUTPUT_DIR/vitest.log 2>&1

# Run E2E tests (headless)
npx playwright test tests/e2e/phase005-session.e2e.ts \
  --reporter=json \
  --output=$OUTPUT_DIR \
  > $OUTPUT_DIR/playwright.json

# Capture session flow screenshots (headless)
npx playwright screenshot \
  --selector='.vibecode-panel' \
  http://localhost:5173/project/test \
  $OUTPUT_DIR/session-panel.png

echo "Phase 005 validation complete"
```

## shadcn Components Used
```bash
# Required shadcn components for this phase
npx shadcn-ui@latest add button badge avatar scroll-area textarea card
```

## Deliverables
- [ ] VibecodePanel component with session logic
- [ ] Message components with Avatar + Card
- [ ] Auto-resize Textarea component
- [ ] Session state in Zustand store
- [ ] Integration tests with MSW
- [ ] E2E tests with Playwright
- [ ] Validation evidence in frontend/validated_test_evidence/phase-005/