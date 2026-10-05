import { randomUUID } from "node:crypto";
import { getDatabase } from "../db/client.js";

export type Playlist = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
};

export type PlaylistItem = {
  playlistId: string;
  mediaId: string;
  position: number;
  addedAt: string;
  title: string;
  filePath: string;
  fileSizeBytes: number | null;
  durationSeconds: number | null;
  thumbnailPath: string | null;
  progressPercent: number | null;
  progressCompleted: boolean;
};

export type PlaylistSummary = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  itemCount: number;
  completedCount: number;
  totalDurationSeconds: number;
  coverThumbnail: string | null;
};

export type PlaylistDetails = {
  playlist: Playlist;
  items: PlaylistItem[];
};

export function listPlaylists(): Playlist[] {
  return getDatabase()
    .prepare(
      `SELECT id, name, description, created_at AS createdAt
       FROM playlists
       ORDER BY created_at DESC`
    )
    .all() as Playlist[];
}

export function createPlaylist(input: { name: string; description?: string }): Playlist {
  const now = new Date().toISOString();
  const playlist: Playlist = {
    id: randomUUID(),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    createdAt: now
  };

  getDatabase()
    .prepare(
      `INSERT INTO playlists (id, name, description, created_at, updated_at)
       VALUES (@id, @name, @description, @createdAt, @createdAt)`
    )
    .run(playlist);

  return playlist;
}

export function getOrCreatePlaylist(name: string, description?: string): Playlist {
  const trimmed = name.trim();
  const db = getDatabase();
  const existing = db
    .prepare(
      `SELECT id, name, description, created_at AS createdAt
       FROM playlists
       WHERE LOWER(name) = LOWER(?)
       LIMIT 1`
    )
    .get(trimmed) as Playlist | undefined;

  if (existing) {
    return existing;
  }

  return createPlaylist({ name: trimmed, description });
}

export function addItemToPlaylist(
  playlistId: string,
  mediaId: string,
  customPosition?: number
): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  let position = customPosition;
  if (position === undefined || position === null) {
    const row = db
      .prepare(
        `SELECT COALESCE(MAX(position), -1) + 1 AS nextPos
         FROM playlist_items
         WHERE playlist_id = ?`
      )
      .get(playlistId) as { nextPos: number } | undefined;
    position = row?.nextPos ?? 0;
  }

  db.prepare(
    `INSERT INTO playlist_items (playlist_id, media_id, position, added_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(playlist_id, media_id) DO UPDATE SET position = excluded.position`
  ).run(playlistId, mediaId, position, now);
}

export function removeItemFromPlaylist(playlistId: string, mediaId: string): void {
  getDatabase()
    .prepare(`DELETE FROM playlist_items WHERE playlist_id = ? AND media_id = ?`)
    .run(playlistId, mediaId);
}

export function deletePlaylist(playlistId: string): void {
  getDatabase().prepare(`DELETE FROM playlists WHERE id = ?`).run(playlistId);
}

export function getPlaylistDetails(playlistId: string): PlaylistDetails | null {
  const db = getDatabase();

  const playlist = db
    .prepare(
      `SELECT id, name, description, created_at AS createdAt
       FROM playlists
       WHERE id = ?`
    )
    .get(playlistId) as Playlist | undefined;

  if (!playlist) {
    return null;
  }

  const rows = db
    .prepare(
      `SELECT
         pi.playlist_id AS playlistId,
         pi.media_id AS mediaId,
         pi.position,
         pi.added_at AS addedAt,
         m.title,
         m.file_path AS filePath,
         m.file_size_bytes AS fileSizeBytes,
         m.duration_seconds AS durationSeconds,
         m.thumbnail_path AS thumbnailPath,
         wp.position_seconds AS progressPosition,
         wp.completed AS progressCompleted
       FROM playlist_items pi
       JOIN media_items m ON m.id = pi.media_id
       LEFT JOIN watch_progress wp ON wp.media_id = m.id
       WHERE pi.playlist_id = ?
       ORDER BY pi.position ASC, pi.added_at ASC`
    )
    .all(playlistId) as Array<{
    playlistId: string;
    mediaId: string;
    position: number;
    addedAt: string;
    title: string;
    filePath: string;
    fileSizeBytes: number | null;
    durationSeconds: number | null;
    thumbnailPath: string | null;
    progressPosition: number | null;
    progressCompleted: number | null;
  }>;

  const items: PlaylistItem[] = rows.map((r) => {
    let progressPercent: number | null = null;
    if (r.progressCompleted) {
      progressPercent = 100;
    } else if (r.durationSeconds && r.progressPosition && r.progressPosition > 0) {
      progressPercent = Math.min(99, Math.round((r.progressPosition / r.durationSeconds) * 100));
    }

    return {
      playlistId: r.playlistId,
      mediaId: r.mediaId,
      position: r.position,
      addedAt: r.addedAt,
      title: r.title,
      filePath: r.filePath,
      fileSizeBytes: r.fileSizeBytes,
      durationSeconds: r.durationSeconds,
      thumbnailPath: r.thumbnailPath,
      progressPercent,
      progressCompleted: Boolean(r.progressCompleted)
    };
  });

  return { playlist, items };
}

export function listPlaylistsWithSummary(): PlaylistSummary[] {
  const db = getDatabase();

  const rows = db
    .prepare(
      `SELECT
         p.id,
         p.name,
         p.description,
         p.created_at AS createdAt,
         COUNT(pi.media_id) AS itemCount,
         SUM(CASE WHEN wp.completed = 1 THEN 1 ELSE 0 END) AS completedCount,
         COALESCE(SUM(m.duration_seconds), 0) AS totalDurationSeconds,
         (
           SELECT m2.thumbnail_path
           FROM playlist_items pi2
           JOIN media_items m2 ON m2.id = pi2.media_id
           WHERE pi2.playlist_id = p.id AND m2.thumbnail_path IS NOT NULL
           ORDER BY pi2.position ASC
           LIMIT 1
         ) AS coverThumbnail
       FROM playlists p
       LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
       LEFT JOIN media_items m ON m.id = pi.media_id
       LEFT JOIN watch_progress wp ON wp.media_id = m.id
       GROUP BY p.id
       ORDER BY p.created_at DESC`
    )
    .all() as Array<{
    id: string;
    name: string;
    description: string | null;
    createdAt: string;
    itemCount: number;
    completedCount: number;
    totalDurationSeconds: number;
    coverThumbnail: string | null;
  }>;

  return rows.map((r) => ({
    ...r,
    itemCount: Number(r.itemCount || 0),
    completedCount: Number(r.completedCount || 0),
    totalDurationSeconds: Number(r.totalDurationSeconds || 0)
  }));
}
