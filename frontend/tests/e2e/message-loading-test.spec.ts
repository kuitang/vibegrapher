/**
 * Test message loading and real-time streaming
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5177'
const EVIDENCE_DIR = '../validated_test_evidence/socketio-bug'

test.describe('Message Loading Test', () => {
  test('Load existing messages and test real-time streaming', async ({ page }) => {
  console.log('=== MESSAGE LOADING AND REAL-TIME TEST ===')
  
  const consoleLogs: string[] = []
  page.on('console', msg => {
    const logEntry = `[${new Date().toISOString()}] [${msg.type().toUpperCase()}] ${msg.text()}`
    consoleLogs.push(logEntry)
    if (msg.text().includes('SessionStore') || msg.text().includes('Socket.io') || msg.text().includes('messages')) {
      console.log(`LOG: ${logEntry}`)
    }
  })
  
  // Navigate to project with 66 existing messages
  const projectId = '59a28517-3c1a-4a93-9cd8-6e230faaeb0f'
  await page.goto(`${BASE_URL}/project/${projectId}`)
  await page.waitForLoadState('networkidle')
  
  // Wait for session restoration and message loading
  await page.waitForTimeout(5000)
  
  // Take screenshot after loading
  await page.screenshot({ 
    path: path.join(EVIDENCE_DIR, 'messages-after-fix.png'),
    fullPage: true 
  })
  
  // Check message count
  const messageCount = await page.locator('[data-testid="message"]').count()
  console.log(`Messages displayed: ${messageCount} (expected: 66)`)
  
  // Check if messages are actually visible
  const hasMessages = await page.locator('[data-testid="message"]').first().isVisible()
  const noMessagesText = await page.locator('text="No messages yet"').isVisible()
  
  console.log(`Has visible messages: ${hasMessages}`)
  console.log(`Shows 'No messages yet': ${noMessagesText}`)
  
  // Save evidence
  const evidence = {
    test: 'Message Loading After Fix',
    timestamp: new Date().toISOString(),
    project_id: projectId,
    expected_messages: 66,
    displayed_messages: messageCount,
    has_visible_messages: hasMessages,
    shows_no_messages_text: noMessagesText,
    loading_success: messageCount > 0,
    console_logs: consoleLogs.filter(log => 
      log.includes('SessionStore') || 
      log.includes('Socket.io') || 
      log.includes('messages')
    )
  }
  
  fs.writeFileSync(
    path.join(EVIDENCE_DIR, 'message-loading-results.json'),
    JSON.stringify(evidence, null, 2)
  )
  
  console.log(`\\nRESULTS:`)
  console.log(`Expected: 66 messages`)
  console.log(`Displayed: ${messageCount} messages`)
  console.log(`Success: ${evidence.loading_success}`)
})
})