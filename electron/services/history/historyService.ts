import { randomUUID } from "node:crypto";
import { getDatabase } from "../db/client.js";

export type WatchHistoryEntry = {
  id: string;
  mediaId: string;
  mediaTitle: string;
  filePath: string;
  thumbnailPath: string | null;
  startedAt: string;
  stoppedAt: string;
  startPositionSeconds: number;
  stopPositionSeconds: number;
  durationSeconds: number | null;
  completed: boolean;
};

export type LogSessionInput = {
  mediaId: string;
  startedAt: string;
  stoppedAt: string;
  startPosition: number;
  stopPosition: number;
  duration?: number | null;
  completed?: boolean;
};

export function logWatchSession(input: LogSessionInput): string {
  const id = randomUUID();
  const db = getDatabase();

  db.prepare(
    `INSERT INTO watch_history
       (id, media_id, started_at, stopped_at, start_position_seconds, stop_position_seconds, duration_seconds, completed)
     VALUES
       (@id, @mediaId, @startedAt, @stoppedAt, @startPosition, @stopPosition, @duration, @completed)`
  ).run({
    id,
    mediaId: input.mediaId,
    startedAt: input.startedAt,
    stoppedAt: input.stoppedAt,
    startPosition: Math.max(0, input.startPosition),
    stopPosition: Math.max(0, input.stopPosition),
    duration: input.duration ?? null,
    completed: input.completed ? 1 : 0
  });

  return id;
}

export function listWatchHistory(limit = 100): WatchHistoryEntry[] {
  const db = getDatabase();

  const rows = db
    .prepare(
      `SELECT
         h.id,
         h.media_id AS mediaId,
         m.title AS mediaTitle,
         m.file_path AS filePath,
         m.thumbnail_path AS thumbnailPath,
         h.started_at AS startedAt,
         h.stopped_at AS stoppedAt,
         h.start_position_seconds AS startPositionSeconds,
         h.stop_position_seconds AS stopPositionSeconds,
         h.duration_seconds AS durationSeconds,
         h.completed
       FROM watch_history h
       JOIN media_items m ON m.id = h.media_id
       ORDER BY h.stopped_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
    id: string;
    mediaId: string;
    mediaTitle: string;
    filePath: string;
    thumbnailPath: string | null;
    startedAt: string;
    stoppedAt: string;
    startPositionSeconds: number;
    stopPositionSeconds: number;
    durationSeconds: number | null;
    completed: number;
  }>;

  return rows.map((r) => ({
    ...r,
    completed: Boolean(r.completed)
  }));
}

export function clearWatchHistory(): void {
  getDatabase().prepare(`DELETE FROM watch_history`).run();
}

export function deleteHistoryItem(id: string): void {
  getDatabase().prepare(`DELETE FROM watch_history WHERE id = ?`).run(id);
}
