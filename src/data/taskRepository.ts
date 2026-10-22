import type { Task, TaskInput, TaskPatch } from '../domain/task'

/**
 * Contrato de persistencia. La app solo depende de esta interfaz, lo que permite
 * usar Firestore en los ambientes reales y una implementación en memoria en las pruebas.
 */
export interface TaskRepository {
  subscribe(onChange: (tasks: Task[]) => void, onError: (error: Error) => void): () => void
  create(input: TaskInput): Promise<void>
  update(id: string, patch: TaskPatch): Promise<void>
  remove(id: string): Promise<void>
}
