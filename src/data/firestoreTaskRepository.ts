import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type CollectionReference,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import type { Priority, Task, TaskInput, TaskPatch } from '../domain/task'
import { normalizeTaskInput } from '../domain/task'
import type { TaskRepository } from './taskRepository'

function toDate(value: unknown): Date {
  return value instanceof Timestamp ? value.toDate() : new Date()
}

function toTask(snapshot: QueryDocumentSnapshot<DocumentData>, pendingSync: boolean): Task {
  // 'estimate' evita valores nulos mientras el servidor confirma el timestamp.
  const data = snapshot.data({ serverTimestamps: 'estimate' })
  return {
    id: snapshot.id,
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    priority: (data.priority ?? 'medium') as Priority,
    dueDate: typeof data.dueDate === 'string' ? data.dueDate : null,
    completed: Boolean(data.completed),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    pendingSync,
  }
}

/**
 * Las tareas se guardan en `users/{uid}/tasks`; las reglas de Firestore aíslan a cada usuario.
 *
 * "Sincronizando…" se basa en la confirmación de cada escritura (la promesa de setDoc/updateDoc
 * se resuelve cuando el servidor la acepta), no en `metadata.hasPendingWrites` del listener:
 * en Firestore real ese metadato puede tardar decenas de segundos en actualizarse aunque la
 * escritura ya esté guardada.
 */
export class FirestoreTaskRepository implements TaskRepository {
  private readonly tasks: CollectionReference<DocumentData>
  private readonly unconfirmed = new Map<string, number>()
  private latestDocs: QueryDocumentSnapshot<DocumentData>[] = []
  private emit: ((tasks: Task[]) => void) | null = null

  constructor(db: Firestore, uid: string) {
    this.tasks = collection(db, 'users', uid, 'tasks')
  }

  subscribe(onChange: (tasks: Task[]) => void, onError: (error: Error) => void): () => void {
    this.emit = onChange
    const unsubscribe = onSnapshot(
      query(this.tasks, orderBy('createdAt', 'desc')),
      (snapshot) => {
        this.latestDocs = snapshot.docs
        this.publish()
      },
      onError,
    )
    return () => {
      unsubscribe()
      if (this.emit === onChange) this.emit = null
    }
  }

  async create(input: TaskInput): Promise<void> {
    const ref = doc(this.tasks)
    await this.track(
      ref.id,
      setDoc(ref, {
        ...normalizeTaskInput(input),
        completed: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    )
  }

  async update(id: string, patch: TaskPatch): Promise<void> {
    const changes: DocumentData = { updatedAt: serverTimestamp() }
    if (patch.completed !== undefined) changes.completed = patch.completed
    if (patch.title !== undefined) changes.title = patch.title.trim().replace(/\s+/g, ' ')
    if (patch.description !== undefined) changes.description = patch.description.trim()
    if (patch.priority !== undefined) changes.priority = patch.priority
    if (patch.dueDate !== undefined) changes.dueDate = patch.dueDate?.trim() || null
    await this.track(id, updateDoc(doc(this.tasks, id), changes))
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.tasks, id))
  }

  /** Marca la tarea como pendiente hasta que el servidor confirme (o rechace) la escritura. */
  private async track(id: string, write: Promise<void>): Promise<void> {
    this.unconfirmed.set(id, (this.unconfirmed.get(id) ?? 0) + 1)
    this.publish()
    try {
      await write
    } finally {
      const remaining = (this.unconfirmed.get(id) ?? 1) - 1
      if (remaining > 0) this.unconfirmed.set(id, remaining)
      else this.unconfirmed.delete(id)
      this.publish()
    }
  }

  private publish(): void {
    this.emit?.(this.latestDocs.map((d) => toTask(d, this.unconfirmed.has(d.id))))
  }
}
