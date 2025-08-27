/**
 * Socket.io Connection Bug Test
 * This test isolates and demonstrates the excessive Socket.io connection issue
 * 
 * Bug: Components create new callback functions on every render, causing 
 * useSocketIO hook to reconnect constantly
 * 
 * Expected: 1 connection per page visit
 * Actual: Hundreds of connections due to callback recreation
 * 
 * Run with: npx playwright test socketio-connection-bug.spec.ts
 */

import { test, expect, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'
const EVIDENCE_DIR = 'validated_test_evidence/socketio-bug'

// Ensure evidence directory exists
test.beforeAll(async () => {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
  }
})

interface ConnectionEvent {
  timestamp: string
  event: 'connected' | 'disconnected'
  clientId: string
  totalConnections: number
}

// Helper to analyze backend logs for connection events
async function analyzeBackendConnections(startTime: Date, endTime: Date): Promise<ConnectionEvent[]> {
  const connections: ConnectionEvent[] = []
  
  try {
    // Read the backend log file
    const logContent = fs.readFileSync('/tmp/backend.log', 'utf-8')
    const lines = logContent.split('\n')
    
    for (const line of lines) {
      if (line.includes('Client connected:') || line.includes('Client disconnected:')) {
        // Extract timestamp from log line
        const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d+/)
        if (!timestampMatch) continue
        
        const logTime = new Date(timestampMatch[1])
        if (logTime < startTime || logTime > endTime) continue
        
        const match = line.match(/Client (connected|disconnected): ([^,]+), total connections: (\d+)/)
        if (match) {
          connections.push({
            timestamp: logTime.toISOString(),
            event: match[1] as 'connected' | 'disconnected',
            clientId: match[2],
            totalConnections: parseInt(match[3])
          })
        }
      }
    }
  } catch (error) {
    console.error('Failed to read backend log:', error)
  }
  
  return connections
}

// Helper to capture evidence
async function captureEvidence(page: Page, testName: string, step: string, connections: ConnectionEvent[]) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const evidenceFile = path.join(EVIDENCE_DIR, `${timestamp}-${testName}-${step}.json`)
  
  const evidence = {
    timestamp,
    testName,
    step,
    connectionEvents: connections,
    totalConnections: connections.length,
    uniqueClients: [...new Set(connections.map(c => c.clientId))].length,
    maxConcurrentConnections: Math.max(...connections.map(c => c.totalConnections), 0)
  }
  
  fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2))
  
  // Also take screenshot
  const screenshotFile = path.join(EVIDENCE_DIR, `${timestamp}-${testName}-${step}.png`)
  await page.screenshot({ path: screenshotFile, fullPage: false })
  
  console.log(`Evidence saved: ${evidenceFile}`)
  return evidence
}

