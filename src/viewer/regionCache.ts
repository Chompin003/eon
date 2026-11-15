export interface CachedRegionFrame {
  key: string;
  pixels: ArrayBuffer;
  size: number;
  coverage: number;
}
const BUDGET = 96 * 1024 * 1024;
let database: Promise<IDBDatabase | undefined> | undefined;
function open() {
  return (database ??= new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(undefined);
    const request = indexedDB.open('eon-regions-v1', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('frames', { keyPath: 'key' });
      request.result.createObjectStore('usage', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = request.onblocked = () => resolve(undefined);
  }));
}
export async function cachedRegion(key: string): Promise<CachedRegionFrame | undefined> {
  try {
    const db = await open();
    if (!db) return;
    return await new Promise((resolve) => {
      const tx = db.transaction(['frames', 'usage'], 'readwrite');
      const request = tx.objectStore('frames').get(key);
      request.onsuccess = () => {
        const entry = request.result as CachedRegionFrame | undefined;
        if (entry)
          tx.objectStore('usage').put({ key, bytes: entry.pixels.byteLength, at: Date.now() });
        resolve(entry);
      };
      request.onerror = () => resolve(undefined);
    });
  } catch {
    return;
  }
}
export async function storeRegion(entry: CachedRegionFrame) {
  try {
    const db = await open();
    if (!db || entry.pixels.byteLength > BUDGET) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(['frames', 'usage'], 'readwrite');
      const frames = tx.objectStore('frames'),
        usage = tx.objectStore('usage');
      frames.put(entry);
      usage.put({ key: entry.key, bytes: entry.pixels.byteLength, at: Date.now() });
      const request = usage.getAll();
      request.onsuccess = () => {
        const records = request.result as { key: string; bytes: number; at: number }[];
        let bytes = records.reduce((sum, row) => sum + row.bytes, 0);
        for (const row of records.sort((a, b) => a.at - b.at)) {
          if (bytes <= BUDGET) break;
          frames.delete(row.key);
          usage.delete(row.key);
          bytes -= row.bytes;
        }
      };
      tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
    });
  } catch {
    /* Browser storage is optional; in-memory playback remains available. */
  }
}
