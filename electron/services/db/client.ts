import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { schema } from "./schema.js";

let db: Database.Database | null = null;

export function initializeDatabase(userDataPath: string) {
  fs.mkdirSync(userDataPath, { recursive: true });
  const dbPath = path.join(userDataPath, "zentube.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(schema);
}

export function getDatabase() {
  if (!db) {
    throw new Error("Database has not been initialized.");
  }

  return db;
}
