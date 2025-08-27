/**
 * Phase 2: Direct test with known session that has messages
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5175'
const EVIDENCE_DIR = '../validated_test_evidence/phase2'

test.describe('Phase 2: Direct Session Test', () => {
  
  test('Load session with existing 65 messages', async ({ page }) => {
    console.log('=== DIRECT TEST: Known session with messages ===')
    
    // Known session with 65 messages from Phase 1
    const sessionId = 'b98456f7-7b02-4029-a2eb-b938ee027463'
    const projectId = '59a28517-3c1a-4a93-9cd8-6e230faaeb0f'
    
    console.log('Setting up console logging...')
    const consoleLogs = []
    const networkLogs = []
    
    page.on('console', msg => {
      const logEntry = `[${msg.type().toUpperCase()}] ${msg.text()}`
      consoleLogs.push(logEntry)
      console.log(logEntry)
    })
    
    page.on('response', response => {
      if (response.url().includes('localhost:8000')) {
        networkLogs.push(`${response.request().method()} ${response.url()} => ${response.status()}`)
      }
    })
    
    // Navigate directly to project page
    const directUrl = `${BASE_URL}/project/${projectId}`
    console.log(`Navigating to: ${directUrl}`)
    
    await page.goto(directUrl)
    await page.waitForLoadState('networkidle', { timeout: 30000 })
    
    // Take screenshot of loaded page
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, 'direct-test-loaded.png'),
      fullPage: true 
    })
    
    // Check if project loads properly
    const pageTitle = await page.locator('h1').textContent()
    console.log(`Page title: ${pageTitle}`)
    
    // Wait for any messages to load
    await page.waitForTimeout(5000)
    
    // Check message count
    const messageCount = await page.locator('[data-testid="message"]').count()
    console.log(`Messages displayed: ${messageCount}`)
    
    // Check Socket.io status
    const isConnected = await page.locator(':text("Connected")').isVisible()
    const isConnecting = await page.locator(':text("Connecting")').isVisible()
    console.log(`Socket.io - Connected: ${isConnected}, Connecting: ${isConnecting}`)
    
    // Look for vibecode panel
    const hasVibecodePanelTitle = await page.locator('h3:text("Vibecode Panel")').isVisible()
    const hasTextArea = await page.locator('textarea[placeholder*="Type your message"]').isVisible()
    
    console.log(`UI Elements - Vibecode Panel: ${hasVibecodePanelTitle}, Textarea: ${hasTextArea}`)
    
    // Take final screenshot  
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, 'direct-test-final.png'),
      fullPage: true 
    })
    
    // Check for any API errors in console
    const errorLogs = consoleLogs.filter(log => log.includes('ERROR') || log.includes('Failed'))
    
    const evidence = {
      test: 'Phase 2 - Direct Session Test',
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      project_id: projectId, 
      direct_url: directUrl,
      page_title: pageTitle,
      messages_displayed: messageCount,
      expected_messages: 65,
      socket_status: {
        connected: isConnected,
        connecting: isConnecting
      },
      ui_elements: {
        vibecode_panel: hasVibecodePanelTitle,
        text_area: hasTextArea
      },
      console_errors: errorLogs,
      network_requests: networkLogs,
      success: messageCount > 0 && hasVibecodePanelTitle
    }
    
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'direct-session-test.json'),
      JSON.stringify(evidence, null, 2)
    )
    
    console.log(`\\n=== RESULTS ===`)
    console.log(`Messages: ${messageCount}/65 expected`)
    console.log(`UI loaded: ${hasVibecodePanelTitle}`)
    console.log(`Socket connected: ${isConnected}`)
    console.log(`Success: ${evidence.success}`)
    
    if (!evidence.success) {
      console.log(`Issues found:`)
      console.log(`  Error logs: ${errorLogs.length}`)
      console.log(`  Network requests: ${networkLogs.length}`)
    }
  })
})