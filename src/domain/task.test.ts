import { describe, expect, it } from 'vitest'
import { makeTask } from '../test/factories'
import {
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  computeStats,
  filterTasks,
  hasErrors,
  isIsoDate,
  isOverdue,
  normalizeTaskInput,
  sortTasks,
  toIsoDate,
  validateTaskInput,
  type TaskInput,
} from './task'

const valid: TaskInput = { title: 'Preparar demo', description: '', priority: 'high', dueDate: '2026-10-30' }

describe('validateTaskInput', () => {
  it('acepta una tarea válida', () => {
    expect(hasErrors(validateTaskInput(valid))).toBe(false)
  })

  it('exige título no vacío', () => {
    expect(validateTaskInput({ ...valid, title: '   ' }).title).toBe('El título es obligatorio.')
  })

  it('limita la longitud del título y la descripción', () => {
    const errors = validateTaskInput({
      ...valid,
      title: 'a'.repeat(TITLE_MAX_LENGTH + 1),
      description: 'b'.repeat(DESCRIPTION_MAX_LENGTH + 1),
    })
    expect(errors.title).toMatch(/máximo/)
    expect(errors.description).toMatch(/máximo/)
  })

  it('rechaza prioridades y fechas inválidas', () => {
    const errors = validateTaskInput({ ...valid, priority: 'urgent' as never, dueDate: '2026-02-30' })
    expect(errors.priority).toBeDefined()
    expect(errors.dueDate).toBeDefined()
  })
})

describe('normalizeTaskInput', () => {
  it('recorta espacios y convierte fecha vacía en null', () => {
    expect(normalizeTaskInput({ title: '  Hola   mundo ', description: ' x ', priority: 'low', dueDate: '' })).toEqual({
      title: 'Hola mundo',
      description: 'x',
      priority: 'low',
      dueDate: null,
    })
  })
})

describe('fechas', () => {
  it('valida fechas ISO reales', () => {
    expect(isIsoDate('2026-10-21')).toBe(true)
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(isIsoDate('21/10/2026')).toBe(false)
  })

  it('formatea la fecha local como YYYY-MM-DD', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('marca como vencidas solo tareas pendientes con fecha pasada', () => {
    expect(isOverdue({ dueDate: '2026-10-20', completed: false }, '2026-10-21')).toBe(true)
    expect(isOverdue({ dueDate: '2026-10-21', completed: false }, '2026-10-21')).toBe(false)
    expect(isOverdue({ dueDate: '2026-10-20', completed: true }, '2026-10-21')).toBe(false)
    expect(isOverdue({ dueDate: null, completed: false }, '2026-10-21')).toBe(false)
  })
})

describe('filterTasks', () => {
  const tasks = [
    makeTask({ title: 'Configurar pipeline', priority: 'high' }),
    makeTask({ title: 'Escribir README', description: 'Incluir costos', completed: true }),
    makeTask({ title: 'Revisar reglas', priority: 'low' }),
  ]

  it('filtra por estado', () => {
    expect(filterTasks(tasks, { status: 'active', priority: 'all', search: '' })).toHaveLength(2)
    expect(filterTasks(tasks, { status: 'completed', priority: 'all', search: '' })).toHaveLength(1)
  })

  it('filtra por prioridad', () => {
    expect(filterTasks(tasks, { status: 'all', priority: 'low', search: '' }).map((t) => t.title)).toEqual([
      'Revisar reglas',
    ])
  })

  it('busca en título y descripción sin distinguir mayúsculas', () => {
    expect(filterTasks(tasks, { status: 'all', priority: 'all', search: 'COSTOS' }).map((t) => t.title)).toEqual([
      'Escribir README',
    ])
  })
})

describe('sortTasks', () => {
  const older = makeTask({ title: 'antigua', priority: 'low', dueDate: '2026-11-01', createdAt: new Date(2026, 0, 1) })
  const newer = makeTask({ title: 'nueva', priority: 'high', dueDate: null, createdAt: new Date(2026, 5, 1) })
  const done = makeTask({ title: 'hecha', priority: 'high', completed: true, createdAt: new Date(2026, 9, 1) })
  const soon = makeTask({ title: 'pronto', priority: 'medium', dueDate: '2026-10-25', createdAt: new Date(2026, 2, 1) })
  const all = [older, newer, done, soon]

  it('ordena por más recientes con las completadas al final', () => {
    expect(sortTasks(all, 'createdAt').map((t) => t.title)).toEqual(['nueva', 'pronto', 'antigua', 'hecha'])
  })

  it('ordena por fecha límite dejando sin fecha al final', () => {
    expect(sortTasks(all, 'dueDate').map((t) => t.title)).toEqual(['pronto', 'antigua', 'nueva', 'hecha'])
  })

  it('ordena por prioridad', () => {
    expect(sortTasks(all, 'priority').map((t) => t.title)).toEqual(['nueva', 'pronto', 'antigua', 'hecha'])
  })

  it('no muta el arreglo original', () => {
    const copy = [...all]
    sortTasks(all, 'priority')
    expect(all).toEqual(copy)
  })
})

describe('computeStats', () => {
  it('calcula totales, vencidas y porcentaje de avance', () => {
    const stats = computeStats(
      [
        makeTask({ completed: true }),
        makeTask({ dueDate: '2026-10-01' }),
        makeTask({ dueDate: '2026-12-01' }),
      ],
      '2026-10-21',
    )
    expect(stats).toEqual({ total: 3, active: 2, completed: 1, overdue: 1, completionRate: 33 })
  })

  it('devuelve 0% sin tareas', () => {
    expect(computeStats([], '2026-10-21').completionRate).toBe(0)
  })
})
