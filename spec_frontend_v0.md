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
┌────────────────────────────────────┐
│ Header (Project name, User)        │
├────────────────────────────────────┤
│                                    │
│  ┌─────────────┬─────────────┐    │
│  │             │              │    │
│  │  Vibecode   │  Code View   │    │
│  │  Panel      │  (Read-only) │    │
│  │             │              │    │
│  │  [Session]  │  Python code │    │
│  │  Messages   │  with nodes  │    │
│  │  Input      │              │    │
│  │             │              │    │
│  └─────────────┴─────────────┘    │
│                                    │
│  Test Results (Expandable)         │
└────────────────────────────────────┘
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

### TestRunner
```typescript
interface TestRunnerProps {
  projectId: string;
}

// shadcn components used:
// - Card: Test panel container
// - Table: Display test cases
// - Button: "Add Test", "Run", "Delete"
// - Dialog: Add/edit test modal
// - Progress: Test run progress
// - Alert: Test results (success/error)
// - Collapsible: Expandable test output
// - Badge: Pass/fail status
```

### DiffViewer
```typescript
interface DiffViewerProps {
  original: string;
  proposed: string;
  onAccept: () => void;
  onReject: () => void;
  traceId?: string;
}

// shadcn components used:
// - Card: Diff container
// - Tabs: Switch between unified/split view
// - Button: "Accept" (green), "Reject" (red)
// - AlertDialog: Confirm accept/reject
// - Tooltip: Show trace_id on hover
// Monaco Diff Editor for actual diff display
```

## State Management

```typescript
// Zustand store
interface AppState {
  project: Project | null;
  currentSession: {
    id: string;
    type: 'global' | 'node';
    nodeId?: string;
  } | null;
  messages: Message[];
  
  actions: {
    startSession: (projectId: string, nodeId?: string) => Promise<void>;
    sendMessage: (prompt: string) => Promise<void>;
    clearSession: () => Promise<void>;
    setProject: (p: Project) => void;
  }
}

// React Query hooks
useProject(id: string)
useMessages(sessionId: string)
useTestCases(projectId: string)
```

## API Service

```typescript
// No hardcoded URLs - Using Vite environment variables
const API_BASE = import.meta.env.VITE_API_URL || '';

class ApiService {
  async startSession(projectId: string, nodeId?: string)
  async sendMessage(sessionId: string, prompt: string)
  async clearSession(sessionId: string)
  async getFullMessage(messageId: string)  // Get OpenAI response details
  async runTest(testId: string)
}
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
    
    this.socket.on('vibecode_response', (data) => {
      console.log('[WS] Vibecode response:', data);
      console.log('[WS] Trace ID:', data.trace_id);
      // Update messages
      // Show diff if present
    });
    
    this.socket.on('test_completed', (data) => {
      console.log('[WS] Test completed:', data);
      console.log('[WS] Test trace:', data.trace_id);
      // Update test results
    });
    
    this.socket.on('error', (e) => console.error('[Socket.io] Error:', e));
  }
}
```

## Session Flow

1. User opens project → No session yet
2. User clicks "Start Session" (or "Start Node Session")
3. Frontend calls POST /projects/{id}/sessions
4. Store session ID in state
5. User sends messages via POST /sessions/{id}/messages
6. Messages appear in conversation
7. User can "Clear Session" to reset

## Configuration
```typescript
// src/config.ts
export const config = {
  apiUrl: import.meta.env.VITE_API_URL || '',
  wsUrl: import.meta.env.VITE_WS_URL || '',
};

// Environment-specific examples:
// Local dev: VITE_API_URL=http://localhost:8000
// Remote dev: VITE_API_URL=http://192.168.1.100:8000 (your server IP)
// Production: VITE_API_URL=https://your-api.fly.dev
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