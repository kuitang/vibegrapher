# DONE as of commit f2969de

# Frontend Phase 004: Socket.io Debug Setup

## ⚠️ BACKEND DEPENDENCY CHECK
**REQUIRED**: Backend `plans/backend-phase-002-socketio.md` must be completed.
**VERIFICATION**: Check the backend phase file header for "# DONE as of commit". If not present, DO NOT START this phase and inform the user that the backend dependency is not ready.

## Objectives
Set up Socket.io connection with real-time message streaming support.

## Implementation Tasks
1. Socket.io service with debug logging
2. Connection state management
3. Auto-reconnection logic (Socket.io built-in)
4. **CRITICAL: Handle `conversation_message` events for ALL agent interactions**
5. Display messages immediately as received (no batching)

## Acceptance Criteria
- ✅ Socket.io connects on project page load
- ✅ **`conversation_message` events display immediately in chat**
- ✅ **Shows agent type (VibeCoder/Evaluator) and iteration number**
- ✅ **Token usage displayed for each AI response**
- ✅ All messages logged to console with session_id
- ✅ Auto-reconnects on disconnect (Socket.io handles this)
- ✅ Connection state shown in UI
- ✅ TypeScript types for all Socket.io messages

## Integration Tests (Vitest)
```typescript
// tests/integration/phase002-socketio.test.tsx
import { renderHook, waitFor } from '@testing-library/react'
import { useSocketIO } from '../src/hooks/useSocketIO'
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { io as ioClient } from 'socket.io-client'

describe('Phase 002: Socket.io', () => {
  let httpServer
  let ioServer
  let clientSocket
  
  beforeEach((done) => {
    httpServer = createServer()
    ioServer = new SocketIOServer(httpServer)
    httpServer.listen(() => {
      const port = httpServer.address().port
      clientSocket = ioClient(`http://localhost:${port}`)
      ioServer.on('connection', (socket) => {
        done()
      })
    })
  })
  
  afterEach(() => {
    ioServer.close()
    clientSocket.close()
    httpServer.close()
  })
  
  test('connects and logs messages', async () => {
    const consoleSpy = vi.spyOn(console, 'log')
    
    const { result } = renderHook(() => 
      useWebSocket('test-project')
    )
    
    await server.connected
    expect(consoleSpy).toHaveBeenCalledWith('[WS] Connected')
    
    // Send test message
    server.send(JSON.stringify({
      type: 'vibecode_response',
      session_id: 'test-session-123'
    }))
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        '[WS] Vibecode:',
        expect.objectContaining({ type: 'vibecode_response' }),
        'trace:',
        'test-123'
      )
    })
  })
  
  test('auto-reconnects on disconnect', async () => {
    const { result } = renderHook(() => useWebSocket('test-project'))
    
    await server.connected
    expect(result.current.connectionState).toBe('connected')
    
    server.close()
    
    await waitFor(() => {
      expect(result.current.connectionState).toBe('reconnecting')
    })
  })
})
```

## Mock Server for Development
```typescript
// tests/mocks/websocket-server.ts
import { WebSocketServer } from 'ws'

export function createMockWSServer(port = 8080) {
  const wss = new WebSocketServer({ port })
  
  wss.on('connection', (ws) => {
    console.log('[Mock WS] Client connected')
    
    // Send periodic test messages
    const interval = setInterval(() => {
      ws.send(JSON.stringify({
        type: 'vibecode_response',
        patch: '--- old\n+++ new',
        session_id: session.id
      }))
    }, 5000)
    
    ws.on('close', () => {
      clearInterval(interval)
    })
  })
  
  return wss
}
```

## Validation Script
```bash
#!/bin/bash
OUTPUT_DIR="frontend/validated_test_evidence/phase-004"
mkdir -p $OUTPUT_DIR

# Run integration tests
npm test -- --run tests/integration/phase004-socketio.test.tsx > $OUTPUT_DIR/vitest.log 2>&1

# Start mock server and test connection
node -e "
const { createMockWSServer } = require('./tests/mocks/websocket-server.ts')
const server = createMockWSServer(8080)
console.log('Mock WS server running on :8080')
setTimeout(() => process.exit(0), 10000)
" &

MOCK_PID=$!

# Test with real browser (headless)
npx playwright test tests/e2e/phase004-socketio.e2e.ts --reporter=json > $OUTPUT_DIR/playwright.json

kill $MOCK_PID

echo "Phase 004 validation complete"
```

## Deliverables
- [ ] WebSocket service in src/services/websocket.ts
- [ ] useWebSocket hook in src/hooks/
- [ ] Connection status component
- [ ] Integration tests with mock WS
- [ ] Validation evidence in frontend/validated_test_evidence/phase-004/