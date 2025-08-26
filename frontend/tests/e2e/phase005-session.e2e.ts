import { test, expect } from '@playwright/test'

test.describe('Phase 005: Session E2E', () => {
  test('full session flow', async ({ page }) => {
    // For now, we'll test that the UI components render correctly
    // Full E2E testing requires backend to be running
    
    // Mock the API calls for testing UI
    await page.route('**/projects/test-project-id/sessions', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-session-id',
          project_id: 'test-project-id',
          openai_session_key: 'test-session-key',
          conversations_db_path: '/test/path/conversations.db',
          session_type: 'global',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z'
        })
      })
    })
    
    await page.route('**/sessions/test-session-id/messages', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      })
    })
    
    await page.route('**/sessions/test-session-id/diffs/pending', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      })
    })
    
    // Navigate to a test project page
    await page.goto('/project/test-project-id')
    
    // Start session
    await page.click('button:has-text("Start Session")')
    await expect(page.locator('.badge:has-text("active")')).toBeVisible()
    
    // Send message
    const textarea = page.locator('textarea[placeholder*="Enter"]')
    await textarea.fill('Create a triage agent')
    await textarea.press('Enter')
    
    // Verify message area exists
    await expect(page.locator('[data-radix-scroll-area]')).toBeVisible()
    
    // Clear session
    await page.click('button:has-text("Clear Session")')
    await expect(page.locator('.badge:has-text("active")')).not.toBeVisible()
  })
  
  test('textarea auto-resizes', async ({ page }) => {
    await page.goto('/project/test-project-id')
    
    // Mock API calls
    await page.route('**/projects/test-project-id/sessions', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-session-id',
          project_id: 'test-project-id',
          openai_session_key: 'test-session-key',
          conversations_db_path: '/test/path/conversations.db',
          session_type: 'global',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z'
        })
      })
    })
    
    // Start session
    await page.click('button:has-text("Start Session")')
    await expect(page.locator('.badge:has-text("active")')).toBeVisible()
    
    // Get initial textarea height
    const textarea = page.locator('textarea[placeholder*="Enter"]')
    const initialHeight = await textarea.evaluate(el => el.clientHeight)
    
    // Type multiline text
    await textarea.fill('Line 1\nLine 2\nLine 3')
    
    const newHeight = await textarea.evaluate(el => el.clientHeight)
    expect(newHeight).toBeGreaterThan(initialHeight)
  })
})