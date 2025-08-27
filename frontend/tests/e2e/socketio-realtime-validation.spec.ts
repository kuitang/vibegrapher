/**
 * Socket.io Real-time Message Display Validation
 * Tests that messages appear via Socket.io without page refresh
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5177'
const API_URL = 'http://localhost:8000'
const EVIDENCE_DIR = '../validated_test_evidence/socketio-bug'

// Create evidence directory
test.beforeAll(async () => {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  }
})

test.describe('Socket.io Real-time Validation', () => {

  test('Option 1: Manual message insertion with real-time display', async ({ page, browser }) => {
    console.log('=== OPTION 1: Manual Message Creation ===')
    
    // Start with fresh browser context to clear cache
    const context = await browser.newContext()
    const testPage = await context.newPage()
    
    const consoleLogs: string[] = []
    testPage.on('console', msg => {
      const logEntry = `[${new Date().toISOString()}] [${msg.type().toUpperCase()}] ${msg.text()}`
      consoleLogs.push(logEntry)
      console.log(logEntry)
    })
    
    // Navigate to project with existing session (has 65 messages)
    const projectId = '59a28517-3c1a-4a93-9cd8-6e230faaeb0f'
    const sessionId = 'b98456f7-7b02-4029-a2eb-b938ee027463'
    
    console.log(`Testing project ${projectId}, session ${sessionId}`)
    await testPage.goto(`${BASE_URL}/project/${projectId}`)
    await testPage.waitForLoadState('networkidle')
    
    // Wait for Socket.io connection
    await testPage.waitForTimeout(3000)
    
    // Take initial screenshot
    await testPage.screenshot({ 
      path: path.join(EVIDENCE_DIR, '01-initial-page.png'),
      fullPage: true 
    })
    
    // Count initial messages
    let messageCount = await testPage.locator('[data-testid="message"]').count()
    console.log(`Initial message count: ${messageCount}`)
    
    // Check Socket.io status
    const isConnected = await testPage.locator(':text("Connected")').isVisible()
    console.log(`Socket.io connected: ${isConnected}`)
    
    if (!isConnected) {
      console.log('Waiting for Socket.io connection...')
      await testPage.waitForTimeout(5000)
    }
    
    // Now manually create messages via API and watch them appear in real-time
    console.log('\\nManually creating messages via API...')
    
    const testMessages = [
      { role: 'user', content: 'Manual test message 1' },
      { role: 'assistant', content: 'This is a simulated assistant response', message_type: 'stream_event' },
      { role: 'assistant', content: 'Another streaming message', message_type: 'stream_event' }
    ]
    
    for (let i = 0; i < testMessages.length; i++) {
      const msg = testMessages[i]
      console.log(`Creating message ${i + 1}: ${msg.content}`)
      
      try {
        // Create message directly in database via API
        const response = await fetch(`${API_URL}/test/create-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            ...msg
          })
        })
        
        console.log(`API response: ${response.status}`)
        
        // Wait for Socket.io to deliver the message
        await testPage.waitForTimeout(2000)
        
        // Check if message count increased
        const newCount = await testPage.locator('[data-testid="message"]').count()
        console.log(`Message count after API call ${i + 1}: ${newCount} (was ${messageCount})`)
        
        // Take screenshot showing new message
        await testPage.screenshot({ 
          path: path.join(EVIDENCE_DIR, `02-after-message-${i + 1}.png`),
          fullPage: true 
        })
        
        messageCount = newCount
        
      } catch (error) {
        console.log(`API call failed: ${error}`)
      }
    }
    
    // Take final screenshot
    await testPage.screenshot({ 
      path: path.join(EVIDENCE_DIR, '03-final-manual-test.png'),
      fullPage: true 
    })
    
    await context.close()
  })

  test('Option 2: Full OpenAI workflow with real-time streaming', async ({ page, browser }) => {
    console.log('=== OPTION 2: Full OpenAI Workflow ===')
    
    const context = await browser.newContext()
    const testPage = await context.newPage()
    
    const consoleLogs: string[] = []
    const socketMessages: string[] = []
    
    testPage.on('console', msg => {
      const logEntry = `[${new Date().toISOString()}] [${msg.type().toUpperCase()}] ${msg.text()}`
      consoleLogs.push(logEntry)
      console.log(logEntry)
      
      // Capture Socket.io related logs
      if (msg.text().includes('Socket.io') || msg.text().includes('conversation_message') || msg.text().includes('VibecodePanel')) {
        socketMessages.push(logEntry)
      }
    })
    
    // Navigate to frontend
    await testPage.goto(BASE_URL)
    await testPage.waitForLoadState('networkidle')
    
    // Create a fresh project for clean testing
    const projectName = `RealTime Test ${Date.now()}`
    await testPage.fill('input[placeholder="Project name"]', projectName)
    await testPage.click('button:has-text("Create")')
    await testPage.waitForURL(/\/project\//)
    await testPage.waitForLoadState('networkidle')
    
    // Wait for Socket.io connection
    await testPage.waitForTimeout(3000)
    
    // Take screenshot before sending message
    await testPage.screenshot({ 
      path: path.join(EVIDENCE_DIR, '04-before-openai-message.png'),
      fullPage: true 
    })
    
    const initialCount = await testPage.locator('[data-testid="message"]').count()
    console.log(`Initial message count: ${initialCount}`)
    
    // Send message to trigger OpenAI streaming
    console.log('Sending message to OpenAI...')
    const testPrompt = 'Add a comment to explain what this code does'
    
    await testPage.fill('textarea[placeholder*="Type your message"]', testPrompt)
    
    // Take screenshot with message typed
    await testPage.screenshot({ 
      path: path.join(EVIDENCE_DIR, '05-message-typed.png'),
      fullPage: true 
    })
    
    // Click send and immediately start monitoring
    console.log('Clicking send and monitoring real-time updates...')
    await testPage.click('button[aria-label="Send message"]')
    
    // Take screenshot immediately after send
    await testPage.screenshot({ 
      path: path.join(EVIDENCE_DIR, '06-message-sent.png'),
      fullPage: true 
    })
    
    // Monitor for messages appearing in real-time (without page refresh!)
    let currentCount = initialCount
    let updateTimestamps = []
    const startTime = Date.now()
    
    // Monitor for up to 60 seconds
    for (let second = 0; second < 60; second++) {
      await testPage.waitForTimeout(1000)
      const newCount = await testPage.locator('[data-testid="message"]').count()
      
      if (newCount > currentCount) {
        const timestamp = Date.now() - startTime
        updateTimestamps.push({
          second: Math.floor(timestamp / 1000),
          milliseconds: timestamp,
          oldCount: currentCount,
          newCount: newCount,
          messagesAdded: newCount - currentCount
        })
        
        console.log(`UPDATE at ${timestamp}ms: Messages ${currentCount} → ${newCount} (+${newCount - currentCount})`)
        
        // Take screenshot when messages appear
        await testPage.screenshot({ 
          path: path.join(EVIDENCE_DIR, `07-realtime-update-${timestamp}ms.png`),
          fullPage: true 
        })
        
        currentCount = newCount
      }
      
      // Stop if we got a good number of messages (streaming complete)
      if (newCount > initialCount + 10) {
        console.log('Got sufficient streaming messages, test complete')
        break
      }
    }
    
    const totalDuration = Date.now() - startTime
    
    // Take final screenshot
    await testPage.screenshot({ 
      path: path.join(EVIDENCE_DIR, '08-streaming-complete.png'),
      fullPage: true 
    })
    
    console.log(`\\n=== REAL-TIME STREAMING RESULTS ===`)
    console.log(`Total duration: ${totalDuration}ms`)
    console.log(`Final message count: ${currentCount}`)
    console.log(`Messages received via streaming: ${currentCount - initialCount}`)
    console.log(`Real-time updates: ${updateTimestamps.length}`)
    
    // Analyze Socket.io activity in console logs
    const socketioLogs = consoleLogs.filter(log => 
      log.includes('Socket.io') || 
      log.includes('conversation_message') || 
      log.includes('VibecodePanel')
    )
    
    console.log(`Socket.io related log entries: ${socketioLogs.length}`)
    
    // Save comprehensive evidence
    const evidence = {
      test: 'Socket.io Real-time Validation',
      timestamp: new Date().toISOString(),
      option: 2,
      description: 'Full OpenAI workflow with real-time streaming',
      project_name: projectName,
      initial_message_count: initialCount,
      final_message_count: currentCount,
      messages_received_realtime: currentCount - initialCount,
      total_duration_ms: totalDuration,
      realtime_updates: updateTimestamps,
      socketio_log_entries: socketioLogs.length,
      socketio_sample_logs: socketioLogs.slice(0, 10),
      success: currentCount > initialCount && updateTimestamps.length > 0,
      evidence_files: {
        screenshots: [
          '04-before-openai-message.png',
          '05-message-typed.png', 
          '06-message-sent.png',
          ...updateTimestamps.map(u => `07-realtime-update-${u.milliseconds}ms.png`),
          '08-streaming-complete.png'
        ],
        console_logs: 'socketio-console-logs.json'
      }
    }
    
    // Save evidence files
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'socketio-realtime-evidence.json'),
      JSON.stringify(evidence, null, 2)
    )
    
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'socketio-console-logs.json'),
      JSON.stringify(socketioLogs, null, 2)
    )
    
    console.log(`\\n✅ Evidence saved to ${EVIDENCE_DIR}`)
    console.log(`Screenshots: ${evidence.evidence_files.screenshots.length}`)
    console.log(`Socket.io logs: ${socketioLogs.length}`)
    
    // Verify streaming worked
    expect(evidence.success).toBeTruthy()
    
    await context.close()
  })
})