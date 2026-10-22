import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'
import type { AppInfo } from './config/appInfo'
import { InMemoryTaskRepository } from './data/inMemoryTaskRepository'

const info: AppInfo = { environment: 'qa', version: '1.2.3', commit: 'abcdef1234567', builtAt: '2026-10-21T00:00:00Z' }

describe('App', () => {
  it('muestra el ambiente y la versión desplegada', async () => {
    render(<App info={info} createRepository={async () => new InMemoryTaskRepository()} />)
    expect(screen.getByTestId('env-badge')).toHaveTextContent('QA')
    expect(screen.getByText('v1.2.3')).toBeInTheDocument()
    expect(screen.getByText('commit abcdef1')).toBeInTheDocument()
    expect(await screen.findByText('Aún no tienes tareas. ¡Crea la primera!')).toBeInTheDocument()
  })

  it('muestra un mensaje si no puede conectarse a Firebase', async () => {
    render(<App info={info} createRepository={() => Promise.reject(new Error('Sin configuración'))} />)
    expect(screen.getByText('Conectando con Firebase…')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin configuración')
  })

  it('usa la información de compilación por defecto', async () => {
    render(<App createRepository={async () => new InMemoryTaskRepository()} />)
    expect(screen.getByTestId('env-badge')).toHaveTextContent('LOCAL')
    await screen.findByText('Aún no tienes tareas. ¡Crea la primera!')
  })
})
