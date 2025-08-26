export interface Project {
  id: string
  name: string
  slug: string
  repository_path: string
  current_code: string
  current_commit: string
  current_branch: string
  created_at: string
  updated_at: string
}

export interface VibecodeSession {
  id: string
  project_id: string
  openai_session_key: string
  conversations_db_path: string
  session_type: 'global' | 'node'
  node_id?: string
  created_at: string
  updated_at: string
}

export interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  model: string
  agent?: string
  iteration?: number
}

export interface ConversationMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  openai_response?: any
  token_usage?: TokenUsage
  diff_id?: string
  created_at: string
  last_response_id?: string
}

export interface Diff {
  id: string
  session_id: string
  project_id: string
  base_commit: string
  target_branch: string
  diff_content: string
  status: 'evaluator_approved' | 'human_rejected' | 'committed'
  test_results?: string
  tests_run_at?: string
  vibecoder_prompt: string
  evaluator_reasoning: string
  commit_message: string
  human_feedback?: string
  committed_sha?: string
  created_at: string
  updated_at: string
}