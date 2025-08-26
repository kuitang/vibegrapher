import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProjects, useCreateProject, useDeleteProject } from '@/hooks/useProjects'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, ExternalLink, Trash2 } from 'lucide-react'
import { useMediaQuery } from '@/hooks/useMediaQuery'

export function HomePage() {
  const { data: projects, isLoading, error } = useProjects()
  const createProject = useCreateProject()
  const deleteProject = useDeleteProject()
  const navigate = useNavigate()
  const [newProjectName, setNewProjectName] = useState('')
  const isMobile = useMediaQuery('(max-width: 768px)')

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return
    try {
      const newProject = await createProject.mutateAsync({ name: newProjectName })
      setNewProjectName('')
      // Automatically navigate to the newly created project
      navigate(`/project/${newProject.id}`)
    } catch (err) {
      console.error('Failed to create project:', err)
    }
  }

  if (isLoading) return <div className="p-4">Loading projects...</div>
  if (error) return <div className="p-4 text-red-500">Error loading projects</div>

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">Projects</h1>
      
      <Card className="mb-4 md:mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg md:text-xl">Create New Project</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name"
              className="flex-1 min-w-0 px-3 py-2 border rounded-md text-sm md:text-base"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
            />
            <Button onClick={handleCreateProject} size={isMobile ? "icon" : "default"}>
              {isMobile ? <Plus className="h-4 w-4" /> : 'Create'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:gap-4">
        {projects?.map((project) => (
          <Card key={project.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start gap-2">
                <CardTitle className="text-base md:text-lg truncate flex-1 min-w-0">
                  {project.name}
                </CardTitle>
                <div className="flex gap-1 md:gap-2 flex-shrink-0">
                  <Link to={`/project/${project.id}`}>
                    <Button size={isMobile ? "icon" : "default"} variant="outline">
                      {isMobile ? <ExternalLink className="h-4 w-4" /> : 'Open'}
                    </Button>
                  </Link>
                  <Button
                    variant="destructive"
                    size={isMobile ? "icon" : "default"}
                    onClick={() => deleteProject.mutate(project.id)}
                  >
                    {isMobile ? <Trash2 className="h-4 w-4" /> : 'Delete'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs md:text-sm text-muted-foreground truncate">
                Created: {new Date(project.created_at).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}