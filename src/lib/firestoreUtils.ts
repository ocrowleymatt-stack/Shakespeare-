/** Firestore utils STUB — preview/offline mode */
export enum OperationType {
  CREATE = 'create', UPDATE = 'update', DELETE = 'delete',
  LIST = 'list', GET = 'get', WRITE = 'write',
}
export function handleFirestoreError(error: any, _op: OperationType, _path: string | null) {
  console.warn('[LocalMode] Suppressed:', error?.message || error);
}
