import { describe, expect, it, vi } from 'vitest'
import type { Task } from '../domain/task'
import { InMemoryTaskRepository } from './inMemoryTaskRepository'

describe('InMemoryTaskRepository', () => {
  it('notifica la lista inicial y cada cambio', async () => {
    const repo = new InMemoryTaskRepository([], () => new Date(2026, 9, 21))
    const onChange = vi.fn<(tasks: Task[]) => void>()
    repo.subscribe(onChange, vi.fn())

    await repo.create({ title: '  Nueva  ', description: '', priority: 'high', dueDate: '' })
    const created = onChange.mock.lastCall![0][0]
    expect(created).toMatchObject({ title: 'Nueva', priority: 'high', dueDate: null, completed: false })

    await repo.update(created.id, { completed: true })
    expect(onChange.mock.lastCall![0][0].completed).toBe(true)

    await repo.remove(created.id)
    expect(onChange.mock.lastCall![0]).toEqual([])
    expect(onChange).toHaveBeenCalledTimes(4)
  })

  it('deja de notificar al cancelar la suscripción', async () => {
    const repo = new InMemoryTaskRepository()
    const onChange = vi.fn()
    const unsubscribe = repo.subscribe(onChange, vi.fn())
    unsubscribe()
    await repo.create({ title: 'x', description: '', priority: 'low', dueDate: null })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('falla al operar sobre una tarea inexistente', async () => {
    const repo = new InMemoryTaskRepository()
    await expect(repo.update('nope', { completed: true })).rejects.toThrow('no existe')
    await expect(repo.remove('nope')).rejects.toThrow('no existe')
  })
})
