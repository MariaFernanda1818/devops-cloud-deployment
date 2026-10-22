export type AppEnvironment = 'local' | 'dev' | 'qa' | 'prod'

export interface AppInfo {
  environment: AppEnvironment
  version: string
  commit: string
  builtAt: string
}

export const ENVIRONMENT_LABELS: Record<AppEnvironment, string> = {
  local: 'LOCAL',
  dev: 'DEV',
  qa: 'QA',
  prod: 'PRODUCCIÓN',
}

// Valores inyectados por Vite en tiempo de compilación (ver vite.config.ts).
export const appInfo: AppInfo = __APP_INFO__
