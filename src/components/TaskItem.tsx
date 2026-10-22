import { useState } from 'react'
import { PRIORITY_LABELS, isOverdue, type Task, type TaskInput, type TaskPatch } from '../domain/task'
import { TaskForm } from './TaskForm'

interface TaskItemProps {
  task: Task
  today: string
  onUpdate: (id: string, patch: TaskPatch) => Promise<boolean>
  onRemove: (id: string) => Promise<boolean>
}

const dateFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })

function formatDueDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return dateFormat.format(new Date(y, m - 1, d))
}

export function TaskItem({ task, today, onUpdate, onRemove }: TaskItemProps) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const overdue = isOverdue(task, today)

  if (editing) {
    const initialValue: TaskInput = {
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate,
    }
    return (
      <li className="task task--editing">
        <TaskForm
          initialValue={initialValue}
          submitLabel="Guardar cambios"
          onCancel={() => setEditing(false)}
          onSubmit={async (input) => {
            const ok = await onUpdate(task.id, input)
            if (ok) setEditing(false)
            return ok
          }}
        />
      </li>
    )
  }

  const classes = ['task', `task--${task.priority}`]
  if (task.completed) classes.push('task--done')
  if (overdue) classes.push('task--overdue')

  return (
    <li className={classes.join(' ')} data-testid="task-item" data-sync={task.pendingSync ? 'pending' : 'synced'}>
      <label className="task__check">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={(e) => onUpdate(task.id, { completed: e.target.checked })}
        />
        <span className="visually-hidden">
          {task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}: {task.title}
        </span>
      </label>

      <div className="task__body">
        <p className="task__title">{task.title}</p>
        {task.description && <p className="task__description">{task.description}</p>}
        <div className="task__meta">
          <span className={`chip chip--${task.priority}`}>Prioridad {PRIORITY_LABELS[task.priority]}</span>
          {task.dueDate && (
            <span className={`chip ${overdue ? 'chip--danger' : 'chip--muted'}`}>
              {overdue ? 'Vencida · ' : 'Vence · '}
              <time dateTime={task.dueDate}>{formatDueDate(task.dueDate)}</time>
            </span>
          )}
          {task.pendingSync && <span className="chip chip--muted chip--sync">Sincronizando…</span>}
        </div>
      </div>

      <div className="task__actions">
        {confirming ? (
          <>
            <button type="button" className="btn btn--danger btn--sm" onClick={() => onRemove(task.id)}>
              Confirmar
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirming(false)}>
              No
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setEditing(true)}
              aria-label={`Editar ${task.title}`}
            >
              Editar
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm btn--danger-text"
              onClick={() => setConfirming(true)}
              aria-label={`Eliminar ${task.title}`}
            >
              Eliminar
            </button>
          </>
        )}
      </div>
    </li>
  )
}
