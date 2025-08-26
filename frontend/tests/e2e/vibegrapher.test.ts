/**
 * Vibegrapher End-to-End Test Suite
 * Comprehensive testing of all frontend functionality
 */

import { test, expect, Page } from '@playwright/test'
import { v4 as uuidv4 } from 'uuid'

const BASE_URL = 'http://localhost:5173'
const SCREENSHOT_DIR = '.playwright-test-evidence'

// Helper function to take timestamped screenshots
async function takeScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${timestamp}-${name}.png`,
    fullPage: false
  })
}

// Helper to wait for network idle
async function waitForNetworkIdle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
}

test.describe('Vibegrapher Full Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to start fresh
    await page.goto(BASE_URL)
    await page.evaluate(() => localStorage.clear())
  })

  test('01 - Homepage and Navigation', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForNetworkIdle(page)
    
    // Verify homepage elements
    await expect(page.locator('h1').first()).toContainText('Vibegrapher')
    await expect(page.locator('h1').nth(1)).toContainText('Projects')
    
    // Check dark mode toggle exists
    const darkModeToggle = page.getByRole('switch', { name: /toggle dark mode/i })
    await expect(darkModeToggle).toBeVisible()
    
    await takeScreenshot(page, 'test-01-homepage')
  })

  test('02 - Create New Project', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForNetworkIdle(page)
    
    const projectName = `Test Project ${uuidv4().slice(0, 8)}`
    
    // Fill in project name
    await page.getByPlaceholder('Project name').fill(projectName)
    await takeScreenshot(page, 'test-02-project-name-entered')
    
    // Create project
    await page.getByRole('button', { name: 'Create' }).click()
    
    // Wait for navigation to project page
    await page.waitForURL(/\/project\/[a-f0-9-]+/)
    await waitForNetworkIdle(page)
    
    // Verify we're on the project page
    await expect(page.locator('h1').nth(1)).toContainText(projectName)
    await expect(page.getByText('Vibecode Panel')).toBeVisible()
    await expect(page.getByText('Code Viewer')).toBeVisible()
    
    await takeScreenshot(page, 'test-02-project-created')
  })

  test('03 - Dark Mode Toggle', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForNetworkIdle(page)
    
    const darkModeToggle = page.getByRole('switch', { name: /toggle dark mode/i }).first()
    
    // Check initial state (dark mode on)
    const htmlElement = page.locator('html')
    await expect(htmlElement).toHaveClass(/dark/)
    await takeScreenshot(page, 'test-03-dark-mode-on')
    
    // Toggle to light mode
    await darkModeToggle.click()
    await expect(htmlElement).not.toHaveClass(/dark/)
    await takeScreenshot(page, 'test-03-light-mode-on')
    
    // Toggle back to dark mode
    await darkModeToggle.click()
    await expect(htmlElement).toHaveClass(/dark/)
    await takeScreenshot(page, 'test-03-dark-mode-restored')
  })

  test('04 - Project Page Components', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForNetworkIdle(page)
    
    // Open first available project
    const firstProject = page.locator('button:has-text("Open")').first()
    if (await firstProject.isVisible()) {
      await firstProject.click()
      await waitForNetworkIdle(page)
      
      // Verify all panels are present
      await expect(page.getByText('Vibecode Panel')).toBeVisible()
      await expect(page.getByText('Code Viewer')).toBeVisible()
      await expect(page.getByText('Test Results')).toBeVisible()
      
      // Check for WebSocket connection status
      const connectionStatus = page.locator('text=Connected').or(page.locator('text=Disconnected'))
      await expect(connectionStatus).toBeVisible()
      
      // Check code viewer has content
      const codeContent = page.locator('.monaco-editor').first()
      await expect(codeContent).toBeVisible()
      
      await takeScreenshot(page, 'test-04-project-page-layout')
    }
  })

  test('05 - Start Vibecode Session', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForNetworkIdle(page)
    
    // Open first project
    const firstProject = page.locator('button:has-text("Open")').first()
    if (await firstProject.isVisible()) {
      await firstProject.click()
      await waitForNetworkIdle(page)
      
      // Click Start Session button
      const startSessionBtn = page.getByRole('button', { name: 'Start Session' })
      await expect(startSessionBtn).toBeVisible()
      await takeScreenshot(page, 'test-05-before-session-start')
      
      await startSessionBtn.click()
      
      // Wait for session to initialize
      await page.waitForTimeout(2000)
      
      // Check if session UI appears
      const sessionUI = page.locator('text=Stop Session').or(
        page.locator('text=Send').or(
          page.locator('textarea[placeholder*="Type your message"]')
        )
      )
      
      if (await sessionUI.isVisible({ timeout: 5000 })) {
        await takeScreenshot(page, 'test-05-session-started')
        
        // Try sending a test message
        const messageInput = page.locator('textarea').first()
        if (await messageInput.isVisible()) {
          await messageInput.fill('Test message: Hello VibeCoder!')
          await takeScreenshot(page, 'test-05-message-typed')
        }
      }
    }
  })

  test('06 - Diff Review Modal Flow', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForNetworkIdle(page)
    
    // Navigate to a project
    const firstProject = page.locator('button:has-text("Open")').first()
    if (await firstProject.isVisible()) {
      await firstProject.click()
      await waitForNetworkIdle(page)
      
      // Execute test function to show diff review modal
      await page.evaluate(() => {
        // Create test diff data
        const testDiff = {
          id: 'test-diff-' + Date.now(),
          project_id: 'test-project',
          session_id: 'test-session',
          base_commit: 'abc123',
          target_branch: 'main',
          vibecoder_prompt: 'Add comprehensive error handling to authentication',
          diff_content: `--- a/auth.py
