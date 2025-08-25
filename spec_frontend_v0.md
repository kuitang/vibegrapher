# Vibegrapher v0 Frontend Specification (Simplified)

## Overview
React TypeScript interface for vibecoding agents via natural language. No graph visualization in v0.

## Technology Stack
- React 18 + TypeScript
- Tailwind CSS + shadcn/ui
- Zustand + React Query
- Monaco Editor for diffs
- Socket.io for real-time

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

## Core Components (Signatures Only)

### VibecodePanel
```typescript
interface VibecodePanelProps {
  projectId: string;
}

// Manages sessions internally
// Start Session button (global or node-specific)
// Shows conversation history
// Input field for prompts
// Diff viewer when changes proposed
// Accept/Reject buttons
// Clear Session button
```

### CodeViewer
```typescript
interface CodeViewerProps {
  projectId: string;
  highlightNode?: string;
}

// Monaco editor in read-only mode
// Syntax highlighting for Python
// Refresh on WebSocket updates
```

### TestRunner
```typescript
interface TestRunnerProps {
  projectId: string;
}

// List test cases
// Add/edit/delete tests
// Run button with progress
// Results with pass/fail
// Shows trace_id in debug mode
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

// Side-by-side diff
// Accept/Reject controls
// Debug info with trace_id
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
// No hardcoded URLs
const API_BASE = process.env.REACT_APP_API_URL || '';

class ApiService {
  async startSession(projectId: string, nodeId?: string)
  async sendMessage(sessionId: string, prompt: string)
  async clearSession(sessionId: string)
  async getFullMessage(messageId: string)  // Get OpenAI response details
  async runTest(testId: string)
}
```

## WebSocket Integration

```typescript
class WebSocketService {
  connect(projectId: string) {
    // IMPORTANT: Log all messages for debugging
    this.socket.on('connect', () => console.log('[WS] Connected'));
    
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
    
    this.socket.on('error', (e) => console.error('[WS] Error:', e));
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
  apiUrl: process.env.REACT_APP_API_URL || '',
  wsUrl: process.env.REACT_APP_WS_URL || '',
};

// Never hardcode localhost
// Works on any domain
```

## Mobile Responsiveness
- Stack panels vertically on mobile
- Tabs to switch between Vibecode/Code/Tests
- Touch-friendly buttons
- Minimum 375px width support

## Error Handling
- Error boundaries on all major components
- Toast notifications for errors
- Retry mechanisms for failed requests
- Show trace_id in error messages for debugging

## Testing
- Playwright for E2E
- Component tests with React Testing Library
- Mock WebSocket for unit tests
- Validated test evidence after each phase