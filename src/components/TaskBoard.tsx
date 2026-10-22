import { useMemo, useState } from 'react'
import type { TaskRepository } from '../data/taskRepository'
import { computeStats, filterTasks, sortTasks, toIsoDate, type SortKey, type TaskFilters } from '../domain/task'
import { useTasks } from '../hooks/useTasks'
import { StatsBar } from './StatsBar'
import { TaskForm } from './TaskForm'
import { TaskItem } from './TaskItem'
import { TaskToolbar } from './TaskToolbar'

interface TaskBoardProps {
  repository: TaskRepository
  today?: string
}

export function TaskBoard({ repository, today = toIsoDate(new Date()) }: TaskBoardProps) {
  const { tasks, loading, error, clearError, createTask, updateTask, removeTask } = useTasks(repository)
  const [filters, setFilters] = useState<TaskFilters>({ status: 'all', priority: 'all', search: '' })
  const [sort, setSort] = useState<SortKey>('createdAt')

  const stats = useMemo(() => computeStats(tasks, today), [tasks, today])
  const visible = useMemo(() => sortTasks(filterTasks(tasks, filters), sort), [tasks, filters, sort])

  return (
    <div className="board">
      {error && (
        <div className="alert" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={clearError}>
            Cerrar
          </button>
        </div>
      )}

      <StatsBar stats={stats} />

      <section className="card" aria-labelledby="new-task-heading">
        <h2 id="new-task-heading" className="card__title">
          Nueva tarea
        </h2>
        <TaskForm submitLabel="Agregar tarea" onSubmit={createTask} />
      </section>

      <section className="card" aria-labelledby="list-heading">
        <h2 id="list-heading" className="card__title">
          Mis tareas
        </h2>
        <TaskToolbar filters={filters} sort={sort} onFiltersChange={setFilters} onSortChange={setSort} />

        {loading ? (
          <p className="empty" aria-busy="true">
            Cargando tareas…
          </p>
        ) : visible.length === 0 ? (
          <p className="empty">
            {tasks.length === 0 ? 'Aún no tienes tareas. ¡Crea la primera!' : 'Ninguna tarea coincide con los filtros.'}
          </p>
        ) : (
          <ul className="task-list" aria-label="Lista de tareas">
            {visible.map((task) => (
              <TaskItem key={task.id} task={task} today={today} onUpdate={updateTask} onRemove={removeTask} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
