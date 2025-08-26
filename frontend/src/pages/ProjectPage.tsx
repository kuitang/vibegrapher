import { useParams } from 'react-router-dom'
import { useProject } from '@/hooks/useProjects'
import { ProjectLayout } from '@/components/layout/MainLayout'
import { MobileLayout } from '@/components/layout/MobileLayout'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import useAppStore, { useAppActions } from '@/store/useAppStore'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useSocketIO } from '@/hooks/useSocketIO'
import { VibecodePanel } from '@/components/vibecode/VibecodePanel'
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

  const vibecodePanel = <VibecodePanel projectId={id!} connectionState={connectionState} socketMessages={messages} />
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