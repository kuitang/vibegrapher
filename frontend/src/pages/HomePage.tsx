import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useProjects, useCreateProject, useDeleteProject } from '@/hooks/useProjects'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function HomePage() {
  const { data: projects, isLoading, error } = useProjects()
  const createProject = useCreateProject()
  const deleteProject = useDeleteProject()
  const [newProjectName, setNewProjectName] = useState('')

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return
    try {
      await createProject.mutateAsync({ name: newProjectName })
      setNewProjectName('')
    } catch (err) {
      console.error('Failed to create project:', err)
    }
  }

  if (isLoading) return <div className="p-4">Loading projects...</div>
  if (error) return <div className="p-4 text-red-500">Error loading projects</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Projects</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create New Project</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name"
              className="flex-1 px-3 py-2 border rounded-md"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
            />
            <Button onClick={handleCreateProject}>Create</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {projects?.map((project) => (
          <Card key={project.id}>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>{project.name}</CardTitle>
                <div className="flex gap-2">
                  <Link to={`/project/${project.id}`}>
                    <Button>Open</Button>
                  </Link>
                  <Button
                    variant="destructive"
                    onClick={() => deleteProject.mutate(project.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Created: {new Date(project.created_at).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}