import { useParams } from 'react-router-dom'
import { useProject } from '@/hooks/useProjects'
import { ProjectLayout } from '@/components/layout/MainLayout'
import { MobileLayout } from '@/components/layout/MobileLayout'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import useAppStore, { useAppActions } from '@/store/useAppStore'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useSocketIO } from '@/hooks/useSocketIO'
import { ConnectionStatus } from '@/components/ConnectionStatus'
import type { ConversationMessageEvent, DiffCreatedEvent, DebugIterationEvent, ConnectionState } from '@/services/socketio'

export function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const { data: project, isLoading, error } = useProject(id)
  const actions = useAppActions()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [messages, setMessages] = useState<ConversationMessageEvent[]>([])
  
  // Socket.io connection
  const { connectionState, isConnected } = useSocketIO(id, {
    onConversationMessage: (message: ConversationMessageEvent) => {
      console.log('[ProjectPage] Received conversation message:', message)
      setMessages(prev => [...prev, message])
    },
    onDiffCreated: (diff: DiffCreatedEvent) => {
      console.log('[ProjectPage] Diff created:', diff)
    },
    onDebugIteration: (debug: DebugIterationEvent) => {
      console.log('[ProjectPage] Debug iteration:', debug)
    },
    onError: (error) => {
      console.error('[ProjectPage] Socket.io error:', error)
    }
  })

  useEffect(() => {
    if (project) {
      actions.setProject(project)
    }
  }, [project, actions])

  if (isLoading) return <div className="p-4">Loading project...</div>
  if (error) return <div className="p-4 text-red-500">Error loading project</div>
  if (!project) return <div className="p-4">Project not found</div>

  const vibecodePanel = <VibecodePanel connectionState={connectionState} messages={messages} />
  const codePanel = <CodePanel />
  const testPanel = <TestPanel />

  if (isMobile) {
    return (
      <MobileLayout
        vibecodePanel={vibecodePanel}
        codePanel={codePanel}
        testPanel={testPanel}
        projectName={project.name}
      />
    )
  }

  return (
    <ProjectLayout
      vibecodePanel={vibecodePanel}
      codePanel={codePanel}
      testPanel={testPanel}
    />
  )
}

interface VibecodePanelProps {
  connectionState: ConnectionState
  messages: ConversationMessageEvent[]
}

function VibecodePanel({ connectionState, messages }: VibecodePanelProps) {
  const project = useAppStore((state) => state.project)

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Vibecode Panel</CardTitle>
        <ConnectionStatus state={connectionState} />
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4">
          Project: {project?.name || 'Loading...'}
        </p>
        
        {/* Display conversation messages */}
        {messages.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Messages ({messages.length})</h4>
            <div className="max-h-[300px] overflow-y-auto space-y-2 border rounded p-2">
              {messages.map((msg, idx) => (
                <div key={idx} className="text-xs space-y-1 border-b pb-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-primary">
                      {msg.agent_type === 'vibecoder' ? '🤖 VibeCoder' : '✅ Evaluator'}
                    </span>
                    <span className="text-muted-foreground">
                      Iteration {msg.iteration + 1}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    Session: {msg.session_id}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                  {typeof msg.content === 'object' && msg.content.token_usage && (
                    <div className="text-xs text-blue-500">
                      💵 Tokens: {msg.content.token_usage.total_tokens}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground mt-2">
            No messages yet. Session management will be implemented in Phase 005
          </p>
        )}
      </CardContent>
    </>
  )
}

function CodePanel() {
  const project = useAppStore((state) => state.project)

  return (
    <>
      <CardHeader>
        <CardTitle>Code Viewer</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Branch: {project?.current_branch || 'main'}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Code viewer will be implemented in Phase 006
        </p>
      </CardContent>
    </>
  )
}

function TestPanel() {
  return (
    <>
      <CardHeader>
        <CardTitle>Test Results</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Test runner will be integrated with diff review in Phase 008
        </p>
      </CardContent>
    </>
  )
}