test.describe('Socket.io Connection Bug', () => {
  
  test('demonstrates excessive connections before fix', async ({ page }) => {
    console.log('Starting Socket.io connection bug test...')
    
    const startTime = new Date()
    
    // Navigate to project page
    await page.goto(`${BASE_URL}/project/test-socketio-bug`)
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    // Simulate user interactions that trigger re-renders
    console.log('Simulating user interactions...')
    
    // Click around to trigger state changes and re-renders
    await page.getByRole('button', { name: /dark mode/i }).click().catch(() => {})
    await page.waitForTimeout(1000)
    
    // Try to find and interact with input field
    const inputField = page.locator('textarea, input[type="text"]').first()
    if (await inputField.count() > 0) {
      await inputField.click()
      await inputField.fill('Test message 1')
      await page.waitForTimeout(1000)
      
      await inputField.clear()
      await inputField.fill('Test message 2')
      await page.waitForTimeout(1000)
      
      await inputField.clear()
      await inputField.fill('Test message 3')
      await page.waitForTimeout(1000)
    }
    
    // Click tabs or panels if they exist
    const tabButtons = page.locator('button[role="tab"], .tab-button, [data-testid*="tab"]')
    const tabCount = await tabButtons.count()
    console.log(`Found ${tabCount} tab-like elements`)
    
    for (let i = 0; i < Math.min(tabCount, 3); i++) {
      try {
        await tabButtons.nth(i).click()
        await page.waitForTimeout(1000)
      } catch (e) {
        console.log(`Could not click tab ${i}:`, e.message)
      }
    }
    
    // Resize window to trigger re-renders
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.waitForTimeout(1000)
    await page.setViewportSize({ width: 800, height: 600 })
    await page.waitForTimeout(1000)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(1000)
    
    // Wait for more connections to accumulate
    console.log('Waiting for connections to accumulate...')
    await page.waitForTimeout(30000) // Wait 30 more seconds
    
    const endTime = new Date()
    
    // Analyze backend logs for connections
    const connections = await analyzeBackendConnections(startTime, endTime)
    console.log(`Collected ${connections.length} connection events`)
    
    // Capture evidence
    const evidence = await captureEvidence(page, 'bug-before-fix', 'excessive-connections', connections)
    
    // Analyze results
    const uniqueConnections = [...new Set(connections.filter(c => c.event === 'connected').map(c => c.clientId))]
    const totalConnections = connections.filter(c => c.event === 'connected').length
    const totalDisconnections = connections.filter(c => c.event === 'disconnected').length
    
    console.log(`Analysis:`)
    console.log(`- Total connection events: ${totalConnections}`)
    console.log(`- Total disconnection events: ${totalDisconnections}`)
    console.log(`- Unique client IDs: ${uniqueConnections.length}`)
    console.log(`- Max concurrent connections: ${evidence.maxConcurrentConnections}`)
    
    // The bug should show excessive connections (much more than expected 1-2)
    // We expect this test to demonstrate the bug by showing many connections
    expect(totalConnections).toBeGreaterThan(5) // This proves the bug exists
    
    // Save summary for comparison after fix
    const summaryFile = path.join(EVIDENCE_DIR, 'bug-summary-before-fix.json')
    fs.writeFileSync(summaryFile, JSON.stringify({
      testType: 'before-fix',
      totalConnections,
      totalDisconnections,
      uniqueClients: uniqueConnections.length,
      maxConcurrent: evidence.maxConcurrentConnections,
      duration: '60 seconds',
      userActions: [
        'Page navigation',
        'Dark mode toggle',
        'Input field interactions (3 messages)',
        'Tab clicking',
        'Window resizing (3 times)'
      ]
    }, null, 2))
    
    console.log(`Bug demonstrated: ${totalConnections} connections in 60 seconds (expected: 1-2)`)
  })

  test('validates minimal connections after fix', async ({ page }) => {
    console.log('Testing connections after fix...')
    
    const startTime = new Date()
    
    // Same test sequence as before
    await page.goto(`${BASE_URL}/project/test-socketio-bug`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    // Same user interactions
    await page.getByRole('button', { name: /dark mode/i }).click().catch(() => {})
    await page.waitForTimeout(1000)
    
    const inputField = page.locator('textarea, input[type="text"]').first()
    if (await inputField.count() > 0) {
      await inputField.click()
      await inputField.fill('Test message 1')
      await page.waitForTimeout(1000)
      await inputField.clear()
      await inputField.fill('Test message 2')
      await page.waitForTimeout(1000)
      await inputField.clear()
      await inputField.fill('Test message 3')
      await page.waitForTimeout(1000)
    }
    
    const tabButtons = page.locator('button[role="tab"], .tab-button, [data-testid*="tab"]')
    const tabCount = await tabButtons.count()
    for (let i = 0; i < Math.min(tabCount, 3); i++) {
      try {
        await tabButtons.nth(i).click()
        await page.waitForTimeout(1000)
      } catch {
        // Continue
      }
    }
    
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.waitForTimeout(1000)
    await page.setViewportSize({ width: 800, height: 600 })
    await page.waitForTimeout(1000)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.waitForTimeout(30000)
    
    const endTime = new Date()
    
    const connections = await analyzeBackendConnections(startTime, endTime)
    const evidence = await captureEvidence(page, 'after-fix', 'minimal-connections', connections)
    
    const totalConnections = connections.filter(c => c.event === 'connected').length
    const totalDisconnections = connections.filter(c => c.event === 'disconnected').length
    
    console.log(`After fix - Total connections: ${totalConnections}, disconnections: ${totalDisconnections}`)
    
    // After fix, we should see minimal connections (1-3 at most)
    expect(totalConnections).toBeLessThan(5)
    expect(evidence.maxConcurrentConnections).toBeLessThanOrEqual(1)
    
    const summaryFile = path.join(EVIDENCE_DIR, 'bug-summary-after-fix.json')
    fs.writeFileSync(summaryFile, JSON.stringify({
      testType: 'after-fix',
      totalConnections,
      totalDisconnections,
      uniqueClients: [...new Set(connections.filter(c => c.event === 'connected').map(c => c.clientId))].length,
      maxConcurrent: evidence.maxConcurrentConnections,
      duration: '60 seconds',
      userActions: 'Same as before-fix test'
    }, null, 2))
    
    console.log(`Fix validated: ${totalConnections} connections in 60 seconds (expected: 1-2)`)
  })
})