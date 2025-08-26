# Vibegrapher v0 Frontend Specification (Simplified)

**Note: This is the technical specification. For implementation workflow and setup instructions, see `prompt_frontend_v0.md`**

## Overview
React TypeScript interface for vibecoding agents via natural language. No graph visualization in v0.

## Technology Stack
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui components
- Zustand (state) + React Query (data fetching)
- Monaco Editor (code display)
- Socket.io-client (real-time updates with Socket.io)
- IMPORTANT: Tests must hit real backend (no mocking)

## Layout (v0 - Simple)
- Left: Vibecode panel (full height)
- Right top: Code viewer panel
- Right bottom: Test results panel

## Core Components with shadcn/ui

### VibecodePanel
```typescript
interface VibecodePanelProps {
  projectId: string;
}

// shadcn components used:
// - Card: Main panel container
// - Button: "Start Session", "Clear Session", "Accept", "Reject"
// - ScrollArea: Conversation history scrollable area
// - Textarea: Message input with auto-resize
// - Avatar: User/assistant message icons
// - Separator: Between messages
// - Badge: Session status indicator
// - Tooltip: Hover info for trace IDs
```

### CodeViewer
```typescript
interface CodeViewerProps {
  projectId: string;
  highlightNode?: string;
}

// shadcn components used:
// - Card: Container for code editor
// - Tabs/TabsList/TabsTrigger: Switch between files
// - Badge: File status indicators
// Monaco editor for actual code display
```

### Test Execution (Within DiffReviewModal Only)
```typescript
// No standalone test runner panel in v0
// Tests are only shown/run within DiffReviewModal during human review
// Features integrated into DiffReviewModal:
// - Select dropdown for quick/all/specific tests
// - Progress bar during test execution
// - Pass/fail badges inline with diff
// - Test results cached on diff to avoid re-running
// - Alert components for test results
```

### DiffViewer & Human Review Components
```typescript
// DiffReviewModal: Shows diff with test execution + Accept/Reject
//   - Run Tests dropdown (Quick/All/Specific tests)
//   - Test results display with pass/fail badges
//   - Token usage shown with badge
//   - Token usage prominent (prompt/completion/total)
//   - Requires rejection reason if rejecting
// CommitMessageModal: Edit/refine commit message, calls evaluator for suggestions
// Uses: Dialog, Card, Button, Textarea, Badge, Select, Progress, Monaco Diff Editor
```

## State Management

```typescript
// Zustand store with localStorage persistence
interface AppState {
  // CRITICAL: Selective persistence to avoid stale data issues
  // Persisted fields (survive page refresh):
  currentSession: VibecodeSession | null;  // Session metadata only
  currentReviewDiff: Diff | null;          // For modal recovery
  pendingDiffIds: string[];                // IDs only, refetch data
  draftMessage: string;                    // Prevent data loss
  lastActiveTime: number;                  // For stale detection
  approvalMode: 'auto' | 'manual';        // User preference
  
  // Non-persisted fields (refetch from server):
  project: Project | null;                 // Always fresh from server
  messages: ConversationMessage[];         // From SQLiteSession on backend
  pendingDiffs: Diff[];                    // Full objects fetched via IDs
  
  actions: {
    // Standard actions...
  }
}

// Uses Zustand persist middleware with:
// - Selective persistence via partialize function
// - 24-hour stale state cleanup
// - version: 1 for future migrations
// - Synchronous localStorage (instant recovery)

// React Query for server data
useProject(id: string)
useMessages(sessionId: string)
usePendingDiffs(sessionId: string)
```

## API Service

```typescript
// ApiService: Uses VITE_API_URL from environment
// Methods: startSession, sendMessage (with feedbackType for human rejection)
// Diff methods: getPendingDiffs, reviewDiff, runDiffTests, commitDiff, refineCommitMessage
// Test methods: getQuickTests, runTestsOnDiff
```

## Socket.io Integration

