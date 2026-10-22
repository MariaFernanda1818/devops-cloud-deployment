import type { Task, TaskInput, TaskPatch } from '../domain/task'
import { normalizeTaskInput } from '../domain/task'
import type { TaskRepository } from './taskRepository'

type Listener = (tasks: Task[]) => void

export class InMemoryTaskRepository implements TaskRepository {
  private tasks: Task[]
  private listeners = new Set<Listener>()
  private nextId = 1
  private readonly now: () => Date

  constructor(seed: Task[] = [], now: () => Date = () => new Date()) {
    this.tasks = seed.map((t) => ({ ...t }))
    this.now = now
  }

  subscribe(onChange: Listener, _onError?: (error: Error) => void): () => void {
    this.listeners.add(onChange)
    onChange(this.snapshot())
    return () => {
      this.listeners.delete(onChange)
    }
  }

  async create(input: TaskInput): Promise<void> {
    const now = this.now()
    this.tasks.push({
      ...normalizeTaskInput(input),
      id: `task-${this.nextId++}`,
      completed: false,
      createdAt: now,
      updatedAt: now,
    })
    this.emit()
  }

  async update(id: string, patch: TaskPatch): Promise<void> {
    const task = this.find(id)
    Object.assign(task, patch, { updatedAt: this.now() })
    this.emit()
  }

  async remove(id: string): Promise<void> {
    this.find(id)
    this.tasks = this.tasks.filter((t) => t.id !== id)
    this.emit()
  }

  private find(id: string): Task {
    const task = this.tasks.find((t) => t.id === id)
    if (!task) throw new Error(`La tarea ${id} no existe.`)
    return task
  }

  private snapshot(): Task[] {
    return this.tasks.map((t) => ({ ...t }))
  }

  private emit(): void {
    const snapshot = this.snapshot()
    this.listeners.forEach((listener) => listener(snapshot))
  }
}
