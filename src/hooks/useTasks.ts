import { useCallback, useEffect, useState } from 'react'
import type { TaskRepository } from '../data/taskRepository'
import type { Task, TaskInput, TaskPatch } from '../domain/task'

export interface UseTasksResult {
  tasks: Task[]
  loading: boolean
  error: string | null
  clearError: () => void
  createTask: (input: TaskInput) => Promise<boolean>
  updateTask: (id: string, patch: TaskPatch) => Promise<boolean>
  removeTask: (id: string) => Promise<boolean>
}

function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return `No se pudo completar la operación: ${message}`
}

export function useTasks(repository: TaskRepository): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return repository.subscribe(
      (next) => {
        setTasks(next)
        setLoading(false)
      },
      (err) => {
        setError(describe(err))
        setLoading(false)
      },
    )
  }, [repository])

  const run = useCallback(async (operation: () => Promise<void>) => {
    try {
      await operation()
      return true
    } catch (err) {
      setError(describe(err))
      return false
    }
  }, [])

  return {
    tasks,
    loading,
    error,
    clearError: useCallback(() => setError(null), []),
    createTask: useCallback((input) => run(() => repository.create(input)), [repository, run]),
    updateTask: useCallback((id, patch) => run(() => repository.update(id, patch)), [repository, run]),
    removeTask: useCallback((id) => run(() => repository.remove(id)), [repository, run]),
  }
}
