# Vibegrapher v0 Data Model & API Specification (Simplified)

## Core Data Models

### Project
```typescript
interface Project {
  id: string;
  name: string;
  slug: string;                // UNIQUE slug generated from name (e.g., "My Project" -> "my-project")
  repository_path: string;    // Local git repository path (media/projects/{slug}/)
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
  openai_session_key: string;  // Format: `project_{project.slug}` or `project_{project.slug}_node_{node_id}`
  conversations_db_path: string; // Path to SQLiteSession file: media/projects/{project.slug}_conversations.db
  session_type: 'global' | 'node';
  node_id?: string;            // If node-specific session
  created_at: string;
  updated_at: string;
}
```

## Vibecoder Interactive Workflow (CRITICAL for Frontend E2E Testing)

The vibecoder maintains conversation context via SQLiteSession persistence. This workflow MUST be understood by frontend for UI and E2E test implementation.

### Iteration Loop (Max 3 attempts per message)
1. User sends prompt → VibeCoder attempts patch
2. Evaluator reviews → may approve or reject with feedback
3. If rejected, VibeCoder retries with evaluator feedback (up to 3x)

**CRITICAL: Frontend displays ALL AI interactions in real-time as they happen:**
- User message: "Add Spanish translation"
- Assistant (VibeCoder): "Generated patch: [brief summary]" + patch preview
- Assistant (Evaluator): "Rejected: Missing error handling" (iteration 1)
- Assistant (VibeCoder): "Updated patch with error handling" + patch preview
- Assistant (Evaluator): "Approved: Looks good" + suggested commit message
- Each message shows token usage badge (💵 245 tokens)

**IMPORTANT: Every AI response is immediately sent to frontend via Socket.io as soon as we receive it from OpenAI. ConversationMessage records are saved to database asynchronously in the background. No batching, no waiting - real-time streaming of ALL agent interactions.**

Socket.io delivers each message with enough content to display directly.
Future enhancement: Click message to expand full code/patch/reasoning details.

### After Max Iterations
- Backend returns: `{error: "Max iterations reached", final_feedback: "...", message: "..."}`
- User sees error and evaluator's final feedback
- User can send new message → VibeCoder continues with FULL context
- SQLiteSession preserves entire conversation history

### On Successful Patch
- Backend returns: `{diff_id: "...", status: "pending_human_review", commit_message: "..."}`
- DiffReviewModal opens automatically
- After commit: Evaluator context clears, VibeCoder keeps history

This enables iterative refinement without losing context across messages.

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
  created_at: string;
  last_response_id?: string;    // OpenAI response ID for audit trail
}
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


**Critical fields in ConversationMessage**:
- `openai_response?: any` - FULL OpenAI response (untyped JSON)
- `token_usage?: TokenUsage` - Extracted usage data  
- `diff_id?: string` - Reference to Diff record if changes proposed

## API Endpoints (v0 - Simplified)

### Projects
```
GET    /projects                  - List projects (also serves as health check)
POST   /projects                  - Create project (generates unique slug from name)
GET    /projects/:id              - Get project with code
DELETE /projects/:id              - Delete project
```

### Sessions & Vibecoding
```
POST   /projects/:id/sessions     - Start vibecode session (global or node)
GET    /projects/:id/sessions     - List active sessions for project
POST   /sessions/:id/messages     - Send message to session (triggers VibeCoder → Evaluator loop)
GET    /sessions/:id/messages     - Get conversation history
DELETE /sessions/:id              - Clear session
GET    /messages/:id/full         - Get full OpenAI response data (returns complete OpenAI response JSON)
```

### Diff Management & Human Review
```
GET    /projects/:id/diffs        - All diffs for project
GET    /sessions/:id/diffs        - All diffs for session
GET    /sessions/:id/diffs/pending - Pending review diffs
GET    /diffs/:id                 - Single diff details
GET    /diffs/:id/preview         - Preview applied diff
POST   /diffs/:id/review          - Human approve/reject with feedback
POST   /diffs/:id/commit          - Commit approved diff
POST   /diffs/:id/refine-message  - Get new commit message suggestion
```



## Key Response Fields
- `token_usage?: TokenUsage` - Real-time usage data
- `GET /messages/:id/full` returns untyped JSON with complete OpenAI response

### Socket.io Events
```typescript
// Server → Client Events
// Event: 'conversation_message' (each agent interaction)
{
  message_id: string;
  session_id: string;
  role: 'assistant';
  agent: 'vibecoder' | 'evaluator' | 'user';
  content: string;      // Brief summary for display
  patch_preview?: string;  // First 10 lines of patch if applicable
  iteration: number;
  token_usage: TokenUsage;
  created_at: string;
  // Future: full_details_url for expansion
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
- openai_session_key format: `project_{project.slug}` or `project_{project.slug}_node_{node_id}`
- Sessions persist conversation history automatically
- Uses project slug for filesystem-safe identifiers

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
  diff_content: string;     // Unified diff format (like git diff output)
  
  // Status tracking
  status: 'evaluator_approved' | 'human_rejected' | 'committed';
  
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