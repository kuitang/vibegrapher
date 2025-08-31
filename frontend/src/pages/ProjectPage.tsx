import { useParams, Link } from 'react-router-dom'
import { useProject } from '@/hooks/useProjects'
import { ProjectLayout } from '@/components/layout/MainLayout'
import { MobileLayout } from '@/components/layout/MobileLayout'
import { VibecodePanel } from '@/components/vibecode/VibecodePanel'
import { CodePanel } from '@/components/CodePanel'
import { DiffReviewModal } from '@/components/DiffReviewModal'
import { CommitMessageModal } from '@/components/CommitMessageModal'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect } from 'react'
import useAppStore, { useAppActions } from '@/store/useAppStore'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useDiffRecovery } from '@/hooks/useDiffRecovery'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { DarkModeToggle } from '@/components/layout/MainLayout'

export function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const { data: project, isLoading, error } = useProject(id)
  const actions = useAppActions()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const { toast } = useToast()
  
  // Diff management state
  const currentReviewDiff = useAppStore((state) => state.currentReviewDiff)
  const showDiffReviewModal = useAppStore((state) => state.showDiffReviewModal)
  const showCommitMessageModal = useAppStore((state) => state.showCommitMessageModal)
  
  // Use diff recovery hook
  useDiffRecovery(id)

  // Clear project state when project ID changes
  useEffect(() => {
    const currentProject = useAppStore.getState().project
    if (id && currentProject && currentProject.id !== id) {
      console.log('[ProjectPage] Clearing project state, switching from', currentProject.id, 'to', id)
      actions.clearProjectState()
    }
  }, [id, actions])
  
  // Clear project state when component unmounts (browser back or < button)
  useEffect(() => {
    return () => {
      console.log('[ProjectPage] Component unmounting, clearing project state')
      actions.clearProjectState()
    }
  }, [actions])

  useEffect(() => {
    if (project) {
      actions.setProject(project)
    }
  }, [project, actions])
  
  // Handlers for diff modals
  const handleApproveDiff = async (diffId: string) => {
    try {
      await actions.approveDiff(diffId)
      toast({
        title: "Diff Approved",
        description: "Preparing commit message",
      })
    } catch (error) {
      toast({
        title: "Approval Failed",
        description: error instanceof Error ? error.message : "Failed to approve diff",
        variant: "destructive",
      })
    }
  }
  
  const handleRejectDiff = async (diffId: string, reason: string) => {
    try {
      await actions.rejectDiff(diffId, reason)
      toast({
        title: "Diff Rejected",
        description: "Your feedback will be used to generate an improved solution",
      })
    } catch (error) {
      toast({
        title: "Rejection Failed", 
        description: error instanceof Error ? error.message : "Failed to reject diff",
        variant: "destructive",
      })
    }
  }
  
  const handleCommit = async (diffId: string, message: string) => {
    const apiUrl = import.meta.env.VITE_API_URL
    const response = await fetch(`${apiUrl}/diffs/${diffId}/commit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        commit_message: message
      })
    })
    
    if (!response.ok) {
      throw new Error('Failed to commit diff')
    }
    
    // Refresh project code after successful commit
    if (id) {
      // Fetch the updated code from backend
      const projectResponse = await fetch(`${apiUrl}/projects/${id}`)
      if (projectResponse.ok) {
        const projectData = await projectResponse.json()
        if (projectData.current_code) {
          actions.updateCode(projectData.current_code, 'main.py')
          console.log('[ProjectPage] Code updated after commit')
        }
      }
      
      actions.setShowCommitMessageModal(false)
      actions.setCurrentReviewDiff(null)
    }
  }
  
  const handleRefineMessage = async (diffId: string, currentMessage: string): Promise<string> => {
    const apiUrl = import.meta.env.VITE_API_URL
    const response = await fetch(`${apiUrl}/diffs/${diffId}/refine-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        current_message: currentMessage
      })
    })
    
    if (!response.ok) {
      throw new Error('Failed to refine message')
    }
    
    const data = await response.json()
    return data.refined_message
  }

  if (isLoading) return <div className="p-4">Loading project...</div>
  if (error) return <div className="p-4 text-red-500">Error loading project</div>
  if (!project) return <div className="p-4">Project not found</div>

  const vibecodePanel = id ? <VibecodePanel projectId={id} /> : null
  const codePanel = id ? <CodePanel projectId={id} /> : <OldCodePanel />
  const testPanel = <TestPanel />

  if (isMobile) {
    return (
      <>
        <MobileLayout
          vibecodePanel={vibecodePanel}
          codePanel={codePanel}
          testPanel={testPanel}
          projectName={project.name}
        />
        
        {/* Diff Review Modals */}
        {currentReviewDiff && (
          <>
            <DiffReviewModal
              diff={currentReviewDiff}
              open={showDiffReviewModal}
              onClose={() => actions.setShowDiffReviewModal(false)}
              onApprove={handleApproveDiff}
              onReject={handleRejectDiff}
            />
            <CommitMessageModal
              diff={currentReviewDiff}
              open={showCommitMessageModal}
              onClose={() => actions.setShowCommitMessageModal(false)}
              onCommit={handleCommit}
              onRefine={handleRefineMessage}
            />
          </>
        )}
        
        <Toaster />
      </>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Custom header for project page */}
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/" className="text-xl text-muted-foreground hover:text-foreground transition-colors">
            &lt;
          </Link>
          <h1 className="text-xl font-semibold">{project.name}</h1>
        </div>
        <DarkModeToggle />
      </header>
      
      {/* Main project content */}
      <main className="flex-1 overflow-auto">
        <ProjectLayout
          vibecodePanel={vibecodePanel}
          codePanel={codePanel}
          testPanel={testPanel}
          projectName={project.name}
        />
      </main>
      
      {/* Diff Review Modals */}
      {currentReviewDiff && (
        <>
          <DiffReviewModal
            diff={currentReviewDiff}
            open={showDiffReviewModal}
            onClose={() => actions.setShowDiffReviewModal(false)}
            onApprove={handleApproveDiff}
            onReject={handleRejectDiff}
          />
          <CommitMessageModal
            diff={currentReviewDiff}
            open={showCommitMessageModal}
            onClose={() => actions.setShowCommitMessageModal(false)}
            onCommit={handleCommit}
            onRefine={handleRefineMessage}
          />
        </>
      )}
      
      <Toaster />
    </div>
  )
}

function OldCodePanel() {
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
    <div className="h-full flex flex-col border rounded-lg bg-card">
      <CardHeader className="flex-shrink-0 border-b">
        <CardTitle>Test Results</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground text-center">
          Test runner will be integrated with diff review in Phase 008
        </p>
      </CardContent>
    </div>
  )
}