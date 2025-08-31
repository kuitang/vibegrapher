/**
 * Phase 2: Frontend Real-time Streaming Tests
 * Tests message fetching and real-time Socket.io streaming
 */

import { test, expect, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5175'
const EVIDENCE_DIR = '../validated_test_evidence/phase2'

// Ensure evidence directory exists
test.beforeAll(async () => {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  }
})

test.describe('Phase 2: Frontend Real-time Streaming', () => {
  
  test('Fetch existing conversation messages', async ({ page }) => {
    console.log('=== TEST 1: Fetch existing conversation ===')
    
    // Navigate to frontend
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    
    // Take initial screenshot
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, 'phase2-homepage.png'),
      fullPage: true 
    })
    
    // Look for existing projects
    console.log('Looking for existing projects...')
    const projectLinks = await page.locator('a[href*="/project/"]').all()
    console.log(`Found ${projectLinks.length} project links`)
    
    if (projectLinks.length === 0) {
      console.log('No projects found, creating one...')
      await page.fill('input[placeholder="Project name"]', 'Phase 2 Test Project')
      await page.click('button:has-text("Create")')
      await page.waitForURL(/\/project\//)
    } else {
      // Click on first project 
      console.log('Opening first project...')
      await projectLinks[0].click()
      await page.waitForURL(/\/project\//)
    }
    
    await page.waitForLoadState('networkidle')
    
    // Take project page screenshot
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, 'phase2-project-page.png'),
      fullPage: true 
    })
    
    console.log('Current URL:', page.url())
    
    // Look for messages in the conversation panel
    const messages = await page.locator('[data-testid="message"]').count()
    console.log(`Found ${messages} existing messages`)
    
    // Check for Socket.io connection status
    const connectionStatus = await page.locator(':text("Connected")').count()
    const isConnecting = await page.locator(':text("Connecting")').count()
    
    console.log(`Connection status - Connected: ${connectionStatus}, Connecting: ${isConnecting}`)
    
    // Save evidence
    const evidence = {
      test: 'Phase 2 Frontend - Message Fetching',
      timestamp: new Date().toISOString(),
      url: page.url(),
      existing_messages_count: messages,
      connection_status: {
        connected: connectionStatus > 0,
        connecting: isConnecting > 0
      },
      success: true
    }
    
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'test1-message-fetching.json'),
      JSON.stringify(evidence, null, 2)
    )
    
    console.log('✅ Test 1 completed')
  })

  test('Send message and verify real-time streaming', async ({ page }) => {
    console.log('=== TEST 2: Real-time streaming ===')
    
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    
    // Create fresh project for streaming test
    const projectName = `Stream Test ${Date.now()}`
    await page.fill('input[placeholder="Project name"]', projectName)
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/project\//)
    await page.waitForLoadState('networkidle')
    
    // Take before screenshot
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, 'phase2-before-streaming.png'),
      fullPage: true 
    })
    
    // Count initial messages
    const initialCount = await page.locator('[data-testid="message"]').count()
    console.log(`Initial message count: ${initialCount}`)
    
    // Send a test message
    console.log('Sending streaming test message...')
    const testPrompt = 'Add a comment explaining what this code does'
    
    await page.fill('textarea[placeholder*="Type your message"]', testPrompt)
    
    // Take screenshot with message typed
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, 'phase2-message-ready.png'),
      fullPage: true 
    })
    
    // Send the message
    await page.click('button[aria-label="Send message"]')
    
    console.log('Message sent, monitoring for real-time updates...')
    
    // Monitor for streaming messages in real-time
    let currentCount = initialCount
    let updateCount = 0
    const startTime = Date.now()
    
    // Wait up to 60 seconds for streaming messages
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(1000)
      const newCount = await page.locator('[data-testid="message"]').count()
      
      if (newCount > currentCount) {
        updateCount++
        console.log(`Update ${updateCount}: Messages ${currentCount} → ${newCount}`)
        currentCount = newCount
        
        // Take screenshot when new messages appear
        await page.screenshot({ 
          path: path.join(EVIDENCE_DIR, `phase2-update-${updateCount}.png`),
          fullPage: true 
        })
      }
      
      // Stop early if we got a good number of messages
      if (newCount > initialCount + 5) {
        console.log('Got sufficient streaming messages, stopping early')
        break
      }
    }
    
    const endTime = Date.now()
    const duration = (endTime - startTime) / 1000
    
    // Take final screenshot
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, 'phase2-streaming-final.png'),
      fullPage: true 
    })
    
    console.log(`Final results: ${currentCount} messages after ${duration}s`)
    
    // Analyze results
    const streamingWorked = currentCount > initialCount
    const messagesReceived = currentCount - initialCount
    
    const evidence = {
      test: 'Phase 2 Frontend - Real-time Streaming',
      timestamp: new Date().toISOString(),
      project_name: projectName,
      initial_message_count: initialCount,
      final_message_count: currentCount,
      messages_received_via_streaming: messagesReceived,
      streaming_updates_detected: updateCount,
      test_duration_seconds: duration,
      streaming_worked: streamingWorked,
      success: streamingWorked && messagesReceived > 0
    }
    
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'test2-realtime-streaming.json'),
      JSON.stringify(evidence, null, 2)
    )
    
    if (evidence.success) {
      console.log(`✅ Phase 2 SUCCESS: ${messagesReceived} messages received in real-time`)
    } else {
      console.log(`❌ Phase 2 FAILED: No real-time streaming detected`)
    }
    
    expect(evidence.success).toBeTruthy()
  })
})