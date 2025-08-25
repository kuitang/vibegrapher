# Vibegrapher v0 Data Model & API Specification (Simplified)

## Core Data Models

### Key Models
Standard models (Project, VibecodeSession, TestCase, TestRun) follow obvious patterns.  

**Critical field**: `openai_session_key` format: `project_{id}` or `project_{id}_node_{node_id}`

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
- `diff?: string` - If changes proposed

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

### Testing
```
POST   /projects/:id/tests       - Create test case
GET    /projects/:id/tests       - List test cases
POST   /tests/:id/run           - Run single test
DELETE /tests/:id               - Delete test
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

// Event: 'test_completed'
{
  test_id: string;
  status: string;
  output?: string;
  trace_id?: string;  // OpenAI trace for test run
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

## Database Schema Notes
Standard SQLAlchemy models. **Key columns**:
- `openai_response = Column(JSON)` - Stores complete OpenAI response
- `token_usage = Column(JSON, nullable=True)` - TokenUsage as JSON
- `openai_session_key = Column(String, unique=True)` - SQLiteSession mapping