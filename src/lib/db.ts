import Dexie, { type Table } from "dexie";

interface KVEntry {
  key: string;
  value: string;
}

class PorylistDB extends Dexie {
  kv!: Table<KVEntry, string>;

  constructor() {
    super("porylist");
    this.version(1).stores({ kv: "key" });
  }
}

export const db = new PorylistDB();

/**
 * On first boot (empty IndexedDB), copy all porylist-* and theme keys from
 * localStorage so existing data isn't lost.
 */
export async function migrateFromLocalStorage(): Promise<void> {
  const count = await db.kv.count();
  if (count > 0) return;

  const keys = Object.keys(localStorage).filter(
    (k) => k.startsWith("porylist") || k === "theme",
  );
  if (keys.length === 0) return;

  const entries = keys.map((k) => ({ key: k, value: localStorage.getItem(k) ?? "" }));
  await db.kv.bulkPut(entries);
}

export async function dbGet(key: string): Promise<string | null> {
  const entry = await db.kv.get(key);
  return entry?.value ?? null;
}

export async function dbSet(key: string, value: string): Promise<void> {
  await db.kv.put({ key, value });
}
