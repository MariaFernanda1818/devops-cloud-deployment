import { PRIORITIES, PRIORITY_LABELS, type PriorityFilter, type SortKey, type StatusFilter, type TaskFilters } from '../domain/task'

interface TaskToolbarProps {
  filters: TaskFilters
  sort: SortKey
  onFiltersChange: (filters: TaskFilters) => void
  onSortChange: (sort: SortKey) => void
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'Pendientes' },
  { value: 'completed', label: 'Completadas' },
]

export function TaskToolbar({ filters, sort, onFiltersChange, onSortChange }: TaskToolbarProps) {
  return (
    <div className="toolbar">
      <div className="segmented" role="group" aria-label="Filtrar por estado">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className="segmented__option"
            aria-pressed={filters.status === option.value}
            onClick={() => onFiltersChange({ ...filters, status: option.value })}
          >
            {option.label}
          </button>
        ))}
      </div>

      <input
        type="search"
        className="toolbar__search"
        placeholder="Buscar tareas…"
        aria-label="Buscar tareas"
        value={filters.search}
        onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
      />

      <select
        aria-label="Filtrar por prioridad"
        value={filters.priority}
        onChange={(e) => onFiltersChange({ ...filters, priority: e.target.value as PriorityFilter })}
      >
        <option value="all">Toda prioridad</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABELS[p]}
          </option>
        ))}
      </select>

      <select aria-label="Ordenar por" value={sort} onChange={(e) => onSortChange(e.target.value as SortKey)}>
        <option value="createdAt">Más recientes</option>
        <option value="dueDate">Fecha límite</option>
        <option value="priority">Prioridad</option>
      </select>
    </div>
  )
}
