import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const _require = createRequire(path.join(process.cwd(), "package.json"));

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "vriddhi.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initSchema(db);
  }
  return db;
}

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS records (
      table_name TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (table_name, id)
    );
    CREATE INDEX IF NOT EXISTS idx_records_table ON records(table_name);
  `);
}

export function readTable(tableName: string): any[] {
  const database = getDb();
  const rows = database
    .prepare("SELECT data FROM records WHERE table_name = ? ORDER BY created_at DESC")
    .all(tableName) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data));
}

export function writeTable(tableName: string, items: any[]) {
  const database = getDb();
  const del = database.prepare("DELETE FROM records WHERE table_name = ?");
  const ins = database.prepare(
    "INSERT OR REPLACE INTO records (table_name, id, data, created_at) VALUES (?, ?, ?, ?)"
  );
  const tx = database.transaction(() => {
    del.run(tableName);
    for (const item of items) {
      const id = String(item.id ?? `id-${Math.random().toString(36).slice(2, 11)}`);
      ins.run(tableName, id, JSON.stringify({ ...item, id }), item.created_at || new Date().toISOString());
    }
  });
  tx();
}

export function insertRecords(tableName: string, items: any[]): any[] {
  const database = getDb();
  const ins = database.prepare(
    "INSERT OR REPLACE INTO records (table_name, id, data, created_at) VALUES (?, ?, ?, ?)"
  );
  const newItems = items.map((item) => ({
    ...item,
    id: item.id || `id-${Math.random().toString(36).slice(2, 11)}`,
    created_at: item.created_at || new Date().toISOString(),
  }));
  const tx = database.transaction(() => {
    for (const item of newItems) {
      ins.run(tableName, item.id, JSON.stringify(item), item.created_at);
    }
  });
  tx();
  return newItems;
}

export function updateRecords(tableName: string, column: string, value: string, updates: any): any[] {
  const database = getDb();
  const rows = readTable(tableName);
  const updated: any[] = [];
  const upd = database.prepare(
    "INSERT OR REPLACE INTO records (table_name, id, data, created_at) VALUES (?, ?, ?, ?)"
  );
  const tx = database.transaction(() => {
    for (const item of rows) {
      if (String(item[column]) === value) {
        const merged = { ...item, ...updates, updated_at: new Date().toISOString() };
        updated.push(merged);
        upd.run(tableName, merged.id, JSON.stringify(merged), merged.created_at || new Date().toISOString());
      }
    }
  });
  tx();
  return updated;
}

export function deleteRecords(tableName: string, column: string, value: string): any[] {
  const database = getDb();
  const rows = readTable(tableName);
  const deleted = rows.filter((item) => String(item[column]) === value);
  const del = database.prepare("DELETE FROM records WHERE table_name = ? AND id = ?");
  const tx = database.transaction(() => {
    for (const item of deleted) {
      del.run(tableName, item.id);
    }
  });
  tx();
  return deleted;
}

export function isDatabaseEmpty(): boolean {
  const database = getDb();
  const row = database.prepare("SELECT COUNT(*) as c FROM records").get() as { c: number };
  return row.c === 0;
}

export function seedDatabase() {
  const seedPath = path.resolve("seed.cjs");
  if (!fs.existsSync(seedPath)) {
    console.warn("seed.cjs not found — skipping seed");
    return;
  }
  delete _require.cache[_require.resolve(seedPath)];
  _require(seedPath);

  const jsonPath = path.join(process.cwd(), "db.json");
  if (!fs.existsSync(jsonPath)) return;

  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  for (const [table, items] of Object.entries(data)) {
    if (Array.isArray(items) && items.length > 0) {
      writeTable(table, items as any[]);
    }
  }
  console.log("✅ SQLite database seeded from db.json");
}

export function migrateFromJsonIfNeeded() {
  if (!isDatabaseEmpty()) return;

  const jsonPath = path.join(process.cwd(), "db.json");
  if (fs.existsSync(jsonPath)) {
    const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    for (const [table, items] of Object.entries(data)) {
      if (Array.isArray(items) && items.length > 0) {
        writeTable(table, items as any[]);
      }
    }
    console.log("✅ Migrated existing db.json into SQLite");
    return;
  }

  seedDatabase();
}
