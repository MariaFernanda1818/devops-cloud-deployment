import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

let env: RulesTestEnvironment

const validTask = () => ({
  title: 'Configurar pipeline',
  description: '',
  priority: 'high',
  dueDate: '2026-10-30',
  completed: false,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
})

const taskRef = (db: Firestore, uid: string, id = 't1') => doc(db, 'users', uid, 'tasks', id)
const asUser = (uid: string) => env.authenticatedContext(uid).firestore() as unknown as Firestore

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-taskflow',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
  })
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
})

describe('reglas de Firestore', () => {
  it('permite al dueño crear, leer, actualizar y borrar su tarea', async () => {
    const db = asUser('alice')
    await assertSucceeds(setDoc(taskRef(db, 'alice'), validTask()))
    await assertSucceeds(getDoc(taskRef(db, 'alice')))
    await assertSucceeds(updateDoc(taskRef(db, 'alice'), { completed: true, updatedAt: serverTimestamp() }))
    await assertSucceeds(deleteDoc(taskRef(db, 'alice')))
  })

  it('deniega el acceso sin autenticación', async () => {
    const db = env.unauthenticatedContext().firestore() as unknown as Firestore
    await assertFails(getDoc(taskRef(db, 'alice')))
    await assertFails(setDoc(taskRef(db, 'alice'), validTask()))
  })

  it('aísla los datos entre usuarios', async () => {
    await assertSucceeds(setDoc(taskRef(asUser('alice'), 'alice'), validTask()))
    const bob = asUser('bob')
    await assertFails(getDoc(taskRef(bob, 'alice')))
    await assertFails(updateDoc(taskRef(bob, 'alice'), { completed: true, updatedAt: serverTimestamp() }))
    await assertFails(deleteDoc(taskRef(bob, 'alice')))
    await assertFails(setDoc(taskRef(bob, 'alice', 't2'), validTask()))
  })

  it('valida el esquema al crear', async () => {
    const db = asUser('alice')
    await assertFails(setDoc(taskRef(db, 'alice'), { ...validTask(), title: '   ' }))
    await assertFails(setDoc(taskRef(db, 'alice'), { ...validTask(), title: 'x'.repeat(121) }))
    await assertFails(setDoc(taskRef(db, 'alice'), { ...validTask(), priority: 'urgent' }))
    await assertFails(setDoc(taskRef(db, 'alice'), { ...validTask(), dueDate: 'mañana' }))
    await assertFails(setDoc(taskRef(db, 'alice'), { ...validTask(), completed: true }))
    await assertFails(setDoc(taskRef(db, 'alice'), { ...validTask(), isAdmin: true }))
    await assertFails(setDoc(taskRef(db, 'alice'), { ...validTask(), createdAt: new Date(2000, 0, 1) }))
  })

  it('impide alterar createdAt o falsear updatedAt al actualizar', async () => {
    const db = asUser('alice')
    await assertSucceeds(setDoc(taskRef(db, 'alice'), validTask()))
    await assertFails(updateDoc(taskRef(db, 'alice'), { createdAt: new Date(2000, 0, 1), updatedAt: serverTimestamp() }))
    await assertFails(updateDoc(taskRef(db, 'alice'), { completed: true }))
  })

  it('deniega cualquier otra colección', async () => {
    const db = asUser('alice')
    await assertFails(setDoc(doc(db, 'admin', 'config'), { open: true }))
    await assertFails(getDoc(doc(db, 'users', 'alice')))
  })
})
