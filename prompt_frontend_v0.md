# Frontend Agent Instructions for Vibegrapher v0

## Your Mission
Build a React TypeScript interface for vibecoding OpenAI agents through natural language. No graph visualization in v0.

## Setup Phase

### 1. Read Specifications
- `SPEC_v0_DataModel_API.md` - Understand API contracts
- `SPEC_v0_Frontend_REVISED.md` - UI requirements
- Review shadcn/ui docs for components

### 2. Environment Configuration
```bash
# .env (never commit this)
REACT_APP_API_URL=http://your-backend:8000
REACT_APP_WS_URL=ws://your-backend:8000
PORT=3000
```

**CRITICAL**: No hardcoded localhost! Works on any domain.

### 3. Check Git Security (CRITICAL)
```bash
# Verify gitleaks is installed
which gitleaks || echo "ERROR: Install gitleaks first!"

# Verify pre-commit hook exists
test -f .git/hooks/pre-commit || echo "ERROR: Set up pre-commit hook!"

# If missing, set it up:
echo 'gitleaks detect --source . --verbose' > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

**NEVER use `git add .`** - Add specific files only

### 4. Create React App
```bash
npx create-react-app@latest frontend --template typescript
cd frontend

# Core dependencies
npm install @tanstack/react-query zustand
npm install axios socket.io-client
npm install tailwindcss @monaco-editor/react

# shadcn/ui
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input textarea toast

# Playwright for testing
npm install -D @playwright/test
```

### 5. Project Structure
```
frontend/
├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── services/
│   └── store/
├── tests/
└── validated_test_evidence/  # Test artifacts
```

### 6. Hello World Test
```typescript
// App.tsx - Must connect to backend
// Test with Playwright MCP
// Must work before continuing
```

## Implementation Phases

### Phase 1: Core Layout & Session Management
1. Basic routing (home, project page)
2. Zustand store with session tracking
3. React Query configuration
4. Two-panel layout: Vibecode | Code
5. **Tests**: Navigate between pages, verify layout

**Validated Test Evidence**:
```bash
# After Phase 1 completion
git add src/ && git commit -m "Phase 1: Core layout complete"
HASH=$(git rev-parse HEAD)

# Create test evidence script
cat > validated_test_evidence/${HASH}-phase1.sh << 'EOF'
#!/bin/bash
OUTPUT_DIR="validated_test_evidence/${HASH}-phase1"
mkdir -p $OUTPUT_DIR

# Run Playwright tests
npx playwright test tests/phase1.spec.ts --reporter=html:$OUTPUT_DIR/playwright-report

# Take screenshots of key pages
npx playwright screenshot http://localhost:3000 $OUTPUT_DIR/home.png --viewport-size=1280,720
npx playwright screenshot http://localhost:3000/project/test $OUTPUT_DIR/project.png --viewport-size=1280,720

# Mobile views
npx playwright screenshot http://localhost:3000 $OUTPUT_DIR/home-mobile.png --viewport-size=375,667
npx playwright screenshot http://localhost:3000/project/test $OUTPUT_DIR/project-mobile.png --viewport-size=375,667

