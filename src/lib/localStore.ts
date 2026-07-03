/**
 * localStore.ts — localStorage-backed persistence layer
 * Replaces Firestore for the offline preview build.
 */

const PREFIX = 'nw_';

function key(path: string) { return PREFIX + path; }

export function lsGet<T>(path: string): T | null {
  try {
    const raw = localStorage.getItem(key(path));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

export function lsSet(path: string, data: any) {
  try { localStorage.setItem(key(path), JSON.stringify(data)); } catch {}
}

export function lsDel(path: string) {
  try { localStorage.removeItem(key(path)); } catch {}
}

export function lsGetCollection<T>(collPath: string): T[] {
  try {
    const index: string[] = JSON.parse(localStorage.getItem(key(collPath + '/__index')) || '[]');
    return index
      .map(id => lsGet<T>(collPath + '/' + id))
      .filter(Boolean) as T[];
  } catch { return []; }
}

export function lsUpsertDoc<T extends { id: string }>(collPath: string, doc: T) {
  const indexKey = key(collPath + '/__index');
  const index: string[] = JSON.parse(localStorage.getItem(indexKey) || '[]');
  if (!index.includes(doc.id)) {
    index.push(doc.id);
    localStorage.setItem(indexKey, JSON.stringify(index));
  }
  lsSet(collPath + '/' + doc.id, doc);
}

export function lsDeleteDoc(collPath: string, id: string) {
  const indexKey = key(collPath + '/__index');
  const index: string[] = JSON.parse(localStorage.getItem(indexKey) || '[]');
  const newIndex = index.filter(i => i !== id);
  localStorage.setItem(indexKey, JSON.stringify(newIndex));
  lsDel(collPath + '/' + id);
}

export function lsDeleteCollection(collPath: string) {
  const indexKey = key(collPath + '/__index');
  const index: string[] = JSON.parse(localStorage.getItem(indexKey) || '[]');
  index.forEach(id => lsDel(collPath + '/' + id));
  localStorage.removeItem(indexKey);
}
