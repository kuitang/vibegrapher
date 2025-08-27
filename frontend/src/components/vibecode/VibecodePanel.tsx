/**
 * VibecodePanel Component - Phase 005: Session Management
 * Main chat interface for vibecode sessions with full message flow
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import { Loader2, Send, RefreshCw, Bot, User, CheckCircle } from 'lucide-react'
import { useSocketIO } from '@/hooks/useSocketIO'
import { useSessionStore } from '@/store/sessionStore'
import useAppStore from '@/store/useAppStore'
import type { ConversationMessageEvent } from '@/services/socketio'

interface VibecodePanelProps {
  projectId: string
}

export function VibecodePanel({ projectId }: VibecodePanelProps) {
  const project = useAppStore((state) => state.project)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [textareaHeight, setTextareaHeight] = useState(56) // Default height
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Session store
  const { 
    session, 
    messages, 
    createSession, 
    addMessage, 
    clearSession,
    sendMessage,
    restoreSession 
  } = useSessionStore()

  // Memoize conversation message callback
  const handleConversationMessage = useCallback((message: ConversationMessageEvent) => {
    console.log('[VibecodePanel] Received streaming message:', message)
    addMessage({
      id: message.message_id,
      role: message.role,
      content: message.content || '',
      // New streaming fields
      message_type: message.message_type,
      stream_event_type: message.stream_event_type,
      stream_sequence: message.stream_sequence,
      event_data: message.event_data,
      tool_calls: message.tool_calls,
      tool_outputs: message.tool_outputs,
      handoffs: message.handoffs,
      // Token usage (typed)
      usage_input_tokens: message.usage_input_tokens,
      usage_output_tokens: message.usage_output_tokens,
      usage_total_tokens: message.usage_total_tokens,
      usage_cached_tokens: message.usage_cached_tokens,
      usage_reasoning_tokens: message.usage_reasoning_tokens,
      // Legacy fields
      agent_type: message.agent || 'unknown',
      iteration: message.iteration,
      session_id: message.session_id,
      timestamp: message.created_at,
      token_usage: message.token_usage
    })
    
    // Auto-scroll to bottom
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight
      }
    }
  }, [addMessage])

  // Socket.io connection
  const { connectionState, isConnected } = useSocketIO(projectId, {
    onConversationMessage: handleConversationMessage
  })

  // Restore session on mount and auto-create if needed
  useEffect(() => {
    if (projectId) {
      restoreSession(projectId)
    }
  }, [projectId, restoreSession])
  
  // Auto-create session when connected if no session exists
  useEffect(() => {
    const autoCreateSession = async () => {
      if (isConnected && !session && !isLoading && projectId) {
        console.log('[VibecodePanel] Auto-creating session for project:', projectId)
        setIsLoading(true)
        try {
          await createSession(projectId)
          console.log('[VibecodePanel] Session auto-created')
        } catch (error) {
          console.error('[VibecodePanel] Failed to auto-create session:', error)
        } finally {
          setIsLoading(false)
        }
      }
    }
    
    // Small delay to ensure connection is stable
    const timer = setTimeout(autoCreateSession, 500)
    return () => clearTimeout(timer)
  }, [isConnected, session, projectId, createSession, isLoading])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const newHeight = Math.min(200, Math.max(56, textareaRef.current.scrollHeight))
      setTextareaHeight(newHeight)
      textareaRef.current.style.height = `${newHeight}px`
    }
  }, [input])

  const handleSendMessage = async () => {
    if (!input.trim() || !session || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)

    // Add user message immediately
    addMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    })

    try {
      await sendMessage(session.id, userMessage)
      console.log('[VibecodePanel] Message sent')
    } catch (error) {
      console.error('[VibecodePanel] Failed to send message:', error)
      // Add error message
      addMessage({
        id: `error-${Date.now()}`,
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`,
        timestamp: new Date().toISOString()
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleClearSession = () => {
    clearSession()
    setInput('')
  }

  const getAvatarIcon = (role: string, agent_type?: string) => {
    if (role === 'user') return <User className="h-4 w-4" />
    if (agent_type === 'evaluator') return <CheckCircle className="h-4 w-4" />
    return <Bot className="h-4 w-4" />
  }

  const getAvatarColor = (role: string, agent_type?: string) => {
    if (role === 'user') return 'bg-blue-500'
    if (agent_type === 'evaluator') return 'bg-green-500'
    return 'bg-purple-500'
  }

  return (
    <div className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 border-b">
        <div className="flex items-center justify-between">
          <CardTitle>Vibecode Panel</CardTitle>
          <div className="flex items-center gap-2">
            <ConnectionStatus state={connectionState} />
            {session && (
              <Badge variant="outline" className="text-xs">
                Session Active
              </Badge>
            )}
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          Project: {project?.name || 'Loading...'}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col overflow-hidden">
        {/* Session auto-creates when connected */}
        {!session ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isConnected ? 'Initializing session...' : 'Connecting...'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Messages area */}
            <ScrollArea 
              ref={scrollAreaRef}
              className="flex-1 pr-4 mb-4"
            >
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No messages yet. Start a conversation!
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className="flex gap-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className={getAvatarColor(msg.role, msg.agent_type)}>
                          {getAvatarIcon(msg.role, msg.agent_type)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {msg.role === 'user' ? 'You' : 
                             msg.agent_type === 'vibecoder' ? 'VibeCoder' :
                             msg.agent_type === 'evaluator' ? 'Evaluator' : 'System'}
                          </span>
                          {msg.iteration !== undefined && (
                            <Badge variant="secondary" className="text-xs">
                              Iteration {msg.iteration + 1}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-sm text-foreground/90">
                          {typeof msg.content === 'string' ? msg.content : 
                           msg.content && typeof msg.content === 'object' ? JSON.stringify(msg.content) :
                           msg.content || ''}
                        </div>
                        {msg.token_usage && (
                          <div className="text-xs text-blue-500">
                            💵 Tokens: {
                              typeof msg.token_usage === 'object' && msg.token_usage.total_tokens 
                                ? msg.token_usage.total_tokens
                                : typeof msg.token_usage === 'number' 
                                ? msg.token_usage
                                : 'N/A'
                            }
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Input area */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                  disabled={isLoading}
                  className="resize-none"
                  style={{ height: `${textareaHeight}px`, minHeight: '56px' }}
                />
                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={handleSendMessage}
                    disabled={!input.trim() || isLoading}
                    size="icon"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                  <Button 
                    onClick={handleClearSession}
                    variant="outline"
                    size="icon"
                    title="Clear session"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </div>
  )
}