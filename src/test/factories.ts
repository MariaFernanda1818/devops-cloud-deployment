import type { Task } from '../domain/task'

let counter = 0

export function makeTask(overrides: Partial<Task> = {}): Task {
  counter += 1
  const createdAt = overrides.createdAt ?? new Date(2026, 0, counter)
  return {
    id: `seed-${counter}`,
    title: `Tarea ${counter}`,
    description: '',
    priority: 'medium',
    dueDate: null,
    completed: false,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  }
}
