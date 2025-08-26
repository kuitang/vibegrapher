import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Project } from '@/store/types'

const API_URL = import.meta.env.VITE_API_URL || ''

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/projects`)
      if (!response.ok) {
        throw new Error('Failed to fetch projects')
      }
      return response.json()
    }
  })
}

export function useProject(id: string | undefined) {
  return useQuery<Project>({
    queryKey: ['project', id],
    queryFn: async () => {
      if (!id) throw new Error('No project ID provided')
      const response = await fetch(`${API_URL}/projects/${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch project')
      }
      return response.json()
    },
    enabled: !!id
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  
  return useMutation<Project, Error, { name: string }>({
    mutationFn: async ({ name }) => {
      const response = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      })
      if (!response.ok) {
        throw new Error('Failed to create project')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    }
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const response = await fetch(`${API_URL}/projects/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        throw new Error('Failed to delete project')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    }
  })
}