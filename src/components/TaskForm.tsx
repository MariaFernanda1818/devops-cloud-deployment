import { useId, useState, type FormEvent } from 'react'
import {
  DESCRIPTION_MAX_LENGTH,
  PRIORITIES,
  PRIORITY_LABELS,
  TITLE_MAX_LENGTH,
  hasErrors,
  normalizeTaskInput,
  validateTaskInput,
  type Priority,
  type TaskInput,
  type TaskInputErrors,
} from '../domain/task'

const EMPTY: TaskInput = { title: '', description: '', priority: 'medium', dueDate: null }

interface TaskFormProps {
  initialValue?: TaskInput
  submitLabel: string
  onSubmit: (input: TaskInput) => Promise<boolean>
  onCancel?: () => void
}

export function TaskForm({ initialValue = EMPTY, submitLabel, onSubmit, onCancel }: TaskFormProps) {
  const id = useId()
  const [value, setValue] = useState<TaskInput>(initialValue)
  const [errors, setErrors] = useState<TaskInputErrors>({})
  const [submitting, setSubmitting] = useState(false)

  const set = <K extends keyof TaskInput>(key: K, next: TaskInput[K]) =>
    setValue((current) => ({ ...current, [key]: next }))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validation = validateTaskInput(value)
    setErrors(validation)
    if (hasErrors(validation)) return

    setSubmitting(true)
    const ok = await onSubmit(normalizeTaskInput(value))
    setSubmitting(false)
    if (ok && !onCancel) setValue(EMPTY)
  }

  return (
    <form className="task-form" onSubmit={handleSubmit} noValidate aria-label={submitLabel}>
      <div className="field field--title">
        <label htmlFor={`${id}-title`}>Título</label>
        <input
          id={`${id}-title`}
          value={value.title}
          maxLength={TITLE_MAX_LENGTH + 20}
          placeholder="¿Qué necesitas hacer?"
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? `${id}-title-error` : undefined}
          onChange={(e) => set('title', e.target.value)}
        />
        {errors.title && (
          <p className="field__error" id={`${id}-title-error`} role="alert">
            {errors.title}
          </p>
        )}
      </div>

      <div className="field field--description">
        <label htmlFor={`${id}-description`}>Descripción (opcional)</label>
        <textarea
          id={`${id}-description`}
          rows={2}
          value={value.description}
          placeholder="Detalles, enlaces o criterios de aceptación"
          aria-invalid={Boolean(errors.description)}
          onChange={(e) => set('description', e.target.value)}
        />
        <p className="field__hint">
          {value.description.length}/{DESCRIPTION_MAX_LENGTH}
        </p>
        {errors.description && (
          <p className="field__error" role="alert">
            {errors.description}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor={`${id}-priority`}>Prioridad</label>
        <select
          id={`${id}-priority`}
          value={value.priority}
          onChange={(e) => set('priority', e.target.value as Priority)}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor={`${id}-due`}>Fecha límite</label>
        <input
          id={`${id}-due`}
          type="date"
          value={value.dueDate ?? ''}
          aria-invalid={Boolean(errors.dueDate)}
          onChange={(e) => set('dueDate', e.target.value || null)}
        />
        {errors.dueDate && (
          <p className="field__error" role="alert">
            {errors.dueDate}
          </p>
        )}
      </div>

      <div className="task-form__actions">
        {onCancel && (
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
