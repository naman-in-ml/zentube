import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getDatabase } from "../db/client.js";

export type MediaItem = {
  id: string;
  title: string;
  filePath: string;
  fileSizeBytes: number | null;
  addedAt: string;
};

export function listMediaItems(): MediaItem[] {
  const rows = getDatabase()
    .prepare(
      `SELECT id, title, file_path AS filePath, file_size_bytes AS fileSizeBytes, added_at AS addedAt
       FROM media_items
       ORDER BY added_at DESC`
    )
    .all() as MediaItem[];

  return rows;
}

export function addMediaItem(filePath: string): MediaItem {
  const now = new Date().toISOString();
  const stat = fs.statSync(filePath);
  const title = path.basename(filePath, path.extname(filePath));
  const existing = getDatabase()
    .prepare(
      `SELECT id, title, file_path AS filePath, file_size_bytes AS fileSizeBytes, added_at AS addedAt
       FROM media_items
       WHERE file_path = ?`
    )
    .get(filePath) as MediaItem | undefined;

  if (existing) {
    return existing;
  }

  const media: MediaItem = {
    id: randomUUID(),
    title,
    filePath,
    fileSizeBytes: stat.size,
    addedAt: now
  };

  getDatabase()
    .prepare(
      `INSERT INTO media_items (id, title, file_path, file_size_bytes, added_at, updated_at)
       VALUES (@id, @title, @filePath, @fileSizeBytes, @addedAt, @addedAt)`
    )
    .run(media);

  return media;
}
