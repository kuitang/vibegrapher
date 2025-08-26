import { test, expect } from '@playwright/test'

test.describe('Phase 005: Session E2E', () => {
  test('full session flow with message validation', async ({ page }) => {
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
    
    // Initially should show placeholder message
    await expect(page.locator('text=Start by sending a message to the VibeCoder agent')).toBeVisible()
    
    // Send message
    const textarea = page.locator('textarea[placeholder*="Enter"]')
    await textarea.fill('Create a triage agent')
    await page.click('button:has-text("Send")')
    
    // Verify message was sent (textarea should be cleared)
    await expect(textarea).toHaveValue('')
    
    // Verify message appears in the messages area
    await expect(page.locator('text=Create a triage agent')).toBeVisible()
    await expect(page.locator('text=You')).toBeVisible()
    
    // Clear session
    await page.click('button:has-text("Clear Session")')
    await expect(page.locator('.badge:has-text("active")')).not.toBeVisible()
    
    // After clearing, should show session start message
    await expect(page.locator('text=Start a session to begin chatting with the VibeCoder agent')).toBeVisible()
  })
  
  test('message sending with Enter key', async ({ page }) => {
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
    
    // Send message with Enter key
    const textarea = page.locator('textarea[placeholder*="Enter"]')
    await textarea.fill('Test message with Enter key')
    await textarea.press('Enter')
    
    // Verify message was sent (textarea should be cleared)
    await expect(textarea).toHaveValue('')
    
    // Verify message appears in the messages area
    await expect(page.locator('text=Test message with Enter key')).toBeVisible()
    await expect(page.locator('text=You')).toBeVisible()
  })
  
  test('textarea retains text when sending fails', async ({ page }) => {
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
    
    // Mock message sending to fail
    await page.route('**/sessions/test-session-id/messages', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to send message' })
      })
    }, { times: 1 })
    
    // Navigate to a test project page
    await page.goto('/project/test-project-id')
    
    // Start session
    await page.click('button:has-text("Start Session")')
    await expect(page.locator('.badge:has-text("active")')).toBeVisible()
    
    // Try to send message (should fail)
    const textarea = page.locator('textarea[placeholder*="Enter"]')
    await textarea.fill('This should remain in textarea')
    await page.click('button:has-text("Send")')
    
    // Verify textarea still contains the message
    await expect(textarea).toHaveValue('This should remain in textarea')
    
    // Verify error message is shown (if applicable)
    // Note: This would depend on how errors are handled in the UI
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
    await textarea.fill('Line 1
Line 2
Line 3')
    
    const newHeight = await textarea.evaluate(el => el.clientHeight)
    expect(newHeight).toBeGreaterThan(initialHeight)
  })
})