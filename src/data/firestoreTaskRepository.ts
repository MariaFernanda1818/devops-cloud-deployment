import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
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

function toTask(snapshot: QueryDocumentSnapshot<DocumentData>): Task {
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
    pendingSync: snapshot.metadata.hasPendingWrites,
  }
}

/** Las tareas se guardan en `users/{uid}/tasks`; las reglas de Firestore aíslan a cada usuario. */
export class FirestoreTaskRepository implements TaskRepository {
  private readonly tasks: CollectionReference<DocumentData>

  constructor(db: Firestore, uid: string) {
    this.tasks = collection(db, 'users', uid, 'tasks')
  }

  subscribe(onChange: (tasks: Task[]) => void, onError: (error: Error) => void): () => void {
    return onSnapshot(
      query(this.tasks, orderBy('createdAt', 'desc')),
      // Incluye cambios de metadatos para saber cuándo el servidor confirma cada escritura.
      { includeMetadataChanges: true },
      (snapshot) => onChange(snapshot.docs.map(toTask)),
      onError,
    )
  }

  async create(input: TaskInput): Promise<void> {
    await addDoc(this.tasks, {
      ...normalizeTaskInput(input),
      completed: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  async update(id: string, patch: TaskPatch): Promise<void> {
    const changes: DocumentData = { updatedAt: serverTimestamp() }
    if (patch.completed !== undefined) changes.completed = patch.completed
    if (patch.title !== undefined) changes.title = patch.title.trim().replace(/\s+/g, ' ')
    if (patch.description !== undefined) changes.description = patch.description.trim()
    if (patch.priority !== undefined) changes.priority = patch.priority
    if (patch.dueDate !== undefined) changes.dueDate = patch.dueDate?.trim() || null
    await updateDoc(doc(this.tasks, id), changes)
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.tasks, id))
  }
}
