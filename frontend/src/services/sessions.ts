/**
 * Session Service - Phase 005
 * API service for session management
 */

import type { VibecodeSession, ConversationMessage, Diff } from '@/store/types'

const API_URL = import.meta.env.VITE_API_URL || ''

/**
 * Start a new session for a project
 */
export async function startSession(projectId: string): Promise<VibecodeSession> {
  const response = await fetch(`${API_URL}/projects/${projectId}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  
  if (!response.ok) {
    throw new Error(`Failed to start session: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Send a message to a session
 */
export async function sendMessage(sessionId: string, content: string): Promise<void> {
  const response = await fetch(`${API_URL}/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content })
  })
  
  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.statusText}`)
  }
}

/**
 * Clear a session
 */
export async function clearSession(sessionId: string): Promise<void> {
  const response = await fetch(`${API_URL}/sessions/${sessionId}`, {
    method: 'DELETE'
  })
  
  if (!response.ok) {
    throw new Error(`Failed to clear session: ${response.statusText}`)
  }
}

/**
 * Get all messages for a session
 */
export async function getSessionMessages(sessionId: string): Promise<ConversationMessage[]> {
  const response = await fetch(`${API_URL}/sessions/${sessionId}/messages`)
  
  if (!response.ok) {
    throw new Error(`Failed to get session messages: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Get pending diffs for a session
 */
export async function getPendingDiffs(sessionId: string): Promise<Diff[]> {
  const response = await fetch(`${API_URL}/sessions/${sessionId}/diffs/pending`)
  
  if (!response.ok) {
    throw new Error(`Failed to get pending diffs: ${response.statusText}`)
  }
  
  return response.json()
}