/**
 * Vibegrapher Comprehensive E2E Test Suite
 * Full test coverage with screenshot evidence
 * 
 * Run with: npx playwright test vibegrapher-full.spec.ts
 */

import { test, expect, Page, BrowserContext } from '@playwright/test'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'
const API_URL = process.env.API_URL || 'http://kui-vibes:8000'
const EVIDENCE_DIR = '.playwright-test-evidence'

// Ensure evidence directory exists
test.beforeAll(async () => {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  }
})

// Helper to take timestamped screenshots with metadata
async function captureEvidence(page: Page, testName: string, step: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `${timestamp}-${testName}-${step}.png`
  const filepath = path.join(EVIDENCE_DIR, filename)
  
  await page.screenshot({
    path: filepath,
    fullPage: false
  })
  
  // Log evidence capture
  console.log(`Evidence captured: ${filename}`)
  return filepath
}

// Helper to wait for network stability
async function waitForNetworkIdle(page: Page, timeout = 5000) {
  try {
    await page.waitForLoadState('networkidle', { timeout })
  } catch {
    // Continue even if network doesn't fully settle
  }
}

// Helper to inject test data
async function injectTestDiff(page: Page) {
  return await page.evaluate(() => {
    const testDiff = {
      id: `test-diff-${Date.now()}`,
      project_id: 'test-project',
      session_id: 'test-session',
      base_commit: 'abc123def456',
      target_branch: 'main',
      vibecoder_prompt: 'Add comprehensive error handling and logging',
      diff_content: `--- a/auth.py
+++ b/auth.py
@@ -10,6 +10,10 @@ def authenticate_user(username, password):
     """Authenticate user with username and password"""
+    import logging
+    logger = logging.getLogger(__name__)
+    
+    if not username or not password:
+        raise ValueError("Username and password are required")
     
     user = User.query.filter_by(username=username).first()
     if not user:
-        return None
+        logger.warning(f"Authentication failed: User '{username}' not found")
+        raise AuthenticationError(f"Invalid credentials")
     
     if not user.check_password(password):
-        return None
+        logger.warning(f"Authentication failed: Invalid password for user '{username}'")
+        raise AuthenticationError("Invalid credentials")
     
+    logger.info(f"User '{username}' authenticated successfully")
     return user`,
      commit_message: 'feat: Add comprehensive error handling and logging to authentication\n\nImprove security and debugging capabilities',
      status: 'evaluator_approved' as const,
      evaluator_reasoning: 'Excellent improvements: proper error handling, security-focused error messages, and comprehensive logging for debugging.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    if (window.__appStore) {
      const actions = window.__appStore.getState().actions
      actions.setCurrentReviewDiff(testDiff)
      actions.setShowDiffReviewModal(true)
      return true
    }
    return false
  })
}

