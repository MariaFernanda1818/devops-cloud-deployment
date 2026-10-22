import type { TaskStats } from '../domain/task'

export function StatsBar({ stats }: { stats: TaskStats }) {
  const items = [
    { label: 'Total', value: stats.total },
    { label: 'Pendientes', value: stats.active },
    { label: 'Completadas', value: stats.completed },
    { label: 'Vencidas', value: stats.overdue, tone: stats.overdue > 0 ? 'danger' : undefined },
  ]
  return (
    <section className="stats" aria-label="Resumen de tareas">
      {items.map((item) => (
        <div key={item.label} className={`stat ${item.tone ? `stat--${item.tone}` : ''}`}>
          <span className="stat__value">{item.value}</span>
          <span className="stat__label">{item.label}</span>
        </div>
      ))}
      <div className="stat stat--progress">
        <div className="progress__header">
          <span className="stat__label">Progreso</span>
          <span className="stat__value stat__value--sm">{stats.completionRate}%</span>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-label="Porcentaje de tareas completadas"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={stats.completionRate}
        >
          <div className="progress__bar" style={{ width: `${stats.completionRate}%` }} />
        </div>
      </div>
    </section>
  )
}
