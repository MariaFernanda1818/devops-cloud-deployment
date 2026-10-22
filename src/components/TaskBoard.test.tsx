import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InMemoryTaskRepository } from '../data/inMemoryTaskRepository'
import type { TaskRepository } from '../data/taskRepository'
import { makeTask } from '../test/factories'
import { TaskBoard } from './TaskBoard'

const TODAY = '2026-10-21'

function setup(repository: TaskRepository = new InMemoryTaskRepository()) {
  const user = userEvent.setup()
  render(<TaskBoard repository={repository} today={TODAY} />)
  return { user, repository }
}

const newTaskForm = () => screen.getByRole('form', { name: 'Agregar tarea' })
const list = () => screen.getByRole('list', { name: 'Lista de tareas' })
const stat = (label: string) =>
  within(screen.getByRole('region', { name: 'Resumen de tareas' })).getByText(label).previousElementSibling?.textContent

describe('TaskBoard', () => {
  it('muestra el estado vacío', () => {
    setup()
    expect(screen.getByText('Aún no tienes tareas. ¡Crea la primera!')).toBeInTheDocument()
  })

  it('crea una tarea y actualiza las estadísticas', async () => {
    const { user } = setup()
    const form = newTaskForm()
    await user.type(within(form).getByLabelText('Título'), 'Configurar GitHub Actions')
    await user.type(within(form).getByLabelText('Descripción (opcional)'), 'Pipeline con 3 ambientes')
    await user.selectOptions(within(form).getByLabelText('Prioridad'), 'high')
    await user.click(within(form).getByRole('button', { name: 'Agregar tarea' }))

    expect(within(list()).getByText('Configurar GitHub Actions')).toBeInTheDocument()
    expect(within(list()).getByText('Prioridad Alta')).toBeInTheDocument()
    expect(stat('Total')).toBe('1')
    expect(within(form).getByLabelText('Título')).toHaveValue('')
  })

  it('valida el título antes de guardar', async () => {
    const repository = new InMemoryTaskRepository()
    const create = vi.spyOn(repository, 'create')
    const { user } = setup(repository)
    await user.click(within(newTaskForm()).getByRole('button', { name: 'Agregar tarea' }))
    expect(screen.getByRole('alert')).toHaveTextContent('El título es obligatorio.')
    expect(create).not.toHaveBeenCalled()
  })

  it('marca una tarea como completada', async () => {
    const { user } = setup(new InMemoryTaskRepository([makeTask({ title: 'Escribir pruebas' })]))
    await user.click(screen.getByRole('checkbox', { name: /Marcar como completada: Escribir pruebas/ }))
    expect(stat('Completadas')).toBe('1')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })

  it('edita una tarea existente', async () => {
    const { user } = setup(new InMemoryTaskRepository([makeTask({ title: 'Borrador' })]))
    await user.click(screen.getByRole('button', { name: 'Editar Borrador' }))
    const form = screen.getByRole('form', { name: 'Guardar cambios' })
    const title = within(form).getByLabelText('Título')
    await user.clear(title)
    await user.type(title, 'Versión final')
    await user.click(within(form).getByRole('button', { name: 'Guardar cambios' }))

    expect(within(list()).getByText('Versión final')).toBeInTheDocument()
    expect(screen.queryByText('Borrador')).not.toBeInTheDocument()
  })

  it('permite cancelar la edición', async () => {
    const { user } = setup(new InMemoryTaskRepository([makeTask({ title: 'Sin cambios' })]))
    await user.click(screen.getByRole('button', { name: 'Editar Sin cambios' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(within(list()).getByText('Sin cambios')).toBeInTheDocument()
  })

  it('elimina una tarea solo después de confirmar', async () => {
    const { user } = setup(new InMemoryTaskRepository([makeTask({ title: 'Temporal' })]))
    await user.click(screen.getByRole('button', { name: 'Eliminar Temporal' }))
    await user.click(screen.getByRole('button', { name: 'No' }))
    expect(screen.getByText('Temporal')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Eliminar Temporal' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(screen.queryByText('Temporal')).not.toBeInTheDocument()
  })

  it('filtra por estado, prioridad y búsqueda', async () => {
    const { user } = setup(
      new InMemoryTaskRepository([
        makeTask({ title: 'Deploy QA', priority: 'high' }),
        makeTask({ title: 'Deploy DEV', completed: true }),
        makeTask({ title: 'Documentar costos', priority: 'low' }),
      ]),
    )
    await user.click(screen.getByRole('button', { name: 'Pendientes' }))
    expect(within(list()).getAllByTestId('task-item')).toHaveLength(2)

    await user.selectOptions(screen.getByLabelText('Filtrar por prioridad'), 'low')
    expect(within(list()).getByText('Documentar costos')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Filtrar por prioridad'), 'all')
    await user.type(screen.getByLabelText('Buscar tareas'), 'inexistente')
    expect(screen.getByText('Ninguna tarea coincide con los filtros.')).toBeInTheDocument()
  })

  it('ordena por fecha límite y resalta tareas vencidas', async () => {
    const { user } = setup(
      new InMemoryTaskRepository([
        makeTask({ title: 'Futura', dueDate: '2026-12-01' }),
        makeTask({ title: 'Atrasada', dueDate: '2026-10-01' }),
      ]),
    )
    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'dueDate')
    const titles = within(list())
      .getAllByTestId('task-item')
      .map((item) => item.querySelector('.task__title')?.textContent)
    expect(titles).toEqual(['Atrasada', 'Futura'])
    expect(screen.getByText(/Vencida ·/)).toBeInTheDocument()
    expect(stat('Vencidas')).toBe('1')
  })

  it('muestra errores del repositorio y permite cerrarlos', async () => {
    const repository = new InMemoryTaskRepository()
    vi.spyOn(repository, 'create').mockRejectedValue(new Error('permission-denied'))
    const { user } = setup(repository)
    await user.type(within(newTaskForm()).getByLabelText('Título'), 'Falla')
    await user.click(within(newTaskForm()).getByRole('button', { name: 'Agregar tarea' }))

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo completar la operación: permission-denied')
    expect(within(newTaskForm()).getByLabelText('Título')).toHaveValue('Falla')
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('muestra errores de la suscripción en tiempo real', () => {
    const repository: TaskRepository = {
      subscribe: (_onChange, onError) => {
        onError(new Error('offline'))
        return () => {}
      },
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    }
    setup(repository)
    expect(screen.getByRole('alert')).toHaveTextContent('offline')
  })
})

describe('TaskBoard sincronización', () => {
  it('indica las tareas pendientes de confirmar por el servidor', () => {
    render(<TaskBoard repository={new InMemoryTaskRepository([makeTask({ title: 'Offline', pendingSync: true })])} today={TODAY} />)
    expect(screen.getByText('Sincronizando…')).toBeInTheDocument()
    expect(screen.getByTestId('task-item')).toHaveAttribute('data-sync', 'pending')
  })
})