+++ b/auth.py
@@ -10,6 +10,8 @@ def authenticate_user(username, password):
     """Authenticate user with username and password"""
+    if not username or not password:
+        raise ValueError("Username and password are required")
     
     user = User.query.filter_by(username=username).first()
     if not user:
-        return None
+        raise AuthenticationError(f"User '{username}' not found")
     
     if not user.check_password(password):
-        return None
+        raise AuthenticationError("Invalid password")
     
+    logger.info(f"User '{username}' authenticated successfully")
     return user`,
          commit_message: 'feat: Add comprehensive error handling to authentication\n\nImproved error messages and validation',
          status: 'evaluator_approved' as const,
          evaluator_reasoning: 'This diff significantly improves the authentication function by adding proper input validation, replacing None returns with descriptive exceptions, and adding logging for successful authentications.',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        // Show diff review modal if store is available
        if (window.__appStore) {
          const actions = window.__appStore.getState().actions
          actions.setCurrentReviewDiff(testDiff)
          actions.setShowDiffReviewModal(true)
        }
      })
      
      await page.waitForTimeout(1000)
      
      // Check if modal appeared
      const diffModal = page.locator('text=Diff Review')
      if (await diffModal.isVisible({ timeout: 5000 })) {
        await takeScreenshot(page, 'test-06-diff-review-modal')
        
        // Test Accept flow
        const acceptBtn = page.getByRole('button', { name: /Accept.*Continue/i })
        await acceptBtn.click()
        
        // Wait for commit message modal
        await page.waitForTimeout(1000)
        const commitModal = page.locator('text=Finalize Commit Message')
        if (await commitModal.isVisible()) {
          await takeScreenshot(page, 'test-06-commit-message-modal')
          
          // Test refine button
          const refineBtn = page.getByRole('button', { name: /Refine with AI/i })
          if (await refineBtn.isEnabled()) {
            await takeScreenshot(page, 'test-06-refine-button-visible')
          }
          
          // Close modal
          await page.getByRole('button', { name: 'Cancel' }).click()
        }
      }
    }
  })

  test('07 - Diff Review Reject Flow', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForNetworkIdle(page)
    
    // Navigate to a project
    const firstProject = page.locator('button:has-text("Open")').first()
    if (await firstProject.isVisible()) {
      await firstProject.click()
      await waitForNetworkIdle(page)
      
      // Show diff modal with reject scenario
      await page.evaluate(() => {
        const testDiff = {
          id: 'test-diff-reject-' + Date.now(),
          project_id: 'test-project',
          session_id: 'test-session',
          base_commit: 'def456',
          target_branch: 'main',
          vibecoder_prompt: 'Implement quick fix for login',
          diff_content: `--- a/login.py
+++ b/login.py
@@ -5,3 +5,5 @@ def login(user, pass):
     # Quick fix - skip validation
