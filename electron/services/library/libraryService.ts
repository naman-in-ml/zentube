import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getDatabase } from "../db/client.js";

export type MediaItem = {
  id: string;
  title: string;
  filePath: string;
  fileSizeBytes: number | null;
  durationSeconds: number | null;
  thumbnailPath: string | null;
  addedAt: string;
};

const SELECT_COLUMNS = `
  id,
  title,
  file_path AS filePath,
  file_size_bytes AS fileSizeBytes,
  duration_seconds AS durationSeconds,
  thumbnail_path AS thumbnailPath,
  added_at AS addedAt
`;

export function listMediaItems(): MediaItem[] {
  return getDatabase()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM media_items ORDER BY added_at DESC`)
    .all() as MediaItem[];
}

export function addMediaItem(
  filePath: string,
  options?: { durationSeconds?: number | null; title?: string | null }
): MediaItem {
  const now = new Date().toISOString();
  const stat = fs.statSync(filePath);
  const title = options?.title?.trim() || path.basename(filePath, path.extname(filePath));
  const existing = getDatabase()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM media_items WHERE file_path = ?`)
    .get(filePath) as MediaItem | undefined;

  if (existing) {
    return existing;
  }

  const media: MediaItem = {
    id: randomUUID(),
    title,
    filePath,
    fileSizeBytes: stat.size,
    durationSeconds: options?.durationSeconds ?? null,
    thumbnailPath: findSiblingThumbnail(filePath),
    addedAt: now
  };

  getDatabase()
    .prepare(
      `INSERT INTO media_items
         (id, title, file_path, file_size_bytes, duration_seconds, thumbnail_path, added_at, updated_at)
       VALUES
         (@id, @title, @filePath, @fileSizeBytes, @durationSeconds, @thumbnailPath, @addedAt, @addedAt)`
    )
    .run(media);

  return media;
}

export function findSiblingThumbnail(filePath: string): string | null {
  const directory = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  const candidates = [".webp", ".jpg", ".jpeg", ".png"];

  for (const extension of candidates) {
    const candidate = path.join(directory, `${base}${extension}`);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function backfillThumbnails(): number {
  const rows = getDatabase()
    .prepare(`SELECT id, file_path AS filePath FROM media_items WHERE thumbnail_path IS NULL`)
    .all() as Array<{ id: string; filePath: string }>;

  let updated = 0;
  const update = getDatabase().prepare(
    `UPDATE media_items SET thumbnail_path = ?, updated_at = ? WHERE id = ?`
  );

  for (const row of rows) {
    const thumbnailPath = findSiblingThumbnail(row.filePath);
    if (thumbnailPath) {
      update.run(thumbnailPath, new Date().toISOString(), row.id);
      updated += 1;
    }
  }

  return updated;
}