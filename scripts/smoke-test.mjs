#!/usr/bin/env node
// Smoke test posterior al despliegue. Falla (exit 1) si el sitio no responde como se espera.
//
// Uso:
//   node scripts/smoke-test.mjs --url https://mi-sitio.web.app --env dev [--sha <commit>] [--project <id>]
import { appendFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

const { values: args } = parseArgs({
  options: {
    url: { type: 'string' },
    env: { type: 'string' },
    sha: { type: 'string' },
    project: { type: 'string' },
    retries: { type: 'string', default: '10' },
    delay: { type: 'string', default: '6000' },
  },
})

if (!args.url || !args.env) {
  console.error('Uso: smoke-test.mjs --url <url> --env <dev|qa|prod> [--sha <commit>] [--project <id>]')
  process.exit(2)
}

const baseUrl = args.url.replace(/\/+$/, '')
const retries = Number(args.retries)
const delayMs = Number(args.delay)
const results = []

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function get(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'cache-control': 'no-cache' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })
  return { response, body: await response.text() }
}

async function check(name, fn, { retry = false } = {}) {
  const attempts = retry ? retries : 1
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const detail = await fn()
      results.push({ name, ok: true, detail })
      console.log(`✔ ${name}${detail ? ` — ${detail}` : ''}`)
      return
    } catch (error) {
      if (attempt === attempts) {
        results.push({ name, ok: false, detail: error.message })
        console.error(`✘ ${name} — ${error.message}`)
        return
      }
      console.log(`… ${name}: intento ${attempt}/${attempts} falló (${error.message}); reintentando`)
      await sleep(delayMs)
    }
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message)
}

console.log(`Smoke test de ${baseUrl} (ambiente esperado: ${args.env})`)

const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(baseUrl)

await check('HTTPS', async () => {
  if (isLocal) return 'omitido: emulador local'
  expect(baseUrl.startsWith('https://'), 'la URL debe usar HTTPS')
})

await check(
  'Página principal responde 200 con la app',
  async () => {
    const { response, body } = await get('/')
    expect(response.status === 200, `status ${response.status}`)
    expect(body.includes('<div id="root">'), 'no se encontró el contenedor de la app')
    return `status ${response.status}`
  },
  { retry: true },
)

await check(
  'Versión desplegada',
  async () => {
    const { response, body } = await get('/version.json')
    expect(response.status === 200, `version.json devolvió ${response.status}`)
    const info = JSON.parse(body)
    expect(info.environment === args.env, `ambiente "${info.environment}" ≠ "${args.env}"`)
    if (args.sha) expect(info.commit === args.sha, `commit ${info.commit} ≠ ${args.sha} (¿caché/propagación?)`)
    return `env=${info.environment} commit=${info.commit.slice(0, 7)} build=${info.builtAt}`
  },
  { retry: true },
)

await check('Cabeceras de seguridad', async () => {
  const { response } = await get('/')
  const required = ['content-security-policy', 'strict-transport-security', 'x-content-type-options', 'x-frame-options']
  const missing = required.filter((h) => !response.headers.has(h))
  expect(missing.length === 0, `faltan: ${missing.join(', ')}`)
  return required.join(', ')
})

await check('index.html y version.json sin caché (cada despliegue se ve de inmediato)', async () => {
  if (isLocal) return 'omitido: emulador local'
  for (const path of ['/', '/version.json']) {
    const { response } = await get(path)
    const cache = response.headers.get('cache-control') ?? ''
    expect(/no-cache|no-store/.test(cache), `${path} → Cache-Control "${cache}"`)
  }
  return 'no-cache'
})

await check('Rutas SPA reescritas a index.html', async () => {
  const { response, body } = await get('/ruta-inexistente')
  expect(response.status === 200 && body.includes('<div id="root">'), `status ${response.status}`)
})

await check('Configuración de Firebase del proyecto correcto', async () => {
  const { response, body } = await get('/__/firebase/init.json')
  expect(response.status === 200, `init.json devolvió ${response.status}`)
  const config = JSON.parse(body)
  expect(Boolean(config.apiKey && config.projectId), 'init.json incompleto')
  if (args.project) expect(config.projectId === args.project, `projectId ${config.projectId} ≠ ${args.project}`)
  return `projectId=${config.projectId}`
})

const failed = results.filter((r) => !r.ok)

if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = results.map((r) => `| ${r.ok ? '✅' : '❌'} | ${r.name} | ${String(r.detail ?? '').replace(/\|/g, '\\|')} |`)
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [`### Smoke test ${args.env.toUpperCase()} — ${baseUrl}`, '', '| | Verificación | Detalle |', '|---|---|---|', ...rows, ''].join('\n'),
  )
}

console.log(failed.length === 0 ? '\nSmoke test OK' : `\nSmoke test FALLÓ (${failed.length} verificaciones)`)
process.exit(failed.length === 0 ? 0 : 1)
