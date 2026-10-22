/// <reference types="vite/client" />
import type { AppInfo } from './config/appInfo'

declare global {
  const __APP_INFO__: AppInfo

  interface ImportMetaEnv {
    /** Si es "true", la app se conecta a los emuladores locales de Firebase. */
    readonly VITE_USE_EMULATORS?: string
    /** Configuración explícita opcional; si falta se usa /__/firebase/init.json de Hosting. */
    readonly VITE_FIREBASE_API_KEY?: string
    readonly VITE_FIREBASE_AUTH_DOMAIN?: string
    readonly VITE_FIREBASE_PROJECT_ID?: string
    readonly VITE_FIREBASE_APP_ID?: string
  }
}
