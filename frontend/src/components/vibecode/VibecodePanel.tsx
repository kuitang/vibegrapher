/**
 * Vibecode Panel Component - Phase 005
 * Main panel for session management and messaging
 */

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { useSession } from '@/hooks/useSession'
import useAppStore from '@/store/useAppStore'
import type { ConnectionState, ConversationMessageEvent } from '@/services/socketio'
import type { ConversationMessage } from '@/store/types'

interface VibecodePanelProps {
  projectId: string
  connectionState: ConnectionState
  socketMessages: ConversationMessageEvent[]
}

export function VibecodePanel({ projectId, connectionState, socketMessages }: VibecodePanelProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { 
    session, 
    messages, 
    start, 
    send, 
    clear, 
    isStarting, 
    isSending, 
    isClearing 
  } = useSession(projectId)
  
  const project = useAppStore((state) => state.project)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [message])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim() && !isSending) {
      send(message.trim())
      setMessage('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  // Combine socket messages with stored messages
  // Socket messages are real-time updates, stored messages are for persistence
  const allMessages = [...(messages || []), ...socketMessages].sort((a, b) => {
    const timestampA = 'timestamp' in a ? new Date(a.timestamp).getTime() : new Date(a.created_at).getTime()
    const timestampB = 'timestamp' in b ? new Date(b.timestamp).getTime() : new Date(b.created_at).getTime()
    return timestampA - timestampB
  })

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Vibecode Panel</CardTitle>
        <ConnectionStatus state={connectionState} />
      </CardHeader>
      <CardContent className="flex flex-col h-full">
        <div className="text-muted-foreground mb-4">
          <p>Project: {project?.name || 'Loading...'}</p>
          {session && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">active</Badge>
              <span className="text-xs">Session: {session.id.slice(0, 8)}...</span>
            </div>
          )}
        </div>

        {/* Session Controls */}
        <div className="flex gap-2 mb-4">
          {!session ? (
            <Button 
              onClick={start} 
              disabled={isStarting || !projectId}
              size="sm"
            >
              {isStarting ? 'Starting...' : 'Start Session'}
            </Button>
          ) : (
            <Button 
              variant="outline" 
              onClick={clear} 
              disabled={isClearing}
              size="sm"
            >
              {isClearing ? 'Clearing...' : 'Clear Session'}
            </Button>
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 mb-4">
          {allMessages.length > 0 ? (
            <ScrollArea className="h-[300px] border rounded p-2">
              <div className="space-y-3">
                {allMessages.map((msg, idx) => (
                  <MessageItem key={idx} message={msg} />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="h-[300px] border rounded p-4 flex items-center justify-center text-muted-foreground">
              {session 
                ? 'Start by sending a message to the VibeCoder agent' 
                : 'Start a session to begin chatting with the VibeCoder agent'}
            </div>
          )}
        </div>

        {/* Message Input */}
        {session && (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your message (Press Enter to send, Shift+Enter for new line)"
              className="min-h-[40px] max-h-[120px] resize-none"
              disabled={isSending}
            />
            <Button 
              type="submit" 
              disabled={!message.trim() || isSending}
              size="sm"
            >
              {isSending ? 'Sending...' : 'Send'}
            </Button>
          </form>
        )}
      </CardContent>
    </>
  )
}

interface MessageItemProps {
  message: ConversationMessageEvent | ConversationMessage
}

function MessageItem({ message }: MessageItemProps) {
  // Check if it's a socket message (ConversationMessageEvent) or stored message (ConversationMessage)
  const isSocketMessage = 'agent_type' in message
  const isUser = isSocketMessage ? false : message.role === 'user'
  const agentType = isSocketMessage ? message.agent_type : null
  const content = isSocketMessage ? 
    (typeof message.content === 'string' ? message.content : JSON.stringify(message.content)) : 
    message.content
  const timestamp = isSocketMessage ? message.timestamp : message.created_at
  const tokenUsage = isSocketMessage && typeof message.content === 'object' ? 
    message.content.token_usage : 
    message.token_usage

  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-xs">
            {agentType === 'vibecoder' ? '🤖' : agentType === 'evaluator' ? '✅' : '💬'}
          </AvatarFallback>
        </Avatar>
      )}
      <div className={`max-w-[80%] rounded-lg p-2 ${
        isUser 
          ? 'bg-primary text-primary-foreground' 
          : 'bg-muted border'
      }`}>
        <div className="text-xs whitespace-pre-wrap">{content}</div>
        <div className="flex justify-between items-center mt-1 text-xs text-muted-foreground">
          <span>
            {isSocketMessage ? (
              `${agentType === 'vibecoder' ? 'VibeCoder' : 'Evaluator'} • Iteration ${message.iteration + 1}`
            ) : isUser ? (
              'You'
            ) : (
              'Assistant'
            )}
          </span>
          <span>{new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        {tokenUsage && (
          <div className="text-xs text-blue-500 mt-1">
            💵 Tokens: {tokenUsage.total_tokens}
          </div>
        )}
      </div>
      {isUser && (
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-xs">👤</AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}