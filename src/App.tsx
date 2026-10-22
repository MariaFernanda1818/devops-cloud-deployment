import { useEffect, useState } from 'react'
import { TaskBoard } from './components/TaskBoard'
import { ENVIRONMENT_LABELS, appInfo, type AppInfo } from './config/appInfo'
import type { TaskRepository } from './data/taskRepository'

type BootState =
  | { status: 'loading' }
  | { status: 'ready'; repository: TaskRepository }
  | { status: 'error'; message: string }

interface AppProps {
  createRepository: () => Promise<TaskRepository>
  info?: AppInfo
}

export default function App({ createRepository, info = appInfo }: AppProps) {
  const [state, setState] = useState<BootState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    createRepository().then(
      (repository) => !cancelled && setState({ status: 'ready', repository }),
      (error: unknown) =>
        !cancelled &&
        setState({ status: 'error', message: error instanceof Error ? error.message : String(error) }),
    )
    return () => {
      cancelled = true
    }
  }, [createRepository])

  return (
    <div className="app">
      <header className="app__header">
        <div className="brand">
          <span className="brand__logo" aria-hidden="true">
            ✓
          </span>
          <div>
            <h1 className="brand__name">TaskFlow</h1>
            <p className="brand__tagline">Gestión de tareas con despliegue continuo</p>
          </div>
        </div>
        <span className={`env-badge env-badge--${info.environment}`} data-testid="env-badge">
          {ENVIRONMENT_LABELS[info.environment]}
        </span>
      </header>

      <main className="app__main">
        {state.status === 'loading' && <p className="empty">Conectando con Firebase…</p>}
        {state.status === 'error' && (
          <div className="alert" role="alert">
            {state.message}
          </div>
        )}
        {state.status === 'ready' && <TaskBoard repository={state.repository} />}
      </main>

      <footer className="app__footer">
        <span>
          Ambiente <strong>{ENVIRONMENT_LABELS[info.environment]}</strong>
        </span>
        <span>v{info.version}</span>
        <span title={info.commit}>commit {info.commit.slice(0, 7)}</span>
        <span>build {info.builtAt}</span>
      </footer>
    </div>
  )
}
