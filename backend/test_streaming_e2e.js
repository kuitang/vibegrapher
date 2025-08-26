const { chromium } = require('playwright');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testStreamingE2E() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('1. Navigating to homepage...');
  await page.goto('http://localhost:5173');
  await page.waitForSelector('h1:has-text("Projects")');
  
  console.log('2. Creating new project...');
  const projectName = `Streaming Test ${Date.now()}`;
  await page.fill('input[placeholder="Project name"]', projectName);
  await page.click('button[aria-label="Create project"]');
  
  // Wait for navigation to project page
  await page.waitForURL(/\/project\//);
  await sleep(2000); // Wait for Socket.io connection
  
  console.log('3. Waiting for Socket.io connection...');
  await page.waitForSelector('text=Connected', { timeout: 10000 });
  
  console.log('4. Taking initial screenshot...');
  await page.screenshot({ 
    path: 'validated_test_evidence/streaming_01_initial.png',
    fullPage: false 
  });
  
  console.log('5. Sending test message...');
  const testPrompt = "Write a Python function that calculates the factorial of a number";
  await page.fill('textarea[placeholder*="Type your message"]', testPrompt);
  await page.press('textarea[placeholder*="Type your message"]', 'Enter');
  
  console.log('6. Waiting for user message to appear...');
  await page.waitForSelector(`text="${testPrompt}"`, { timeout: 5000 });
  await page.screenshot({ 
    path: 'validated_test_evidence/streaming_02_user_message.png',
    fullPage: false 
  });
  
  console.log('7. Waiting for VibeCoder response...');
  // Wait for any message from VibeCoder
  let vibecodeFound = false;
  let evaluatorFound = false;
  let screenshotCounter = 3;
  
  for (let i = 0; i < 60; i++) { // Check for up to 60 seconds
    await sleep(1000);
    
    // Check for VibeCoder message
    if (!vibecodeFound) {
      const vibecoderElements = await page.$$('text=VibeCoder');
      if (vibecoderElements.length > 0) {
        console.log('VibeCoder message detected!');
        await page.screenshot({ 
          path: `validated_test_evidence/streaming_${String(screenshotCounter).padStart(2, '0')}_vibecoder.png`,
          fullPage: false 
        });
        vibecodeFound = true;
        screenshotCounter++;
      }
    }
    
    // Check for Evaluator message
    if (!evaluatorFound) {
      const evaluatorElements = await page.$$('text=Evaluator');
      if (evaluatorElements.length > 0) {
        console.log('Evaluator message detected!');
        await page.screenshot({ 
          path: `validated_test_evidence/streaming_${String(screenshotCounter).padStart(2, '0')}_evaluator.png`,
          fullPage: false 
        });
        evaluatorFound = true;
        screenshotCounter++;
      }
    }
    
    // Check for tool call messages
    const toolCallElements = await page.$$('text=Calling tool');
    if (toolCallElements.length > 0) {
      console.log('Tool call detected!');
      await page.screenshot({ 
        path: `validated_test_evidence/streaming_${String(screenshotCounter).padStart(2, '0')}_tool_call.png`,
        fullPage: false 
      });
      screenshotCounter++;
      await sleep(2000); // Wait a bit after tool call
    }
    
    // Check for completion (approved/rejected)
    const approvedElements = await page.$$('text=/approved.*true/i');
    const rejectedElements = await page.$$('text=/approved.*false/i');
    
    if (approvedElements.length > 0 || rejectedElements.length > 0) {
      console.log('Final evaluation detected!');
      await page.screenshot({ 
        path: `validated_test_evidence/streaming_${String(screenshotCounter).padStart(2, '0')}_final.png`,
        fullPage: false 
      });
      break;
    }
    
    // Take periodic screenshots to capture streaming
    if (i % 5 === 0) {
      await page.screenshot({ 
        path: `validated_test_evidence/streaming_progress_${i}.png`,
        fullPage: false 
      });
    }
  }
  
  console.log('8. Test completed!');
  console.log(`Screenshots saved: ${screenshotCounter} total`);
  
  // Keep browser open for manual inspection
  console.log('Keeping browser open for inspection. Press Ctrl+C to exit.');
  await sleep(300000); // Keep open for 5 minutes
  
  await browser.close();
}

// Run the test
testStreamingE2E().catch(console.error);