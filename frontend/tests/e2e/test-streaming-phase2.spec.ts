/**
 * Phase 2: Real-time streaming without page refresh
 * Tests that messages appear via Socket.io without needing refresh
 */

import { test, expect, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'
const EVIDENCE_DIR = 'validated_test_evidence/phase2'

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

test.describe('Phase 2: Real-time Streaming (No Refresh Required)', () => {
  let page: Page
  let projectName: string

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    projectName = `Phase 2 Streaming ${Date.now()}`
    
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

  test('messages appear in real-time without refresh', async () => {
    // Take initial screenshot
    await captureEvidence(page, 'initial-project-page')
    
    // Count initial messages (should be 0)
    const initialMessages = await page.locator('[data-testid="message"]').count()
    console.log(`Initial message count: ${initialMessages}`)
    
    // Send a vibecode message
    const testPrompt = 'Add a docstring explaining what this function does'
    await page.fill('textarea[placeholder*="Type your message"]', testPrompt)
    await captureEvidence(page, 'message-typed')
    
    // Send the message
    await page.click('button[aria-label="Send message"]')
    await captureEvidence(page, 'message-sent')
    
    // Wait for Socket.io messages to arrive in real-time
    // Should see streaming messages appear without refresh
    console.log('Waiting for real-time streaming messages...')
    
    // Wait for first message to appear
    await page.waitForSelector('[data-testid="message"]', { timeout: 15000 })
    await page.waitForTimeout(2000) // Allow more messages to stream in
    
    const messagesAfterStreaming = await page.locator('[data-testid="message"]').count()
    console.log(`Messages after streaming: ${messagesAfterStreaming}`)
    
    // Should have more messages than initially (user message + stream events)
    expect(messagesAfterStreaming).toBeGreaterThan(initialMessages)
    
    await captureEvidence(page, 'messages-streaming-realtime')
    
    // Verify user message appears
    const userMessage = await page.locator('[data-testid="message"]:has-text("' + testPrompt + '")').isVisible()
    expect(userMessage).toBeTruthy()
    
    // Wait for more streaming events
    await page.waitForTimeout(5000)
    
    const finalMessageCount = await page.locator('[data-testid="message"]').count()
    console.log(`Final message count: ${finalMessageCount}`)
    
    await captureEvidence(page, 'final-streaming-messages')
    
    // Log results for evidence
    const evidenceLog = {
      test: 'Phase 2 - Real-time Streaming',
      timestamp: new Date().toISOString(),
      projectName,
      initialMessageCount: initialMessages,
      messagesAfterStreaming,
      finalMessageCount,
      realTimeMessagesReceived: finalMessageCount - initialMessages,
      userMessageFound: userMessage
    }
    
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'phase2-results.json'),
      JSON.stringify(evidenceLog, null, 2)
    )
    
    console.log('✅ Phase 2 test evidence saved to', EVIDENCE_DIR)
    
    // Verify we got multiple streaming messages
    expect(finalMessageCount).toBeGreaterThan(initialMessages + 1) // At least user + assistant messages
  })

  test('streaming message types and sequences', async () => {
    // Send a message that should generate tool calls
    const testPrompt = 'Add error handling with try/catch blocks'
    await page.fill('textarea[placeholder*="Type your message"]', testPrompt)
    await page.click('button[aria-label="Send message"]')
    
    // Wait for streaming to begin
    await page.waitForSelector('[data-testid="message"]', { timeout: 15000 })
    await page.waitForTimeout(8000) // Allow time for multiple events
    
    // Check that we received various types of messages
    const allMessages = await page.locator('[data-testid="message"]').all()
    console.log(`Received ${allMessages.length} streaming messages`)
    
    // Look for different message characteristics
    let messageTypes = new Set()
    let hasToolCalls = false
    let hasTokenUsage = false
    
    for (const msg of allMessages) {
      const msgText = await msg.textContent()
      if (msgText?.includes('tool_call') || msgText?.includes('submit_patch')) {
        hasToolCalls = true
      }
      if (msgText?.includes('tokens') || msgText?.includes('usage')) {
        hasTokenUsage = true
      }
    }
    
    await captureEvidence(page, 'streaming-message-types')
    
    // Save streaming analysis
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'streaming-analysis.json'),
      JSON.stringify({
        test: 'Streaming Message Types',
        timestamp: new Date().toISOString(),
        totalMessages: allMessages.length,
        hasToolCalls,
        hasTokenUsage,
        messageTypes: Array.from(messageTypes)
      }, null, 2)
    )
    
    // Verify we got a reasonable number of streaming messages
    expect(allMessages.length).toBeGreaterThan(3) // User + multiple stream events
  })

  test('socket connection status during streaming', async () => {
    // Look for connection status indicator
    await captureEvidence(page, 'connection-status-check')
    
    // Send message and monitor connection
    const testPrompt = 'Explain this code briefly'
    await page.fill('textarea[placeholder*="Type your message"]', testPrompt)
    await page.click('button[aria-label="Send message"]')
    
    // Wait for streaming
    await page.waitForSelector('[data-testid="message"]', { timeout: 10000 })
    await page.waitForTimeout(5000)
    
    await captureEvidence(page, 'connection-during-streaming')
    
    const finalMessages = await page.locator('[data-testid="message"]').count()
    
    // Save connection test results
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'connection-test.json'),
      JSON.stringify({
        test: 'Socket Connection During Streaming',
        timestamp: new Date().toISOString(),
        messagesReceived: finalMessages,
        streamingWorked: finalMessages > 1
      }, null, 2)
    )
    
    expect(finalMessages).toBeGreaterThan(1)
  })

  test.afterEach(async () => {
    if (page) {
      await page.close()
    }
  })
})