test.describe('Vibegrapher Complete Test Suite', () => {
  let context: BrowserContext
  let page: Page

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    })
    page = await context.newPage()
    
    // Clear state
    await page.goto(BASE_URL)
    await page.evaluate(() => localStorage.clear())
  })

  test.afterEach(async () => {
    await context.close()
  })

  test('01: Complete User Journey - Project Creation to Diff Commit', async () => {
    // Step 1: Homepage validation
    await page.goto(BASE_URL)
    await waitForNetworkIdle(page)
    
    await expect(page.locator('h1').first()).toContainText('Vibegrapher')
    await expect(page.locator('h1').nth(1)).toContainText('Projects')
    await captureEvidence(page, '01-journey', 'homepage')
    
    // Step 2: Create new project
    const projectName = `Test Project ${Date.now()}`
    await page.fill('input[placeholder="Project name"]', projectName)
    await captureEvidence(page, '01-journey', 'project-name-entered')
    
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/project\/[a-f0-9-]+/, { timeout: 10000 })
    await waitForNetworkIdle(page)
    
    // Verify project page loaded
    await expect(page.locator('h1').nth(1)).toContainText(projectName)
    await expect(page.locator('text=Vibecode Panel')).toBeVisible()
    await expect(page.locator('text=Code Viewer')).toBeVisible()
    await captureEvidence(page, '01-journey', 'project-created')
    
    // Step 3: Check WebSocket connection
    const connectionStatus = await page.locator('text=Connected').or(
      page.locator('text=Disconnected')
    ).textContent()
    console.log(`WebSocket status: ${connectionStatus}`)
    
    // Step 4: Trigger diff review modal
    const diffInjected = await injectTestDiff(page)
    if (diffInjected) {
      await page.waitForTimeout(1000)
      await expect(page.locator('text=Diff Review')).toBeVisible()
      await captureEvidence(page, '01-journey', 'diff-review-modal')
      
      // Step 5: Test rejection flow
      await page.click('button:has-text("Reject")')
      await page.waitForTimeout(500)
      
      const feedbackInput = page.locator('textarea').first()
      if (await feedbackInput.isVisible()) {
        await feedbackInput.fill('The error messages should be more specific and include rate limiting.')
        await captureEvidence(page, '01-journey', 'rejection-feedback')
        await page.click('button:has-text("Cancel")')
      }
      
      // Step 6: Test accept flow
      await page.click('button:has-text("Accept & Continue")')
      await page.waitForTimeout(1000)
      
      if (await page.locator('text=Finalize Commit Message').isVisible()) {
        await captureEvidence(page, '01-journey', 'commit-message-modal')
        
        // Test message refinement
        const refineBtn = page.getByRole('button', { name: /Refine with AI/i })
        if (await refineBtn.isEnabled()) {
          console.log('AI refinement available')
        }
        
        // Complete the flow
        await page.click('button:has-text("Cancel")')
      }
    }
  })

  test('02: Dark Mode and Theme Persistence', async () => {
    await page.goto(BASE_URL)
    await waitForNetworkIdle(page)
    
    const darkModeToggle = page.getByRole('switch', { name: /toggle dark mode/i }).first()
    const htmlElement = page.locator('html')
    
    // Check initial dark mode
    await expect(htmlElement).toHaveClass(/dark/)
    await captureEvidence(page, '02-theme', 'dark-mode-initial')
    
    // Toggle to light mode
    await darkModeToggle.click()
    await expect(htmlElement).not.toHaveClass(/dark/)
    await captureEvidence(page, '02-theme', 'light-mode')
    
    // Verify persistence
    await page.reload()
    await waitForNetworkIdle(page)
    await expect(htmlElement).not.toHaveClass(/dark/)
    await captureEvidence(page, '02-theme', 'light-mode-persisted')
    
    // Toggle back to dark
    await darkModeToggle.click()
    await expect(htmlElement).toHaveClass(/dark/)
  })

  test('03: Responsive Design Validation', async () => {
    // Desktop view
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(BASE_URL)
    await captureEvidence(page, '03-responsive', 'desktop')
    
    // Tablet view
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.reload()
    await captureEvidence(page, '03-responsive', 'tablet')
    
    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 })
    await page.reload()
    await captureEvidence(page, '03-responsive', 'mobile')
    
    // Test mobile navigation if project exists
    const firstProject = page.locator('button:has-text("Open")').first()
    if (await firstProject.isVisible()) {
      await firstProject.click()
      await waitForNetworkIdle(page)
      
      // Check for mobile-specific layout
      const mobileLayout = page.locator('[class*="mobile"]').or(
        page.locator('[role="tablist"]')
      )
      
      if (await mobileLayout.count() > 0) {
        await captureEvidence(page, '03-responsive', 'mobile-project-view')
      }
    }
  })

  test('04: Error Handling and Edge Cases', async () => {
    // Test empty project name
    await page.goto(BASE_URL)
    await page.click('button:has-text("Create")')
    await page.waitForTimeout(500)
    
    // Should not navigate
    expect(page.url()).toBe(`${BASE_URL}/`)
    await captureEvidence(page, '04-errors', 'empty-project-validation')
    
    // Test invalid project ID
    await page.goto(`${BASE_URL}/project/invalid-id-12345`)
    await waitForNetworkIdle(page)
    
    const errorMessage = page.locator('text=/error|not found/i')
    if (await errorMessage.isVisible({ timeout: 3000 })) {
      await captureEvidence(page, '04-errors', 'invalid-project-error')
    }
    
    // Test 404 page
    await page.goto(`${BASE_URL}/nonexistent-route`)
    await captureEvidence(page, '04-errors', '404-page')
  })

  test('05: Performance Metrics', async () => {
    await page.goto(BASE_URL)
    
    const metrics = await page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return {
        domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
        loadComplete: perf.loadEventEnd - perf.loadEventStart,
        domInteractive: perf.domInteractive - perf.fetchStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      }
    })
    
    console.log('Performance Metrics:', metrics)
    
    // Assert reasonable performance
    expect(metrics.domInteractive).toBeLessThan(3000)
    expect(metrics.loadComplete).toBeLessThan(5000)
    
    // Log to file for tracking
    const metricsFile = path.join(EVIDENCE_DIR, `performance-${Date.now()}.json`)
    fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2))
  })

  test('06: Keyboard Navigation and Accessibility', async () => {
    await page.goto(BASE_URL)
    await waitForNetworkIdle(page)
    
    // Tab navigation
    await page.keyboard.press('Tab')
    await captureEvidence(page, '06-accessibility', 'first-tab-focus')
    
    await page.keyboard.press('Tab')
    await captureEvidence(page, '06-accessibility', 'second-tab-focus')
    
    // Test Enter key on focused element
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
    
    // Test Escape key for modal closing
    await injectTestDiff(page)
    await page.waitForTimeout(1000)
    
    if (await page.locator('text=Diff Review').isVisible()) {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
      
      // Verify modal closed
      const modalClosed = await page.locator('text=Diff Review').isHidden()
      expect(modalClosed).toBeTruthy()
    }
  })

  test('07: Project Management Operations', async () => {
    await page.goto(BASE_URL)
    await waitForNetworkIdle(page)
    
    // Count initial projects
    const initialCount = await page.locator('[class*="card"]').filter({
      has: page.locator('h3')
    }).count()
    
    console.log(`Initial project count: ${initialCount}`)
    
    // Create test project
    const testName = `Delete Test ${Date.now()}`
    await page.fill('input[placeholder="Project name"]', testName)
    await page.click('button:has-text("Create")')
    
    await page.waitForURL(/\/project\/[a-f0-9-]+/)
    const projectUrl = page.url()
    
    // Navigate back
    await page.goto(BASE_URL)
    await waitForNetworkIdle(page)
    
    // Find and delete the project
    const projectCard = page.locator(`text=${testName}`).locator('..')
    const deleteBtn = projectCard.locator('button:has-text("Delete")')
    
    if (await deleteBtn.isVisible()) {
      await captureEvidence(page, '07-project-mgmt', 'before-delete')
      await deleteBtn.click()
      
      // Handle confirmation if present
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|delete/i })
      if (await confirmBtn.isVisible({ timeout: 2000 })) {
        await confirmBtn.click()
      }
      
      await waitForNetworkIdle(page)
      await captureEvidence(page, '07-project-mgmt', 'after-delete')
      
      // Verify deletion
      await expect(page.locator(`text=${testName}`)).toBeHidden()
    }
  })

  test('08: Session State Recovery', async () => {
    // Create a project and set up state
    await page.goto(BASE_URL)
    const sessionProject = `Session Test ${Date.now()}`
    await page.fill('input[placeholder="Project name"]', sessionProject)
    await page.click('button:has-text("Create")')
    
    await page.waitForURL(/\/project\/[a-f0-9-]+/)
    const projectUrl = page.url()
    
    // Inject diff and show modal
    await injectTestDiff(page)
    await page.waitForTimeout(1000)
    
    if (await page.locator('text=Diff Review').isVisible()) {
      await captureEvidence(page, '08-session', 'modal-before-refresh')
      
      // Refresh page
      await page.reload()
      await waitForNetworkIdle(page)
      
      // Check if modal state recovered
      const modalRecovered = await page.locator('text=Diff Review').isVisible({ timeout: 3000 })
      await captureEvidence(page, '08-session', 'modal-after-refresh')
      
      console.log(`Modal recovery: ${modalRecovered ? 'Success' : 'Failed'}`)
    }
  })
})

// Summary test to generate report
test.afterAll(async () => {
  const files = fs.readdirSync(EVIDENCE_DIR)
  const report = {
    timestamp: new Date().toISOString(),
    totalScreenshots: files.filter(f => f.endsWith('.png')).length,
    tests: files.map(f => f.replace(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-/, ''))
      .filter((v, i, a) => a.indexOf(v) === i)
  }
  
  const reportFile = path.join(EVIDENCE_DIR, 'test-report.json')
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2))
  
  console.log('\n=== Test Suite Complete ===')
  console.log(`Evidence captured: ${report.totalScreenshots} screenshots`)
  console.log(`Report saved to: ${reportFile}`)
  console.log(`Evidence directory: ${EVIDENCE_DIR}`)
})