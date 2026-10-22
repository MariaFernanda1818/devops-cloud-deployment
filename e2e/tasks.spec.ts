import { expect, test } from '@playwright/test'

// Pruebas de aceptación: recorren el flujo completo contra Firebase real (o emuladores).
// Cada ejecución usa un título único y deja la base limpia al final.

test('el ciclo de vida de una tarea se persiste en Firestore', async ({ page }) => {
  const title = `E2E ${test.info().project.name} ${Date.now()}`

  await page.goto('/')
  await expect(page.getByTestId('env-badge')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mis tareas' })).toBeVisible()

  const form = page.getByRole('form', { name: 'Agregar tarea' })
  await form.getByLabel('Título').fill(title)
  await form.getByLabel('Descripción (opcional)').fill('Creada por Playwright')
  await form.getByLabel('Prioridad').selectOption('high')
  await form.getByRole('button', { name: 'Agregar tarea' }).click()

  const item = page.getByTestId('task-item').filter({ hasText: title })
  await expect(item).toBeVisible()
  await expect(item.getByText('Prioridad Alta')).toBeVisible()
  // Espera la confirmación del servidor antes de recargar (la UI muestra "Sincronizando…").
  await expect(item).toHaveAttribute('data-sync', 'synced')

  // Recargar demuestra persistencia real (no solo estado en memoria) y la sesión anónima.
  await page.reload()
  await expect(item).toBeVisible()

  // El checkbox es controlado: refleja el estado cuando llega el snapshot de Firestore.
  await item.getByRole('checkbox').click()
  await expect(item.getByRole('checkbox')).toBeChecked()
  await expect(item).toHaveClass(/task--done/)
  await expect(item).toHaveAttribute('data-sync', 'synced')

  await page.reload()
  await expect(item.getByRole('checkbox')).toBeChecked()

  await item.getByRole('button', { name: `Eliminar ${title}` }).click()
  await item.getByRole('button', { name: 'Confirmar' }).click()
  await expect(item).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Mis tareas' })).toBeVisible()
  await expect(page.getByTestId('task-item').filter({ hasText: title })).toHaveCount(0)
})

test('la validación impide crear tareas sin título', async ({ page }) => {
  await page.goto('/')
  const form = page.getByRole('form', { name: 'Agregar tarea' })
  await form.getByRole('button', { name: 'Agregar tarea' }).click()
  await expect(form.getByRole('alert')).toHaveText('El título es obligatorio.')
})
