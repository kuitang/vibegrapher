import { useParams } from 'react-router-dom'
import { useProject } from '@/hooks/useProjects'
import { ProjectLayout } from '@/components/layout/MainLayout'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect } from 'react'
import useAppStore, { useAppActions } from '@/store/useAppStore'

export function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const { data: project, isLoading, error } = useProject(id)
  const actions = useAppActions()

  useEffect(() => {
    if (project) {
      actions.setProject(project)
    }
  }, [project, actions])

  if (isLoading) return <div className="p-4">Loading project...</div>
  if (error) return <div className="p-4 text-red-500">Error loading project</div>
  if (!project) return <div className="p-4">Project not found</div>

  return (
    <ProjectLayout
      vibecodePanel={<VibecodePanel />}
      codePanel={<CodePanel />}
      testPanel={<TestPanel />}
    />
  )
}

function VibecodePanel() {
  const project = useAppStore((state) => state.project)

  return (
    <>
      <CardHeader>
        <CardTitle>Vibecode Panel</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Project: {project?.name || 'Loading...'}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Session management will be implemented in Phase 005
        </p>
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