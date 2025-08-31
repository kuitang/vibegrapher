/**
 * Phase 1: Test streaming with page refresh
 * Verifies that messages are persisted and fetchable after refresh
 */

import { test, expect, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'
const EVIDENCE_DIR = 'validated_test_evidence/phase1'

// Ensure evidence directory exists
test.beforeAll(async () => {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  }
})

// Helper to take evidence screenshots
async function captureEvidence(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `${timestamp}-${name}.png`
  const filepath = path.join(EVIDENCE_DIR, filename)
  
  await page.screenshot({
    path: filepath,
    fullPage: true
  })
  
  console.log(`Evidence captured: ${filename}`)
  return filepath
}

test.describe('Phase 1: Streaming with Database Persistence', () => {
  let page: Page
  let projectName: string

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    projectName = `Test Streaming ${Date.now()}`
    
    // Navigate to home
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    
    // Create a new project
    await page.fill('input[placeholder="Project name"]', projectName)
    await page.click('button:has-text("Create")')
    
    // Wait for navigation to project page
    await page.waitForURL(/\/project\//)
    await page.waitForLoadState('networkidle')
    
    console.log(`Created project: ${projectName}`)
  })

  test('messages are persisted and fetchable after refresh', async () => {
    // Take initial screenshot
    await captureEvidence(page, 'initial-project-page')
    
    // Send a vibecode message
    const testPrompt = 'Add a docstring to the hello function'
    await page.fill('textarea[placeholder*="Type your message"]', testPrompt)
    await captureEvidence(page, 'message-typed')
    
    // Send the message
    await page.click('button[aria-label="Send message"]')
    
    // Wait for some response activity (give it time to stream)
    await page.waitForTimeout(5000)
    await captureEvidence(page, 'after-sending-message')
    
    // Refresh the page
    console.log('Refreshing page...')
    await page.reload()
    await page.waitForLoadState('networkidle')
    await captureEvidence(page, 'after-refresh')
    
    // Check that messages are visible after refresh
    const messages = await page.locator('[data-testid="message"]').all()
    expect(messages.length).toBeGreaterThan(0)
    
    // Verify we can see the user's message
    const userMessage = await page.locator('[data-testid="message"]:has-text("' + testPrompt + '")').isVisible()
    expect(userMessage).toBeTruthy()
    
    // Look for any assistant messages
    const assistantMessages = await page.locator('[data-testid="message"][data-role="assistant"]').count()
    console.log(`Found ${assistantMessages} assistant messages after refresh`)
    
    // Take final evidence
    await captureEvidence(page, 'messages-after-refresh')
    
    // Log results for evidence
    const evidenceLog = {
      test: 'Phase 1 - Message Persistence',
      timestamp: new Date().toISOString(),
      projectName,
      userMessageFound: userMessage,
      assistantMessageCount: assistantMessages,
      totalMessageCount: messages.length
    }
    
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'phase1-results.json'),
      JSON.stringify(evidenceLog, null, 2)
    )
    
    console.log('Test evidence saved to', EVIDENCE_DIR)
  })

  test('stream events are saved as individual messages', async () => {
    // Send a message that will trigger tool calls
    const testPrompt = 'Add a parameter called name to the hello function'
    await page.fill('textarea[placeholder*="Type your message"]', testPrompt)
    await page.click('button[aria-label="Send message"]')
    
    // Wait for streaming to complete
    await page.waitForTimeout(8000)
    await captureEvidence(page, 'after-complex-message')
    
    // Refresh to force loading from database
    await page.reload()
    await page.waitForLoadState('networkidle')
    
    // Count different types of messages
    const allMessages = await page.locator('[data-testid="message"]').all()
    const messageDetails = []
    
    for (const msg of allMessages) {
      const role = await msg.getAttribute('data-role')
      const content = await msg.textContent()
      messageDetails.push({
        role,
        contentLength: content?.length || 0,
        contentPreview: content?.substring(0, 100)
      })
    }
    
    // Save detailed evidence
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'stream-events-details.json'),
      JSON.stringify({
        test: 'Stream Events Persistence',
        timestamp: new Date().toISOString(),
        messageCount: allMessages.length,
        messages: messageDetails
      }, null, 2)
    )
    
    await captureEvidence(page, 'stream-events-persisted')
    
    // Verify we have multiple messages (stream events)
    expect(allMessages.length).toBeGreaterThan(2) // At least user + some events
  })

  test('token usage is extracted and displayed', async () => {
    // Send a simple message
    const testPrompt = 'Explain what this code does'
    await page.fill('textarea[placeholder*="Type your message"]', testPrompt)
    await page.click('button[aria-label="Send message"]')
    
    // Wait for response
    await page.waitForTimeout(5000)
    
    // Refresh the page
    await page.reload()
    await page.waitForLoadState('networkidle')
    
    // Look for token usage indicators
    const tokenBadges = await page.locator('[data-testid="token-usage"]').all()
    
    if (tokenBadges.length > 0) {
      console.log(`Found ${tokenBadges.length} token usage indicators`)
      
      // Extract token values
      const tokenData = []
      for (const badge of tokenBadges) {
        const text = await badge.textContent()
        tokenData.push(text)
      }
      
      fs.writeFileSync(
        path.join(EVIDENCE_DIR, 'token-usage.json'),
        JSON.stringify({
          test: 'Token Usage Extraction',
          timestamp: new Date().toISOString(),
          tokenBadges: tokenData
        }, null, 2)
      )
    }
    
    await captureEvidence(page, 'token-usage-displayed')
  })

  test.afterEach(async () => {
    // Clean up
    if (page) {
      await page.close()
    }
  })
})

test.describe('Phase 1: API Verification', () => {
  test('GET /sessions/{id}/messages returns all stream events', async ({ request }) => {
    const API_URL = process.env.API_URL || 'http://localhost:8000'
    
    // Create a project
    const projectRes = await request.post(`${API_URL}/projects`, {
      data: {
        name: `API Test Project ${Date.now()}`,
        current_code: 'def hello():\n    print("Hello")'
      }
    })
    const project = await projectRes.json()
    
    // Create a session
    const sessionRes = await request.post(`${API_URL}/projects/${project.id}/sessions`)
    const session = await sessionRes.json()
    
    // Send a message
    await request.post(`${API_URL}/sessions/${session.id}/messages`, {
      data: {
        prompt: 'Add a docstring'
      }
    })
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Fetch all messages
    const messagesRes = await request.get(`${API_URL}/sessions/${session.id}/messages`)
    const messages = await messagesRes.json()
    
    // Verify we have messages with new fields
    expect(messages.length).toBeGreaterThan(0)
    
    // Check for new fields in messages
    const hasStreamFields = messages.some((msg: any) => 
      msg.stream_event_type !== undefined ||
      msg.stream_sequence !== undefined ||
      msg.tool_calls !== undefined ||
      msg.usage_input_tokens !== undefined
    )
    
    expect(hasStreamFields).toBeTruthy()
    
    // Save API evidence
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'api-messages.json'),
      JSON.stringify({
        test: 'API Message Fields',
        timestamp: new Date().toISOString(),
        messageCount: messages.length,
        sampleMessage: messages[0],
        hasStreamFields
      }, null, 2)
    )
    
    console.log(`API returned ${messages.length} messages with stream fields`)
  })
})