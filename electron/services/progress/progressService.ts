import { getDatabase } from "../db/client.js";

export type WatchProgress = {
  mediaId: string;
  positionSeconds: number;
  completed: boolean;
  updatedAt: string;
};

export function getProgress(mediaId: string): WatchProgress | null {
  const row = getDatabase()
    .prepare(
      `SELECT media_id AS mediaId, position_seconds AS positionSeconds, completed, updated_at AS updatedAt
       FROM watch_progress WHERE media_id = ?`
    )
    .get(mediaId) as
    | { mediaId: string; positionSeconds: number; completed: number; updatedAt: string }
    | undefined;

  if (!row) {
    return null;
  }

  return {
    mediaId: row.mediaId,
    positionSeconds: row.positionSeconds,
    completed: Boolean(row.completed),
    updatedAt: row.updatedAt
  };
}

export function updateProgress(input: {
  mediaId: string;
  position: number;
  duration: number | null;
}): WatchProgress {
  const { mediaId, position, duration } = input;
  const now = new Date().toISOString();

  const completed = duration !== null && duration > 0 && position >= 0.9 * duration;
  const storedPosition = completed ? 0 : position;

  getDatabase()
    .prepare(
      `INSERT INTO watch_progress (media_id, position_seconds, completed, updated_at)
       VALUES (@mediaId, @position, @completed, @updatedAt)
       ON CONFLICT(media_id) DO UPDATE SET
         position_seconds = @position,
         completed = @completed,
         updated_at = @updatedAt`
    )
    .run({
      mediaId,
      position: storedPosition,
      completed: completed ? 1 : 0,
      updatedAt: now
    });

  return {
    mediaId,
    positionSeconds: storedPosition,
    completed,
    updatedAt: now
  };
}