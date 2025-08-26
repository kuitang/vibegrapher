# Frontend Phase 006: Test Runner

## Objectives
Build test management UI with shadcn Table and components.

## Implementation Tasks
1. Table component for test list
2. Dialog for add/edit test forms
3. Button with loading state for run
4. Progress bar during test execution
5. Alert components for results
6. Collapsible for detailed output

## Acceptance Criteria
- ✅ Table displays test cases with columns
- ✅ "Add Test" opens Dialog with form
- ✅ Form validates required fields
- ✅ Run Button shows spinner while running
- ✅ Progress bar animates during execution
- ✅ Alert shows success (green) or error (red)
- ✅ Collapsible expands to show full output
- ✅ Badge shows pass/fail count

## Integration Tests (Vitest + MSW)
```typescript
// tests/integration/phase006-test-runner.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { rest } from 'msw'
import { TestRunner } from '../src/components/TestRunner'

const server = setupServer(
  rest.post('http://localhost:8000/tests', (req, res, ctx) => {
    return res(ctx.json({ id: 'test-123', name: req.body.name }))
  }),
  rest.post('http://localhost:8000/tests/:id/run', (req, res, ctx) => {
    return res(
      ctx.delay(1000),  // Simulate test execution
      ctx.json({ status: 'passed', output: 'Test output', test_id: 'test-456' })
    )
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('Phase 006: Test Runner', () => {
  test('complete test management flow', async () => {
    const user = userEvent.setup()
    render(<TestRunner projectId="test-project" />)
    
    // Verify Table structure
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    
    // Add test via Dialog
    const addBtn = screen.getByRole('button', { name: /add test/i })
    await user.click(addBtn)
    
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeVisible()
    
    // Fill form
    const nameInput = screen.getByLabelText(/name/i)
    const promptInput = screen.getByLabelText(/prompt/i)
    await user.type(nameInput, 'Test Spanish Agent')
    await user.type(promptInput, 'Add Spanish agent')
    
    await user.click(screen.getByRole('button', { name: /save/i }))
    
    // Verify test added to table
    await waitFor(() => {
      expect(screen.getByText('Test Spanish Agent')).toBeInTheDocument()
    })
    
    // Run test with loading state
    const runBtn = screen.getByRole('button', { name: /run/i })
    await user.click(runBtn)
    
    // Verify Progress bar appears
    expect(screen.getByRole('progressbar')).toBeVisible()
    
    // Wait for completion
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveClass('alert-success')
    }, { timeout: 2000 })
    
    // Expand Collapsible for details
    const expandBtn = screen.getByTestId('expand-output')
    await user.click(expandBtn)
    expect(screen.getByText('Test output')).toBeVisible()
  })
  
  test('form validation', async () => {
    const user = userEvent.setup()
    render(<TestRunner projectId="test-project" />)
    
    await user.click(screen.getByRole('button', { name: /add test/i }))
    await user.click(screen.getByRole('button', { name: /save/i }))
    
    // Should show validation errors
    expect(screen.getByText(/name is required/i)).toBeVisible()
    expect(screen.getByText(/prompt is required/i)).toBeVisible()
  })
})
```

## E2E Test (Playwright - Headless)
```typescript
// tests/e2e/phase006-test-runner.e2e.ts
import { test, expect } from '@playwright/test'

test.describe('Phase 006: Test Runner E2E', () => {
  test('test runner with shadcn Table', async ({ page }) => {
    await page.goto('http://localhost:5173/project/test')
    
    // Open test panel
    await page.click('[data-testid="test-panel-toggle"]')
    
    // Verify Table
    const table = page.locator('table')
    await expect(table).toBeVisible()
    await expect(table.locator('thead th')).toContainText(['Name', 'Status', 'Actions'])
    
    // Add test
    await page.click('button:has-text("Add Test")')
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()
    
    await dialog.locator('input[name="name"]').fill('E2E Test')
    await dialog.locator('textarea[name="prompt"]').fill('Test prompt')
    await dialog.locator('button:has-text("Save")').click()
    
    // Run test
    await page.click('button:has-text("Run")').first()
    await expect(page.locator('[role="progressbar"]')).toBeVisible()
    
    // Wait for result
    await expect(page.locator('.alert')).toBeVisible({ timeout: 10000 })
    
    // Expand output
    await page.click('[data-testid="expand-output"]')
    await expect(page.locator('[data-state="open"]')).toBeVisible()
  })
})
```

## Validation Script
```bash
#!/bin/bash
OUTPUT_DIR="frontend/validated_test_evidence/phase-006"
mkdir -p $OUTPUT_DIR

# Run integration tests
npm test -- --run tests/integration/phase006-test-runner.test.tsx > $OUTPUT_DIR/vitest.log 2>&1

# Run E2E tests (headless)
npx playwright test tests/e2e/phase006-test-runner.e2e.ts \
  --reporter=json \
  > $OUTPUT_DIR/playwright.json

# Capture test runner screenshot
npx playwright screenshot \
  --selector='[data-testid="test-panel"]' \
  http://localhost:5173/project/test \
  $OUTPUT_DIR/test-runner.png

echo "Phase 006 validation complete"
```

## shadcn Components Used
```bash
# Required shadcn components for this phase
npx shadcn-ui@latest add table dialog form progress alert collapsible badge
```

## Deliverables
- [ ] TestRunner component with Table
- [ ] Add/Edit test Dialog with form
- [ ] Progress bar for running tests
- [ ] Alert components for results
- [ ] Collapsible for output
- [ ] Integration tests with MSW
- [ ] E2E tests with Playwright
- [ ] Validation evidence in validated_test_evidence/phase-006/