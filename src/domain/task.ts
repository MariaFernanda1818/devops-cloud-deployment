export type Priority = 'low' | 'medium' | 'high'

export const PRIORITIES: readonly Priority[] = ['high', 'medium', 'low']

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
}

export const TITLE_MAX_LENGTH = 120
export const DESCRIPTION_MAX_LENGTH = 500

export interface Task {
  id: string
  title: string
  description: string
  priority: Priority
  /** Fecha límite en formato ISO `YYYY-MM-DD`, o `null` si no tiene. */
  dueDate: string | null
  completed: boolean
  createdAt: Date
  updatedAt: Date
  /** `true` mientras el servidor aún no confirma el último cambio local. */
  pendingSync?: boolean
}

export interface TaskInput {
  title: string
  description: string
  priority: Priority
  dueDate: string | null
}

export type TaskPatch = Partial<TaskInput & { completed: boolean }>

export type TaskInputErrors = Partial<Record<keyof TaskInput, string>>

export type StatusFilter = 'all' | 'active' | 'completed'
export type PriorityFilter = 'all' | Priority
export type SortKey = 'createdAt' | 'dueDate' | 'priority'

export interface TaskFilters {
  status: StatusFilter
  priority: PriorityFilter
  search: string
}

export interface TaskStats {
  total: number
  active: number
  completed: number
  overdue: number
  /** Porcentaje entero 0-100. */
  completionRate: number
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

/** Fecha local del usuario en formato `YYYY-MM-DD`. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function normalizeTaskInput(input: TaskInput): TaskInput {
  const dueDate = input.dueDate?.trim() ?? ''
  return {
    title: input.title.trim().replace(/\s+/g, ' '),
    description: input.description.trim(),
    priority: input.priority,
    dueDate: dueDate === '' ? null : dueDate,
  }
}

export function validateTaskInput(input: TaskInput): TaskInputErrors {
  const errors: TaskInputErrors = {}
  const { title, description, priority, dueDate } = normalizeTaskInput(input)

  if (title.length === 0) errors.title = 'El título es obligatorio.'
  else if (title.length > TITLE_MAX_LENGTH)
    errors.title = `El título admite máximo ${TITLE_MAX_LENGTH} caracteres.`

  if (description.length > DESCRIPTION_MAX_LENGTH)
    errors.description = `La descripción admite máximo ${DESCRIPTION_MAX_LENGTH} caracteres.`

  if (!PRIORITIES.includes(priority)) errors.priority = 'Prioridad no válida.'

  if (dueDate !== null && !isIsoDate(dueDate)) errors.dueDate = 'Fecha no válida.'

  return errors
}

export function hasErrors(errors: TaskInputErrors): boolean {
  return Object.keys(errors).length > 0
}

export function isOverdue(task: Pick<Task, 'dueDate' | 'completed'>, today: string): boolean {
  return !task.completed && task.dueDate !== null && task.dueDate < today
}

export function filterTasks(tasks: readonly Task[], filters: TaskFilters): Task[] {
  const search = filters.search.trim().toLocaleLowerCase('es')
  return tasks.filter((task) => {
    if (filters.status === 'active' && task.completed) return false
    if (filters.status === 'completed' && !task.completed) return false
    if (filters.priority !== 'all' && task.priority !== filters.priority) return false
    if (search === '') return true
    return `${task.title} ${task.description}`.toLocaleLowerCase('es').includes(search)
  })
}

const PRIORITY_WEIGHT: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

export function sortTasks(tasks: readonly Task[], key: SortKey): Task[] {
  const byNewest = (a: Task, b: Task) => b.createdAt.getTime() - a.createdAt.getTime()
  const comparators: Record<SortKey, (a: Task, b: Task) => number> = {
    createdAt: byNewest,
    priority: (a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority] || byNewest(a, b),
    dueDate: (a, b) => {
      if (a.dueDate === b.dueDate) return byNewest(a, b)
      if (a.dueDate === null) return 1
      if (b.dueDate === null) return -1
      return a.dueDate < b.dueDate ? -1 : 1
    },
  }
  // Las pendientes siempre van primero; dentro de cada grupo se aplica el criterio elegido.
  return [...tasks].sort(
    (a, b) => Number(a.completed) - Number(b.completed) || comparators[key](a, b),
  )
}

export function computeStats(tasks: readonly Task[], today: string): TaskStats {
  const completed = tasks.filter((t) => t.completed).length
  const total = tasks.length
  return {
    total,
    completed,
    active: total - completed,
    overdue: tasks.filter((t) => isOverdue(t, today)).length,
    completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
  }
}