```typescript
import { io, Socket } from 'socket.io-client';

class WebSocketService {
  private socket: Socket;
  
  connect(projectId: string) {
    const WS_URL = import.meta.env.VITE_WS_URL || '';
    this.socket = io(WS_URL, { 
      path: '/socket.io/',
      query: { project_id: projectId }
    });
    
    // FAIL LOUDLY: Log all events, errors with stack traces
    this.socket.on('connect', () => console.log('[Socket.io] Connected'));
    this.socket.on('connect_error', (e) => {
      console.error('[Socket.io] Connect Error:', e);
      throw new Error(`WebSocket connection failed: ${e.message}`);
    });
    
    // On vibecode_response: If status='pending_human_review', show DiffReviewModal
    
    this.socket.on('test_completed', (data) => {
      console.log('[WS] Test completed:', data);
      console.log('[WS] Test status:', data.status);
      // Update test results
    });
    
    this.socket.on('error', (e) => {
      console.error('[Socket.io] Error:', e);
      // Display error banner to user
    });
    
    // Log ALL events for debugging
    this.socket.onAny((event, ...args) => {
      console.log(`[Socket.io] ${event}:`, args);
    });
    
    // Handle reconnection
    this.socket.on('connect', async () => {
      if (this.wasDisconnected) {
        console.log('[Socket.io] Reconnected - restoring conversation');
        // Restore conversation from backend
        await this.restoreConversation();
      }
    });
    
    this.socket.on('disconnect', () => {
      this.wasDisconnected = true;
      console.log('[Socket.io] Disconnected - data recoverable via REST');
    });
  }
  
  async restoreConversation() {
    // Call GET /sessions/:id/messages to restore full history
    // Compare with local state to detect missing messages
    // Re-sync any pending diffs
  }
}
```

## Session Flow with Human Review

**CRITICAL: Understand the Vibecoder Workflow (see spec_datamodel_v0.md section "Vibecoder Interactive Workflow")**

**REAL-TIME MESSAGE STREAMING (Priority #1):**
- Backend streams EVERY AI response immediately via `conversation_message` Socket.io events
- Frontend displays each message as soon as received (no batching)
- Shows: VibeCoder attempts, Evaluator feedback, iteration count, token usage
- Database saves happen asynchronously in background (don't block streaming)

1. User opens project → Check for pending diffs
2. User clicks "Start Session" (or "Start Node Session")
3. Frontend calls POST /projects/{id}/sessions
4. Store session ID in state
5. User sends messages via POST /sessions/{id}/messages (returns immediately)
6. VibeCoder → Evaluator loop runs (backend, max 3 iterations)
   - Listen for `conversation_message` events for ALL agent responses
   - Display each response immediately as received
   - Show agent type (VibeCoder/Evaluator) and iteration number
7. If max iterations reached:
   - Display error with evaluator's final feedback
   - User can send new message to continue (VibeCoder maintains context)
8. If evaluator approves:
   - Backend creates Diff record
   - Frontend receives diff_id via WebSocket
   - DiffReviewModal opens automatically
9. Human reviews diff (with optional test execution):
   - Run Tests → Execute quick/all/specific tests on diff
   - View results with OpenAI trace links and token usage
   - Accept → CommitMessageModal opens
   - Test & Accept → Run tests, auto-accept if all pass
   - Reject → New vibecode iteration with feedback
10. In CommitMessageModal:
    - User can edit or refine message
    - Commit → Diff applied to git
11. After commit: Evaluator context cleared, VibeCoder keeps conversation history

## Page Refresh Recovery
```typescript
// Automatic recovery via Zustand persist:
// 1. localStorage hydrates ALL state synchronously
// 2. Modals re-open if they were open
// 3. Draft messages restored
// 4. Conversation history restored
// 5. Session validated with server
// 6. Stale state (>24h) cleared automatically
```

## Configuration
```typescript
// config.ts: Load VITE_API_URL and VITE_WS_URL from environment
// Local: localhost:8000, Remote dev: SERVER_IP:8000, Prod: your-api.fly.dev
// Never hardcode URLs - always use environment variables
```

## Mobile Responsiveness with shadcn
- Sheet component for mobile navigation
- Tabs component to switch panels on mobile
- Drawer for bottom-sheet patterns
- DropdownMenu for mobile-friendly actions
- All shadcn components are touch-optimized
- Minimum 375px width support

## Error Handling with shadcn
- Error boundaries on all major components
- Sonner (shadcn toast) for notifications
- Alert component for inline errors
- AlertDialog for critical errors
- Show error context for debugging
- FAIL LOUDLY: Log all errors with stack traces to console
- Display all network errors to user immediately
- Never swallow exceptions silently

## Testing

### Test Framework Requirements
**CRITICAL: Tests MUST use real backend (NO mocking):**
1. **Backend Required**: Backend must be running before tests start
2. **Health Check**: Tests should verify backend connectivity first
3. **Test Isolation**: Each test suite should use unique project IDs
4. **Cleanup**: Delete test projects after completion
5. **Real OpenAI**: Tests will trigger real OpenAI API calls

### Test Strategy
- **MCP Manual Testing First**: See `prompt_frontend_v0.md` for required Playwright MCP exploration workflow
- Playwright for E2E (must hit real backend, HEADLESS mode)
- Component tests with React Testing Library (real backend)
- MSW only for mocking Socket.io events in integration tests
- Validated test evidence after each phase