/**
 * Final Socket.io Real-time Validation 
 * Send real message to OpenAI and capture streaming in real-time
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5177'
const EVIDENCE_DIR = '../validated_test_evidence/socketio-bug'

test.describe('Final Socket.io Validation', () => {

  test('Real OpenAI streaming with time-series evidence', async ({ page, browser }) => {
    console.log('=== FINAL VALIDATION: Real OpenAI Streaming ===')
    
    const context = await browser.newContext()
    const testPage = await context.newPage()
    
    const consoleLogs: string[] = []
    const socketLogs: string[] = []
    
    // Capture all console activity with timestamps
    testPage.on('console', msg => {
      const timestamp = new Date().toISOString()
      const logEntry = `[${timestamp}] [${msg.type().toUpperCase()}] ${msg.text()}`
      consoleLogs.push(logEntry)
      
      // Capture Socket.io specific logs
      if (msg.text().includes('Socket.io') || 
          msg.text().includes('conversation_message') || 
          msg.text().includes('VibecodePanel') ||
          msg.text().includes('streaming')) {
        socketLogs.push(logEntry)
        console.log(`SOCKET: ${logEntry}`)
      }
    })
    
    // Navigate to frontend
    await testPage.goto(BASE_URL)
    await testPage.waitForLoadState('networkidle')
    
    // Create fresh project for clean streaming test
    const projectName = `Final Stream Test ${Date.now()}`
    console.log(`Creating project: ${projectName}`)
    
    await testPage.fill('input[placeholder="Project name"]', projectName)
    await testPage.click('button:has-text("Create")')
    await testPage.waitForURL(/\/project\//)
    await testPage.waitForLoadState('networkidle')
    
    // Wait for Socket.io connection
    await testPage.waitForTimeout(3000)
    
    // Take initial screenshot
    await testPage.screenshot({ 
      path: path.join(EVIDENCE_DIR, 'final-01-initial.png'),
      fullPage: true 
    })
    
    // Verify UI is ready
    const hasTextarea = await testPage.locator('textarea[placeholder*="Type your message"]').isVisible()
    const hasSendButton = await testPage.locator('button[aria-label="Send message"]').isVisible()
    
    console.log(`UI Ready - Textarea: ${hasTextarea}, Send button: ${hasSendButton}`)
    
    if (!hasTextarea || !hasSendButton) {
      console.log('UI not ready, waiting longer...')
      await testPage.waitForTimeout(5000)
    }
    
    // Count initial messages (should be 0 for new project)
    const initialCount = await testPage.locator('[data-testid="message"]').count()
    console.log(`Initial messages: ${initialCount}`)
    
    // Type message for OpenAI
    const testPrompt = 'Add a simple comment to explain what the main function does'
    console.log(`Typing: ${testPrompt}`)
    
    await testPage.fill('textarea[placeholder*="Type your message"]', testPrompt)
    
    // Screenshot with message typed
    await testPage.screenshot({ 
      path: path.join(EVIDENCE_DIR, 'final-02-message-typed.png'),
      fullPage: true 
    })
    
    // Send message and start real-time monitoring
    console.log('\\n🚀 SENDING MESSAGE TO OPENAI - MONITORING REAL-TIME STREAMING...')
    const sendTime = Date.now()
    
    await testPage.click('button[aria-label="Send message"]')
    
    // Screenshot immediately after send
    await testPage.screenshot({ 
      path: path.join(EVIDENCE_DIR, 'final-03-message-sent.png'),
      fullPage: true 
    })
    
    // Monitor for messages appearing in real-time (NO PAGE REFRESH!)
    const updates = []
    let currentCount = initialCount
    const maxWaitSeconds = 60
    
    for (let second = 0; second < maxWaitSeconds; second++) {
      await testPage.waitForTimeout(1000)
      const newCount = await testPage.locator('[data-testid="message"]').count()
      
      if (newCount > currentCount) {
        const timestamp = Date.now() - sendTime
        const update = {
          timestamp_ms: timestamp,
          second: Math.floor(timestamp / 1000),
          old_count: currentCount,
          new_count: newCount,
          messages_added: newCount - currentCount
        }
        
        updates.push(update)
        console.log(`⚡ REAL-TIME UPDATE ${updates.length}: +${update.messages_added} messages at ${timestamp}ms (total: ${newCount})`)
        
        // Screenshot each update
        await testPage.screenshot({ 
          path: path.join(EVIDENCE_DIR, `final-04-update-${updates.length}-${timestamp}ms.png`),
          fullPage: true 
        })
        
        currentCount = newCount
      }
      
      // Stop if we got substantial streaming activity
      if (updates.length >= 5 || currentCount > initialCount + 10) {
        console.log('✅ Substantial streaming activity detected, test complete')
        break
      }
    }
    
    const totalDuration = Date.now() - sendTime
    
    // Take final screenshot
    await testPage.screenshot({ 
      path: path.join(EVIDENCE_DIR, 'final-05-streaming-complete.png'),
      fullPage: true 
    })
    
    console.log(`\\n🎯 FINAL RESULTS:`)
    console.log(`Total duration: ${totalDuration}ms`)
    console.log(`Messages received: ${currentCount - initialCount}`)
    console.log(`Real-time updates: ${updates.length}`)
    console.log(`Socket.io logs captured: ${socketLogs.length}`)
    
    // Save comprehensive evidence
    const evidence = {
      test: 'Final Socket.io Real-time Validation',
      timestamp: new Date().toISOString(),
      project_name: projectName,
      test_prompt: testPrompt,
      initial_message_count: initialCount,
      final_message_count: currentCount,
      messages_received_realtime: currentCount - initialCount,
      realtime_updates: updates,
      total_duration_ms: totalDuration,
      socketio_logs_count: socketLogs.length,
      success: updates.length > 0 && currentCount > initialCount,
      evidence_quality: {
        screenshots_captured: 5 + updates.length,
        console_logs_captured: consoleLogs.length,
        socketio_logs_captured: socketLogs.length,
        time_series_data: updates.length > 0
      }
    }
    
    // Save all evidence files
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'final-validation-results.json'),
      JSON.stringify(evidence, null, 2)
    )
    
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'socketio-console-logs.json'),
      JSON.stringify(socketLogs, null, 2)
    )
    
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'all-console-logs.json'),
      JSON.stringify(consoleLogs, null, 2)
    )
    
    console.log(`\\n📊 EVIDENCE SUMMARY:`)
    console.log(`Screenshots: ${evidence.evidence_quality.screenshots_captured}`)
    console.log(`Console logs: ${evidence.evidence_quality.console_logs_captured}`)
    console.log(`Socket.io logs: ${evidence.evidence_quality.socketio_logs_captured}`)
    console.log(`Time-series data: ${evidence.evidence_quality.time_series_data}`)
    console.log(`Success: ${evidence.success}`)
    
    // Verify we got real-time streaming
    expect(evidence.success).toBeTruthy()
    
    await context.close()
  })
})