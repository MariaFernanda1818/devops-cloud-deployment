import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

const ENVIRONMENTS = ['local', 'dev', 'qa', 'prod'] as const
type AppEnvironment = (typeof ENVIRONMENTS)[number]

function resolveCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'unknown'
  }
}

function resolveEnvironment(): AppEnvironment {
  const value = process.env.APP_ENV ?? 'local'
  if (!ENVIRONMENTS.includes(value as AppEnvironment)) {
    throw new Error(`APP_ENV inválido: "${value}". Valores permitidos: ${ENVIRONMENTS.join(', ')}`)
  }
  return value as AppEnvironment
}

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

const appInfo = {
  environment: resolveEnvironment(),
  version: pkg.version,
  commit: resolveCommit(),
  builtAt: new Date().toISOString(),
}

/** Publica dist/version.json: lo usan los smoke tests para verificar qué commit quedó desplegado. */
function versionFile(): Plugin {
  return {
    name: 'taskflow-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: `${JSON.stringify(appInfo, null, 2)}\n` })
    },
  }
}

export default defineConfig({
  plugins: [react(), versionFile()],
  define: {
    __APP_INFO__: JSON.stringify(appInfo),
  },
  build: {
    sourcemap: false,
    // El chunk del SDK de Firebase (Auth + Firestore) ronda 560 kB sin comprimir / 170 kB gzip.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        // El SDK de Firebase cambia poco: en su propio chunk se cachea entre despliegues.
        codeSplitting: {
          groups: [
            { name: 'firebase', test: /node_modules[\\/](@firebase|firebase)[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      // Adaptadores de Firebase y el punto de entrada se validan con las pruebas de reglas y E2E.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts', 'src/data/firebase.ts', 'src/data/firestoreTaskRepository.ts'],
      thresholds: { lines: 85, functions: 85, branches: 80, statements: 85 },
    },
  },
})
