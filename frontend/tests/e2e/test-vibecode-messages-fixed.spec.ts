/**
 * Fixed test for verifying vibecode messages are properly displayed
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// Create evidence directory at project root
const EVIDENCE_DIR = path.join(process.cwd(), '..', 'validated_test_evidence', 'vibecode-messages')

test.describe('Vibecode Message Display', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(EVIDENCE_DIR)) {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
    }
  })
  
  test('capture evidence of message display', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      const text = msg.text()
      if (text.includes('[VibecodePanel]') || text.includes('[Socket.io]') || text.includes('message')) {
        console.log('Browser:', text)
      }
    })
    
    // Navigate to haiku project
    await page.goto('http://kui-vibes:5173/project/d849869b-71bf-466f-bcf2-01680b2e2abd')
    await page.waitForLoadState('networkidle')
    
    // 01 - Initial load
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, '01-initial-load.png'),
      fullPage: true 
    })
    
    // Wait for any existing content
    await page.waitForTimeout(3000)
    
    // Check for session
    const hasSession = await page.locator('text=Session Active').isVisible().catch(() => false)
    console.log('Has active session:', hasSession)
    
    // 02 - Session state
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, '02-session-state.png'),
      fullPage: true 
    })
    
    // Send a message
    const textarea = page.locator('textarea[placeholder*="Type your message"]').first()
    await textarea.fill('Write a Python function to calculate fibonacci numbers')
    
    // 03 - Message typed
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, '03-message-typed.png'),
      fullPage: true 
    })
    
    // Send the message
    await page.keyboard.press('Enter')
    
    // Wait for user message to appear
    await expect(page.getByText('Write a Python function to calculate fibonacci')).toBeVisible({ timeout: 5000 })
    
    // 04 - User message sent
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, '04-user-message-sent.png'),
      fullPage: true 
    })
    
    // Wait longer for AI response
    console.log('Waiting for AI response...')
    await page.waitForTimeout(10000)
    
    // 05 - After response wait
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, '05-after-response-wait.png'),
      fullPage: true 
    })
    
    // Check what we have
    const messageCount = await page.locator('.flex.gap-3').count()
    const hasVibeCoder = await page.locator('text=VibeCoder').isVisible().catch(() => false)
    const hasEvaluator = await page.locator('text=Evaluator').isVisible().catch(() => false)
    const iterationCount = await page.locator('text=/Iteration \\d+/').count()
    
    console.log(`
Results:
- Message containers: ${messageCount}
- VibeCoder visible: ${hasVibeCoder}
- Evaluator visible: ${hasEvaluator}  
- Iteration badges: ${iterationCount}
    `)
    
    // Final screenshot
    await page.screenshot({ 
      path: path.join(EVIDENCE_DIR, '06-final-state.png'),
      fullPage: true 
    })
    
    console.log(`\n✅ Evidence saved to: ${path.resolve(EVIDENCE_DIR)}\n`)
    
    // List files created
    const files = fs.readdirSync(EVIDENCE_DIR)
    console.log('Files created:')
    files.forEach(f => console.log(`  - ${f}`))
  })
})