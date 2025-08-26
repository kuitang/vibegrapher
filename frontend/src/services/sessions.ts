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
  console.log('[SessionService] Starting session for project:', projectId)
  
  const response = await fetch(`${API_URL}/projects/${projectId}/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  
  console.log('[SessionService] Start session response:', response.status, response.statusText)
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('[SessionService] Failed to start session:', response.status, errorText)
    throw new Error(`Failed to start session: ${response.status} ${response.statusText} - ${errorText}`)
  }
  
  const data = await response.json()
  console.log('[SessionService] Start session response data:', data)
  return data
}

/**
 * Send a message to a session
 */
export async function sendMessage(sessionId: string, content: string): Promise<void> {
  console.log('[SessionService] Sending message to session:', sessionId, 'Content:', content)
  
  const response = await fetch(`${API_URL}/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt: content }) // Changed from 'content' to 'prompt' to match backend expectation
  })
  
  console.log('[SessionService] Send message response:', response.status, response.statusText)
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('[SessionService] Failed to send message:', response.status, errorText)
    throw new Error(`Failed to send message: ${response.status} ${response.statusText} - ${errorText}`)
  }
  
  console.log('[SessionService] Message sent successfully')
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
  // TODO: Implement this endpoint in backend Phase 007
  // For now, return empty array as this endpoint doesn't exist yet
  console.warn(`Pending diffs endpoint not implemented yet for session ${sessionId}`)
  return []
  /*
  const response = await fetch(`${API_URL}/sessions/${sessionId}/diffs/pending`)
  
  if (!response.ok) {
    throw new Error(`Failed to get pending diffs: ${response.statusText}`)
  }
  
  return response.json()
  */
}