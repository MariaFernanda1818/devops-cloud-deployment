import { defineConfig } from 'vitest/config'

// Pruebas de reglas de seguridad: se ejecutan contra el emulador de Firestore (npm run test:rules).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
})
