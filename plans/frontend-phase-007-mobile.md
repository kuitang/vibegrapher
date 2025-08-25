# Frontend Phase 007: Mobile Responsive

## Objectives
Implement mobile-responsive design with shadcn mobile components.

## Implementation Tasks
1. Sheet component for mobile navigation
2. Tabs for panel switching
3. Drawer for bottom actions
4. DropdownMenu for compact actions

## Acceptance Criteria
- ✅ At 375px width, panels stack vertically
- ✅ Sheet slides from left for navigation
- ✅ Tabs allow switching between Vibecode/Code/Tests
- ✅ Drawer appears from bottom for actions
- ✅ DropdownMenu replaces button groups
- ✅ Touch gestures work (swipe, tap)
- ✅ All text remains readable

## Integration Tests (Vitest)
```typescript
// tests/integration/phase007-mobile.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../src/App'

describe('Phase 007: Mobile Responsive', () => {
  beforeEach(() => {
    // Set mobile viewport
    window.innerWidth = 375
    window.innerHeight = 667
  })
  
  test('mobile layout with shadcn Sheet', async () => {
    // Render app in mobile viewport
    // Click mobile menu → verify Sheet opens
    // Verify navigation items visible in Sheet
  })
  
  test('tabs for panel switching', async () => {
    // Verify Tabs visible on mobile
    // Click Code tab → verify code panel visible
    // Click Tests tab → verify test panel visible
  })
  
  test('drawer for bottom actions', async () => {
    // Click mobile actions → verify Drawer opens at bottom
  })
  
  test('dropdown menu for compact actions', async () => {
    // Click more actions → verify DropdownMenu with 3 items
  })
})
```

## E2E Test (Playwright - Mobile Viewport)
```typescript
// tests/e2e/phase007-mobile.e2e.ts
import { test, expect, devices } from '@playwright/test'

// Use iPhone SE viewport
test.use(devices['iPhone SE'])

test.describe('Phase 007: Mobile E2E', () => {
  test('complete mobile experience', async ({ page }) => {
    await page.goto('http://localhost:5173/project/test')
    
    // Verify mobile layout
    const viewport = page.viewportSize()
    expect(viewport.width).toBe(375)
    
    // Test Sheet navigation
    await page.click('[data-testid="mobile-menu"]')
    const sheet = page.locator('.sheet')
    await expect(sheet).toBeVisible()
    
    // Close sheet by clicking overlay
    await page.click('.sheet-overlay')
    await expect(sheet).not.toBeVisible()
    
    // Test Tabs
    const tabs = page.locator('[role="tablist"]')
    await expect(tabs).toBeVisible()
    
    await page.click('[role="tab"]:has-text("Code")')
    await expect(page.locator('.monaco-editor')).toBeVisible()
    
    await page.click('[role="tab"]:has-text("Vibecode")')
    await expect(page.locator('.vibecode-panel')).toBeVisible()
    
    // Test Drawer
    await page.click('[data-testid="mobile-actions"]')
    const drawer = page.locator('.drawer')
    await expect(drawer).toBeVisible()
    await expect(drawer).toHaveCSS('position', 'fixed')
    
    // Test swipe gesture
    await page.touchscreen.swipe(
      { x: 0, y: 300 },
      { x: 200, y: 300 }
    )
    await expect(page.locator('.sheet')).toBeVisible()
    
    // Test DropdownMenu
    await page.click('[data-testid="more-actions"]')
    const menu = page.locator('[role="menu"]')
    await expect(menu).toBeVisible()
  })
  
  test('text remains readable', async ({ page }) => {
    await page.goto('http://localhost:5173/project/test')
    
    // Check font sizes
    const body = page.locator('body')
    const fontSize = await body.evaluate(el => 
      window.getComputedStyle(el).fontSize
    )
    expect(parseInt(fontSize)).toBeGreaterThanOrEqual(14)
    
    // Check button sizes for touch
    const buttons = page.locator('button')
    const firstButton = buttons.first()
    const box = await firstButton.boundingBox()
    expect(box.height).toBeGreaterThanOrEqual(44)  // iOS touch target
  })
})
```

## Validation Script
```bash
#!/bin/bash
OUTPUT_DIR="frontend/validated_test_evidence/phase-007"
mkdir -p $OUTPUT_DIR

# Run integration tests with mobile viewport
npm test -- --run tests/integration/phase007-mobile.test.tsx > $OUTPUT_DIR/vitest.log 2>&1

# Run E2E tests with mobile devices (headless)
npx playwright test tests/e2e/phase007-mobile.e2e.ts \
  --reporter=json \
  > $OUTPUT_DIR/playwright.json

# Capture mobile screenshots (various devices)
for device in "iPhone SE" "Pixel 5" "iPad Mini"; do
  npx playwright screenshot \
    --device="$device" \
    http://localhost:5173/project/test \
    "$OUTPUT_DIR/mobile-${device// /-}.png"
done

echo "Phase 007 validation complete"
```

## shadcn Components Used
```bash
# Required shadcn components for this phase
npx shadcn-ui@latest add sheet drawer dropdown-menu
```

## Deliverables
- [ ] Mobile-responsive layout
- [ ] Sheet for navigation
- [ ] Tabs for panel switching
- [ ] Drawer for bottom actions
- [ ] DropdownMenu for compact UI
- [ ] Touch gesture support
- [ ] Integration tests
- [ ] E2E tests with mobile viewports
- [ ] Validation evidence in validated_test_evidence/phase-007/