# Resize screenshots if too large
for img in $OUTPUT_DIR/*.png; do
  convert "$img" -resize 50% "$img"
done

echo "Phase 1 validation complete"
EOF

chmod +x validated_test_evidence/${HASH}-phase1.sh
./validated_test_evidence/${HASH}-phase1.sh

# Commit evidence
git add validated_test_evidence/
git commit -m "Phase 1: Validated test evidence"
```

### Phase 2: WebSocket Debug Setup
**CRITICAL - Do this early!**
```typescript
// Debug all WebSocket messages
socket.on('connect', () => console.log('[WS] Connected'));
socket.on('disconnect', () => console.log('[WS] Disconnected'));
socket.on('message', (data) => console.log('[WS]', data));
socket.on('vibecode_response', (data) => console.log('[WS] Vibecode:', data, 'trace:', data.trace_id));
```

### Phase 3: Session & Message Flow
1. Start session button/logic
2. Track current session in store
3. Message history display
4. Input field for prompts
5. **Tests**: Start session, send message, see response

**Validated Test Evidence**:
```bash
# After Phase 3 completion
git commit -m "Phase 3: Session management complete"
HASH=$(git rev-parse HEAD)

cat > validated_test_evidence/${HASH}-phase3.sh << 'EOF'
#!/bin/bash
OUTPUT_DIR="validated_test_evidence/${HASH}-phase3"
mkdir -p $OUTPUT_DIR

# Test session flow
npx playwright test tests/session.spec.ts --reporter=json:$OUTPUT_DIR/test-results.json

# Capture WebSocket logs (from browser console)
npx playwright test tests/websocket-debug.spec.ts > $OUTPUT_DIR/websocket.log 2>&1

# Screenshot conversation
npx playwright screenshot http://localhost:3000/project/test \
  --selector='.vibecode-panel' \
  $OUTPUT_DIR/conversation.png \
  --viewport-size=800,600

# Verify session state in localStorage
npx playwright evaluate "localStorage.getItem('session')" > $OUTPUT_DIR/session-state.txt

echo "Phase 3 validation complete"
EOF

chmod +x validated_test_evidence/${HASH}-phase3.sh
./validated_test_evidence/${HASH}-phase3.sh
git add validated_test_evidence/
git commit -m "Phase 3: Validated test evidence"
```

### Phase 4: Code Viewer
1. Monaco editor (read-only)
2. Python syntax highlighting
3. Refresh on code changes
4. **Tests**: Code displays, updates on changes

### Phase 5: Diff Handling
1. DiffViewer with side-by-side
2. Accept/Reject buttons
3. On accept, refresh code view
4. Show trace_id in debug info
5. **Tests**: Accept diff, verify code updates

### Phase 6: Test Runner
1. List test cases
2. Add/edit/delete tests
3. Run button with loading state
4. Show results with trace_id
5. **Tests**: Add test, run it, see result

### Phase 7: Mobile Responsive
1. Stack panels vertically
2. Tab navigation between panels
3. Touch-friendly inputs
4. **Tests**: Works at 375px width

**Final Validated Test Evidence**:
```bash
# After all phases complete
git commit -m "v0 Complete: All phases implemented"
HASH=$(git rev-parse HEAD)

cat > validated_test_evidence/${HASH}-final.sh << 'EOF'
#!/bin/bash
OUTPUT_DIR="validated_test_evidence/${HASH}-final"
mkdir -p $OUTPUT_DIR

# Run ALL Playwright tests
npx playwright test --reporter=html:$OUTPUT_DIR/full-report

# E2E test with screenshots
npx playwright test tests/e2e.spec.ts --screenshot=on --video=on \
  --output=$OUTPUT_DIR/e2e-artifacts

# Lighthouse audit
npx lighthouse http://localhost:3000 \
  --output=html \
  --output-path=$OUTPUT_DIR/lighthouse.html \
  --only-categories=performance,accessibility

# Bundle size analysis
npm run build
ls -lh build/static/js/*.js > $OUTPUT_DIR/bundle-sizes.txt

# Final screenshots (desktop and mobile)
for page in "" "project/test"; do
  npx playwright screenshot http://localhost:3000/$page \
    $OUTPUT_DIR/desktop-$(echo $page | tr '/' '-').png \
    --viewport-size=1280,720
  
  npx playwright screenshot http://localhost:3000/$page \
    $OUTPUT_DIR/mobile-$(echo $page | tr '/' '-').png \
    --viewport-size=375,667
done

# Resize large images
for img in $OUTPUT_DIR/*.png; do
  [ -f "$img" ] && convert "$img" -resize 800x600\> "$img"
done

echo "Final validation complete - v0 ready!"
EOF

chmod +x validated_test_evidence/${HASH}-final.sh
./validated_test_evidence/${HASH}-final.sh
git add validated_test_evidence/
git commit -m "v0: Final validated test evidence"
```

## API Integration with Sessions

```typescript
// Session management in store
interface AppState {
  currentSession: { id: string; type: 'global' | 'node' } | null;
  
  startSession: async (projectId: string, nodeId?: string) => {
    const response = await api.post(`/projects/${projectId}/sessions`, { node_id: nodeId });
    set({ currentSession: response.data });
    return response.data;
  };
  
  sendMessage: async (prompt: string) => {
    const { currentSession } = get();
    if (!currentSession) throw new Error('No active session');
    
    const response = await api.post(`/sessions/${currentSession.id}/messages`, { prompt });
    console.log('[API] Message sent, trace:', response.data.trace_id);
    return response.data;
  };
  
  clearSession: async () => {
    const { currentSession } = get();
    if (currentSession) {
      await api.delete(`/sessions/${currentSession.id}`);
      set({ currentSession: null });
    }
  };
}
```

## WebSocket Handling with Trace

```typescript
useEffect(() => {
  const socket = io(config.wsUrl);
  
  socket.on('vibecode_response', (data) => {
    console.log('[WS] Vibecode response:', data);
    console.log('[WS] Trace ID:', data.trace_id);
    // Update messages
    // Show diff if present
  });
  
  socket.on('test_completed', (data) => {
    console.log('[WS] Test completed:', data);
    console.log('[WS] Test trace:', data.trace_id);
    // Update test results
  });
  
  return () => socket.disconnect();
}, []);
```

## Testing Strategy

Use Playwright MCP for all tests:

```typescript
test('session workflow', async ({ page }) => {
  await page.goto('http://localhost:3000/project/123');
  
  // Start global session
  await page.click('text=Start Session');
  
  // Send vibecode message
  await page.fill('.prompt-input', 'Add a Spanish agent');
  await page.press('.prompt-input', 'Enter');
  
  // Wait for diff
  await page.waitForSelector('.diff-viewer');
  
  // Verify trace ID in console
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  await expect(consoleLogs.some(log => log.includes('trace:'))).toBeTruthy();
  
  // Accept changes
  await page.click('text=Accept');
  
  // Clear session
  await page.click('text=Clear Session');
});
```

## Quality Checklist

Before EVERY commit:
- [ ] Tests pass
- [ ] No hardcoded URLs
- [ ] WebSocket debug logs working
- [ ] Session management correct
- [ ] Mobile responsive
- [ ] Loading states present
- [ ] Error handling works
- [ ] Used `git add <specific files>`
- [ ] Validated test evidence created for milestone

## Remember
- No graph visualization in v0
- Log all WebSocket messages with trace_id
- Frontend manages session state
- Mobile-first responsive design
- Test with Playwright MCP
- Validated test evidence after each phase
- Small, working commits