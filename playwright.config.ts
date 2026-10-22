import { defineConfig, devices } from '@playwright/test'

// Con E2E_BASE_URL las pruebas corren contra un ambiente desplegado (p. ej. QA en el pipeline).
// Sin ella, levanta Vite en modo "emulator" contra los emuladores locales de Firebase.
const remoteUrl = process.env.E2E_BASE_URL
const localUrl = 'http://127.0.0.1:5173'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: remoteUrl ?? localUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: remoteUrl
    ? undefined
    : {
        command: 'npx vite --mode emulator --host 127.0.0.1 --port 5173 --strictPort',
        url: localUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
})
