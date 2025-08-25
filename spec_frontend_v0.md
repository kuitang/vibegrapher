# Vibegrapher v0 Frontend Specification (Simplified)

## Overview
React TypeScript interface for vibecoding agents via natural language. No graph visualization in v0.

## Technology Stack
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui components
- Zustand (state) + React Query (data fetching)
- Monaco Editor (code display)
- Socket.io-client (real-time updates with Socket.io)

## Layout (v0 - Simple)
```
┌──────────────────────────────────────────┐
│ Header (Project name, User)              │
├──────────────────────────────────────────┤
│                                          │
│  ┌──────────────┬──────────────────┐    │
│  │              │                   │    │
│  │              │  Code View        │    │
│  │  Vibecode    │  (Read-only)      │    │
│  │  Panel       │  Python code      │    │
│  │              │                   │    │
│  │  [Session]   │  Monaco Editor    │    │
│  │  Messages    │                   │    │
│  │  Input       │  (Full Height)    │    │
│  │              │                   │    │
│  │ (Full Height)│                   │    │
│  └──────────────┴──────────────────┘    │
│                                          │
└──────────────────────────────────────────┘
```

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
//   - OpenAI trace_id shown as clickable link
//   - Token usage prominent (prompt/completion/total)
//   - Requires rejection reason if rejecting
// CommitMessageModal: Edit/refine commit message, calls evaluator for suggestions
// Uses: Dialog, Card, Button, Textarea, Badge, Select, Progress, Monaco Diff Editor
```

## State Management

```typescript
// Zustand store with localStorage persistence
interface AppState {
  // Regular state (not persisted)
  project: Project | null;
  currentSession: VibecodeSession | null;
  messages: ConversationMessage[];
  testResults: TestResult[] | null;
  isRunningTests: boolean;
  
  // PERSISTED to localStorage (critical UI state only)
  pendingDiffs: Diff[];
  currentReviewDiff: Diff | null;
  approvalMode: 'accept' | 'test-accept' | 'test-first';
  draftMessage: string;
  lastActiveTime: number;
  
  actions: {
    // Standard actions...
  }
}

// Uses Zustand persist middleware with:
// - partialize: Only persist UI state, not data
// - 24-hour stale state cleanup
// - version: 1 for future migrations
// - Synchronous localStorage (instant recovery)

// React Query for server data
useProject(id: string)
useMessages(sessionId: string)
useTestCases(projectId: string)
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
    
    // IMPORTANT: Log all messages for debugging
    this.socket.on('connect', () => console.log('[Socket.io] Connected'));
    
    // On vibecode_response: If status='pending_human_review', show DiffReviewModal
    
    this.socket.on('test_completed', (data) => {
      console.log('[WS] Test completed:', data);
      console.log('[WS] Test trace:', data.trace_id);
      // Update test results
    });
    
    this.socket.on('error', (e) => console.error('[Socket.io] Error:', e));
  }
}
```

## Session Flow with Human Review

1. User opens project → Check for pending diffs
2. User clicks "Start Session" (or "Start Node Session")
3. Frontend calls POST /projects/{id}/sessions
4. Store session ID in state
5. User sends messages via POST /sessions/{id}/messages
6. VibeCoder → Evaluator loop runs (backend)
7. If evaluator approves:
   - Backend creates Diff record
   - Frontend receives diff_id via WebSocket
   - DiffReviewModal opens automatically
8. Human reviews diff (with optional test execution):
   - Run Tests → Execute quick/all/specific tests on diff
   - View results with OpenAI trace links and token usage
   - Accept → CommitMessageModal opens
   - Test & Accept → Run tests, auto-accept if all pass
   - Reject → New vibecode iteration with feedback
9. In CommitMessageModal:
   - User can edit or refine message
   - Commit → Diff applied to git
10. After commit: Evaluator context cleared

## Page Refresh Recovery
```typescript
// Automatic recovery via Zustand persist:
// 1. localStorage hydrates synchronously
// 2. Modals re-open if they were open
// 3. Draft messages restored
// 4. Session validated with server
// 5. Stale state (>24h) cleared automatically
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
- Show trace_id in error messages for debugging

## Testing
- Playwright for E2E
- Component tests with React Testing Library
- Mock WebSocket for unit tests
- Validated test evidence after each phase