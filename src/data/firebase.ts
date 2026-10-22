import { initializeApp, type FirebaseOptions } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { FirestoreTaskRepository } from './firestoreTaskRepository'
import type { TaskRepository } from './taskRepository'

/**
 * Firebase Hosting publica la configuración web del proyecto en /__/firebase/init.json.
 * Así el mismo código sirve en DEV, QA y PDN: cada sitio entrega la configuración de su
 * propio proyecto y no hay que versionar ni inyectar claves por ambiente.
 */
async function loadFirebaseOptions(): Promise<FirebaseOptions> {
  const env = import.meta.env
  if (env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID) {
    return {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    }
  }
  const response = await fetch('/__/firebase/init.json')
  if (!response.ok) {
    throw new Error(
      'No se encontró la configuración de Firebase. Ejecuta la app desde Firebase Hosting o con los emuladores (npm run dev:emulator).',
    )
  }
  return (await response.json()) as FirebaseOptions
}

let repositoryPromise: Promise<TaskRepository> | undefined

/**
 * Inicializa Firebase una sola vez. Sin esto, dos llamadas concurrentes (p. ej. el doble
 * efecto de React StrictMode) crean dos usuarios anónimos y la sesión activa deja de
 * coincidir con la ruta users/{uid}, por lo que las reglas rechazan la lectura.
 */
export function createFirestoreRepository(): Promise<TaskRepository> {
  repositoryPromise ??= initialize().catch((error: unknown) => {
    repositoryPromise = undefined // permite reintentar tras un fallo de red
    throw error
  })
  return repositoryPromise
}

async function initialize(): Promise<TaskRepository> {
  const app = initializeApp(await loadFirebaseOptions())
  const auth = getAuth(app)
  const db = getFirestore(app)

  if (import.meta.env.VITE_USE_EMULATORS === 'true') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', 8085)
  }

  // Autenticación anónima: cada navegador obtiene un uid propio y las reglas de
  // Firestore garantizan que solo pueda leer y modificar sus propias tareas.
  await auth.authStateReady()
  const user = auth.currentUser ?? (await signInAnonymously(auth)).user
  return new FirestoreTaskRepository(db, user.uid)
}