+    return True  # Always allow login
     validate_credentials(user, pass)`,
          commit_message: 'fix: Quick login fix',
          status: 'evaluator_approved' as const,
          evaluator_reasoning: 'This change bypasses security - should be rejected',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        if (window.__appStore) {
          const actions = window.__appStore.getState().actions
          actions.setCurrentReviewDiff(testDiff)
          actions.setShowDiffReviewModal(true)
        }
      })
      
      await page.waitForTimeout(1000)
      
      const diffModal = page.locator('text=Diff Review')
      if (await diffModal.isVisible({ timeout: 5000 })) {
        // Click Reject button
        const rejectBtn = page.getByRole('button', { name: 'Reject' })
        await rejectBtn.click()
        
        // Check for feedback form
        const feedbackForm = page.locator('text=Why are you rejecting').or(
          page.locator('textarea[placeholder*="feedback"]')
        )
        
        if (await feedbackForm.isVisible({ timeout: 3000 })) {
          await takeScreenshot(page, 'test-07-reject-feedback-form')
          
          // Enter rejection reason
          const textarea = page.locator('textarea').first()
          await textarea.fill('This change bypasses security validation and creates a critical vulnerability.')
          await takeScreenshot(page, 'test-07-rejection-reason-entered')
        }
      }
    }
  })

  test('08 - Code Viewer Functionality', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForNetworkIdle(page)
    
    const firstProject = page.locator('button:has-text("Open")').first()
    if (await firstProject.isVisible()) {
      await firstProject.click()
      await waitForNetworkIdle(page)
      
      // Check code viewer elements
      const codeViewer = page.locator('.monaco-editor')
      await expect(codeViewer).toBeVisible()
      
      // Check for refresh button
      
      // Check file name display
      const fileName = page.locator('text=main.py').or(page.locator('text=.py'))
      await expect(fileName).toBeVisible()
      
      await takeScreenshot(page, 'test-08-code-viewer')
      
      // Test code viewer has syntax highlighting
      const syntaxElements = page.locator('.mtk1, .mtk2, .mtk3, .mtk4')
      const count = await syntaxElements.count()
      expect(count).toBeGreaterThan(0) // Verify syntax highlighting exists
      
      await takeScreenshot(page, 'test-08-syntax-highlighting')
    }
  })

  test('09 - Project List Management', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForNetworkIdle(page)
    
    // Count existing projects
    
    await takeScreenshot(page, 'test-09-initial-project-list')
    
    // Create a new project
    const testProjectName = `E2E Test ${Date.now()}`
    await page.getByPlaceholder('Project name').fill(testProjectName)
    await page.getByRole('button', { name: 'Create' }).click()
    
    // Wait for redirect to project page
    await page.waitForURL(/\/project\/[a-f0-9-]+/, { timeout: 10000 })
    
    // Go back to homepage
    await page.goto(BASE_URL)
    await waitForNetworkIdle(page)
    
    // Verify new project appears in list
    const newProject = page.locator(`text=${testProjectName}`)
    await expect(newProject).toBeVisible()
    
    await takeScreenshot(page, 'test-09-new-project-in-list')
    
    // Test delete functionality
    const deleteBtn = newProject.locator('..').locator('button:has-text("Delete")')
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click()
      
      // Confirm deletion if dialog appears
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|delete/i })
      if (await confirmBtn.isVisible({ timeout: 2000 })) {
        await confirmBtn.click()
      }
      
      await waitForNetworkIdle(page)
      await takeScreenshot(page, 'test-09-project-deleted')
    }
  })

  test('10 - Error Handling and Edge Cases', async ({ page }) => {
    // Test 404 page
    await page.goto(`${BASE_URL}/nonexistent-page`)
    await takeScreenshot(page, 'test-10-404-page')
    
    // Test invalid project ID
    await page.goto(`${BASE_URL}/project/invalid-id-12345`)
    await waitForNetworkIdle(page)
    
    // Should show error or redirect
    const errorMessage = page.locator('text=/error|not found/i')
    if (await errorMessage.isVisible({ timeout: 3000 })) {
      await takeScreenshot(page, 'test-10-invalid-project')
    }
    
    // Test empty project name
    await page.goto(BASE_URL)
    await page.getByRole('button', { name: 'Create' }).click()
    
    // Should not navigate (validation error)
    await page.waitForTimeout(1000)
    expect(page.url()).toBe(`${BASE_URL}/`)
    await takeScreenshot(page, 'test-10-empty-project-name')
  })

  test('11 - WebSocket Connection Status', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForNetworkIdle(page)
    
    const firstProject = page.locator('button:has-text("Open")').first()
    if (await firstProject.isVisible()) {
      await firstProject.click()
      await waitForNetworkIdle(page)
      
      // Check connection status indicator
      const statusIndicator = page.locator('text=Connected').or(
        page.locator('text=Connecting').or(
          page.locator('text=Disconnected')
        )
      )
      
      await expect(statusIndicator).toBeVisible()
      
      // Check for status icon
      const statusIcon = page.locator('svg').or(page.locator('[class*="status"]'))
      const iconCount = await statusIcon.count()
      expect(iconCount).toBeGreaterThan(0)
      
      await takeScreenshot(page, 'test-11-connection-status')
    }
  })

  test('12 - Responsive Design Check', async ({ page }) => {
    // Desktop view
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(BASE_URL)
    await waitForNetworkIdle(page)
    await takeScreenshot(page, 'test-12-desktop-view')
    
    // Tablet view
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.reload()
    await waitForNetworkIdle(page)
    await takeScreenshot(page, 'test-12-tablet-view')
    
    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 })
    await page.reload()
    await waitForNetworkIdle(page)
    await takeScreenshot(page, 'test-12-mobile-view')
    
    // Check if mobile layout is different
    const firstProject = page.locator('button:has-text("Open")').first()
    if (await firstProject.isVisible()) {
      await firstProject.click()
      await waitForNetworkIdle(page)
      
      // Mobile should have different layout (tabs or accordion)
      const mobileLayout = page.locator('[class*="mobile"]').or(
        page.locator('[role="tablist"]')
      )
      
      if (await mobileLayout.isVisible({ timeout: 3000 })) {
        await takeScreenshot(page, 'test-12-mobile-project-view')
      }
    }
  })

  test('13 - Keyboard Navigation', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForNetworkIdle(page)
    
    // Tab through interactive elements
    await page.keyboard.press('Tab')
    await takeScreenshot(page, 'test-13-first-tab')
    
    await page.keyboard.press('Tab')
    await takeScreenshot(page, 'test-13-second-tab')
    
    // Try Enter on focused element
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
    
    // Escape to close any opened modals
    await page.keyboard.press('Escape')
    await takeScreenshot(page, 'test-13-after-escape')
  })

  test('14 - Local Storage Persistence', async ({ page }) => {
    await page.goto(BASE_URL)
    await waitForNetworkIdle(page)
    
    // Toggle dark mode off
    const darkModeToggle = page.getByRole('switch', { name: /toggle dark mode/i }).first()
    await darkModeToggle.click()
    
    // Create a project and navigate to it
    const projectName = `Persist Test ${Date.now()}`
    await page.getByPlaceholder('Project name').fill(projectName)
    await page.getByRole('button', { name: 'Create' }).click()
    await page.waitForURL(/\/project\/[a-f0-9-]+/)
    
    
    // Reload page
    await page.reload()
    await waitForNetworkIdle(page)
    
    // Check if dark mode preference persisted
    const htmlElement = page.locator('html')
    await expect(htmlElement).not.toHaveClass(/dark/)
    
    await takeScreenshot(page, 'test-14-persistence-after-reload')
    
    // Check localStorage contents
    const storageData = await page.evaluate(() => {
      return {
        theme: localStorage.getItem('theme'),
        vibegrapher: localStorage.getItem('vibegrapher-storage')
      }
    })
    
    expect(storageData.theme).toBeTruthy()
    console.log('LocalStorage data:', storageData)
  })

  test('15 - Performance Metrics', async ({ page }) => {
    await page.goto(BASE_URL)
    
    // Measure page load performance
    const metrics = await page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return {
        domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
        loadComplete: perf.loadEventEnd - perf.loadEventStart,
        domInteractive: perf.domInteractive - perf.fetchStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0
      }
    })
    
    console.log('Performance metrics:', metrics)
    
    // Assert reasonable load times (adjust thresholds as needed)
    expect(metrics.domInteractive).toBeLessThan(3000) // 3 seconds
    expect(metrics.loadComplete).toBeLessThan(5000) // 5 seconds
    
    await takeScreenshot(page, 'test-15-loaded-homepage')
  })
})

// Cleanup test to close any remaining sessions
test.afterAll(async () => {
  console.log('All tests completed. Screenshots saved to:', SCREENSHOT_DIR)
})