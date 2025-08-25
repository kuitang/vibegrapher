# Vibegrapher v0 Data Model & API Specification (Simplified)

## Core Data Models

### Project
```typescript
interface Project {
  id: string;
  name: string;
  repository_path: string;    // Local git repository path (media/projects/{id}/)
  current_code: string;        // Latest code from git HEAD
  current_commit: string;      // SHA of current HEAD commit
  current_branch: string;      // Active git branch
  created_at: string;
  updated_at: string;
}
```

### VibecodeSession
```typescript
interface VibecodeSession {
  id: string;
  project_id: string;
  openai_session_key: string;  // Format: `project_{id}` or `project_{id}_node_{node_id}`
  conversations_db_path: string; // Path to SQLiteSession file: media/projects/{project_id}_conversations.db
  session_type: 'global' | 'node';
  node_id?: string;            // If node-specific session
  created_at: string;
  updated_at: string;
}
```

### ConversationMessage
```typescript
interface ConversationMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;              // The displayed message text
  openai_response?: any;        // FULL OpenAI response (untyped JSON)
  token_usage?: TokenUsage;     // Extracted usage data
  diff_id?: string;            // Reference to Diff if changes proposed
  trace_id?: string;           // OpenAI trace for debugging
  created_at: string;
}
```

### TestCase (for Diff Testing Only)
```typescript
interface TestCase {
  id: string;
  project_id: string;
  name: string;
  test_code: string;           // Python code that tests the agent functionality
  quick_test: boolean;         // If true, runs with 5s timeout during review
  created_at: string;
  updated_at: string;
}
```

### TestRun (for Diff Testing Only)
```typescript
interface TestRun {
  id: string;
  diff_id: string;             // Which diff this test was run against
  test_case_id: string;
  status: 'passed' | 'failed' | 'error' | 'timeout';
  output?: string;             // stdout/stderr from test execution
  error?: string;              // Error message if failed
  execution_time_ms: number;
  trace_id?: string;           // OpenAI trace if test involved API calls
  created_at: string;
}
// Note: TestRuns are aggregated and cached in Diff.test_results as JSON
```

### TokenUsage
```typescript
interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  model: string;
  agent?: string;               // 'vibecoder' | 'evaluator' 
  iteration?: number;           // Agent iteration number
}
```

### TestResult (Frontend Display Type)
```typescript
interface TestResult {
  test_id: string;
  test_name: string;
  status: 'passed' | 'failed' | 'error' | 'timeout' | 'running';
  output?: string;
  error?: string;
  execution_time_ms?: number;
  trace_id?: string;
}
// Note: This is derived from TestRun records for frontend display
```

**Critical fields in ConversationMessage**:
- `openai_response?: any` - FULL OpenAI response (untyped JSON)
- `token_usage?: TokenUsage` - Extracted usage data  
- `diff_id?: string` - Reference to Diff record if changes proposed

## API Endpoints (v0 - Simplified)

### Projects
```
POST   /projects                 - Create new project
GET    /projects/:id             - Get project with current code
DELETE /projects/:id             - Delete project
```

### Sessions & Vibecoding
```
POST   /projects/:id/sessions    - Start new vibecode session (global or node-specific)
GET    /projects/:id/sessions    - List active sessions for project
POST   /sessions/:id/messages    - Send message to existing session (triggers VibeCoder → Evaluator loop)
GET    /sessions/:id/messages    - Get conversation history
DELETE /sessions/:id             - Clear/reset session
GET    /messages/:id/full        - Get full OpenAI response data (returns complete OpenAI response JSON)
```

### Diff Management & Human Review
```
GET    /projects/:id/diffs        - All diffs for project
GET    /sessions/:id/diffs        - All diffs for session
GET    /sessions/:id/diffs/pending - Pending review diffs
GET    /diffs/:id                 - Single diff details
GET    /diffs/:id/preview         - Preview applied diff
POST   /diffs/:id/review          - Human approve/reject with feedback
POST   /diffs/:id/test            - Run tests on uncommitted diff
POST   /diffs/:id/commit          - Commit approved diff
POST   /diffs/:id/refine-message  - Get new commit message suggestion
```

### Test Management (Minimal - Only for Diff Testing)
```
POST   /projects/:id/tests        - Create test case for diff validation
GET    /projects/:id/tests        - List available tests
GET    /projects/:id/tests/quick  - Get quick tests (5s timeout) for review
```


## Key Response Fields
- `trace_id?: string` - OpenAI trace for debugging  
- `token_usage?: TokenUsage` - Real-time usage data
- `GET /messages/:id/full` returns untyped JSON with complete OpenAI response

### Socket.io Events
```typescript
// Server → Client Events
// Event: 'vibecode_response'
{
  session_id: string;
  message_id: string;
  diff?: string;
  trace_id?: string;    // OpenAI trace for debugging
  token_usage?: TokenUsage;  // Real-time usage data
}

// Event: 'code_changed'
{
  project_id: string;
  new_code: string;
}

// Event: 'test_completed' (for diff testing)
{
  diff_id: string;
  test_name: string;
  status: 'passed' | 'failed' | 'error';
  output?: string;
  trace_id?: string;
}


// Client → Server Events
// Event: 'subscribe'
{
  project_id: string;
}

// Event: 'token_usage' - Real-time usage tracking
{
  session_id: string;
  message_id?: string;
  usage: TokenUsage;
  timestamp: string;    // ISO timestamp
}

// Event: 'heartbeat' - Keepalive for debug logging (every 30s)
{
  server_time: string;  // ISO timestamp
  project_id?: string;
  status: 'alive';
  connections: number;  // Number of active connections
}

// Event: 'disconnect'
// (handled automatically by Socket.io)
```

## OpenAI Agents SDK Integration

### Session Management
- Each project has one global SQLiteSession
- Each node can have its own SQLiteSession
- Session key format: `project_{id}` or `project_{id}_node_{node_id}`
- Sessions persist conversation history automatically

### Agent Handoffs
- Vibecoder → SyntaxFixer (on syntax error)
- Vibecoder → Evaluator (on valid code)
- Evaluator can reject back to Vibecoder

### Stored OpenAI Data
The `openai_response` field stores everything:
- Final output text
- Tool calls made
- Token usage
- Model used
- Reasoning traces
- Any future fields OpenAI adds

### Diff Model (NEW)
```typescript
interface Diff {
  id: string;
  session_id: string;
  project_id: string;
  
  // Git tracking
  base_commit: string;      // SHA this diff applies to
  target_branch: string;    // Branch to apply to
  diff_content: string;     // The actual diff
  
  // Status tracking
  status: 'evaluator_approved' | 'human_reviewing' | 'human_rejected' | 'committed';
  
  // Test execution tracking (for human review)
  test_results?: string;    // JSON string of test results
  tests_run_at?: string;    // ISO timestamp of last test run
  
  // Metadata
  vibecoder_prompt: string;
  evaluator_reasoning: string;
  commit_message: string;
  human_feedback?: string;  // If rejected by human
  committed_sha?: string;   // If committed, resulting SHA
  
  created_at: string;
  updated_at: string;
}
```


## Database Schema Notes
Standard SQLAlchemy models. **Key columns**:
- `openai_response = Column(JSON)` - Stores complete OpenAI response
- `token_usage = Column(JSON, nullable=True)` - TokenUsage as JSON
- `openai_session_key = Column(String, unique=True)` - SQLiteSession mapping
- `diff_id = Column(String, ForeignKey('diffs.id'))` - Link to Diff record