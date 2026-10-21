import { getDatabase } from "../db/client.js";
import { listGoals, type GoalSummary } from "../goals/goalsService.js";

export type DashboardSummary = {
  continueLearning: {
    id: string;
    title: string;
    thumbnailPath: string | null;
    positionSeconds: number;
    durationSeconds: number | null;
    progressPercent: number;
    playlistTitle: string | null;
    updatedAt: string;
  } | null;
  upNext: {
    id: string;
    title: string;
    thumbnailPath: string | null;
    durationSeconds: number | null;
    playlistTitle: string | null;
    reason: string;
  } | null;
  goals: GoalSummary[];
  stats: {
    todayMinutes: number;
    weekMinutes: number;
    completedVideosCount: number;
    totalLibraryVideos: number;
    totalLibraryHours: number;
  };
};

export function getDashboardSummary(): DashboardSummary {
  const db = getDatabase();

  // 1. Continue Learning: Most recent in-progress item
  const inProgressRow = db
    .prepare(
      `SELECT m.id, m.title, m.thumbnail_path AS thumbnailPath, m.duration_seconds AS durationSeconds,
              wp.position_seconds AS positionSeconds, wp.updated_at AS updatedAt
       FROM watch_progress wp
       JOIN media_items m ON m.id = wp.media_id
       WHERE wp.completed = 0 AND wp.position_seconds > 5
       ORDER BY wp.updated_at DESC
       LIMIT 1`
    )
    .get() as {
      id: string;
      title: string;
      thumbnailPath: string | null;
      durationSeconds: number | null;
      positionSeconds: number;
      updatedAt: string;
    } | undefined;

  let continueLearning: DashboardSummary["continueLearning"] = null;

  if (inProgressRow) {
    const playlistRow = db
      .prepare(
        `SELECT p.name
         FROM playlist_items pi
         JOIN playlists p ON p.id = pi.playlist_id
         WHERE pi.media_id = ?
         LIMIT 1`
      )
      .get(inProgressRow.id) as { name: string } | undefined;

    const duration = inProgressRow.durationSeconds ?? 0;
    const progressPercent = duration > 0 ? Math.min(100, Math.round((inProgressRow.positionSeconds / duration) * 100)) : 0;

    continueLearning = {
      id: inProgressRow.id,
      title: inProgressRow.title,
      thumbnailPath: inProgressRow.thumbnailPath,
      positionSeconds: inProgressRow.positionSeconds,
      durationSeconds: inProgressRow.durationSeconds,
      progressPercent,
      playlistTitle: playlistRow?.name ?? null,
      updatedAt: inProgressRow.updatedAt
    };
  }

  // 2. Fetch all goals
  const goals = listGoals();

  // 3. Up Next Resolution
  let upNext: DashboardSummary["upNext"] = null;

  // A. From the top goal that has an upNextMedia
  for (const goal of goals) {
    if (goal.upNextMedia) {
      upNext = {
        id: goal.upNextMedia.id,
        title: goal.upNextMedia.title,
        thumbnailPath: goal.upNextMedia.thumbnailPath,
        durationSeconds: goal.upNextMedia.durationSeconds,
        playlistTitle: goal.upNextMedia.playlistTitle,
        reason: `Up next in goal "${goal.title}"`
      };
      break;
    }
  }

  // B. If not in a goal, check if continueLearning is part of a playlist and find next sequential episode
  if (!upNext && continueLearning) {
    const nextEpisode = db
      .prepare(
        `SELECT m.id, m.title, m.thumbnail_path AS thumbnailPath, m.duration_seconds AS durationSeconds, p.name AS playlistTitle
         FROM playlist_items pi_curr
         JOIN playlist_items pi_next ON pi_next.playlist_id = pi_curr.playlist_id AND pi_next.position = pi_curr.position + 1
         JOIN media_items m ON m.id = pi_next.media_id
         JOIN playlists p ON p.id = pi_curr.playlist_id
         LEFT JOIN watch_progress wp ON wp.media_id = m.id
         WHERE pi_curr.media_id = ? AND (wp.completed IS NULL OR wp.completed = 0)
         LIMIT 1`
      )
      .get(continueLearning.id) as {
        id: string;
        title: string;
        thumbnailPath: string | null;
        durationSeconds: number | null;
        playlistTitle: string;
      } | undefined;

    if (nextEpisode) {
      upNext = {
        id: nextEpisode.id,
        title: nextEpisode.title,
        thumbnailPath: nextEpisode.thumbnailPath,
        durationSeconds: nextEpisode.durationSeconds,
        playlistTitle: nextEpisode.playlistTitle,
        reason: `Next in "${nextEpisode.playlistTitle}"`
      };
    }
  }

  // C. Fallback: First uncompleted media item in library
  if (!upNext) {
    const unstarted = db
      .prepare(
        `SELECT m.id, m.title, m.thumbnail_path AS thumbnailPath, m.duration_seconds AS durationSeconds
         FROM media_items m
         LEFT JOIN watch_progress wp ON wp.media_id = m.id
         WHERE wp.media_id IS NULL OR wp.completed = 0
         ORDER BY m.added_at DESC
         LIMIT 1`
      )
      .get() as { id: string; title: string; thumbnailPath: string | null; durationSeconds: number | null } | undefined;

    if (unstarted) {
      upNext = {
        id: unstarted.id,
        title: unstarted.title,
        thumbnailPath: unstarted.thumbnailPath,
        durationSeconds: unstarted.durationSeconds,
        playlistTitle: null,
        reason: "Recommended next lesson"
      };
    }
  }

  // 4. Learning Stats
  const todayRow = db
    .prepare(
      `SELECT COALESCE(SUM(duration_seconds), 0) AS totalSec
       FROM watch_history
       WHERE date(started_at, 'localtime') = date('now', 'localtime')`
    )
    .get() as { totalSec: number };

  const weekRow = db
    .prepare(
      `SELECT COALESCE(SUM(duration_seconds), 0) AS totalSec
       FROM watch_history
       WHERE datetime(started_at, 'localtime') >= datetime('now', '-7 days', 'localtime')`
    )
    .get() as { totalSec: number };

  const completedCountRow = db
    .prepare("SELECT COUNT(*) AS count FROM watch_progress WHERE completed = 1")
    .get() as { count: number };

  const libraryStats = db
    .prepare(
      `SELECT COUNT(*) AS totalVideos, COALESCE(SUM(duration_seconds), 0) AS totalDurationSec
       FROM media_items`
    )
    .get() as { totalVideos: number; totalDurationSec: number };

  return {
    continueLearning,
    upNext,
    goals,
    stats: {
      todayMinutes: Math.round(todayRow.totalSec / 60),
      weekMinutes: Math.round(weekRow.totalSec / 60),
      completedVideosCount: completedCountRow.count,
      totalLibraryVideos: libraryStats.totalVideos,
      totalLibraryHours: Math.round((libraryStats.totalDurationSec / 3600) * 10) / 10
    }
  };
}
