import { shell } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDatabase } from "../db/client.js";
import { DEFAULT_OUT_DIR } from "../downloads/ytdlp.js";
import { deleteMediaItem } from "../library/libraryService.js";

export type StorageCategoryBreakdown = {
  bytes: number;
  count: number;
  formattedSize?: string;
};

export type StorageCourseItem = {
  id: string;
  name: string;
  coverThumbnail: string | null;
  videoCount: number;
  completedCount: number;
  totalSizeBytes: number;
  totalDurationSeconds: number;
  percentOfZentube: number;
};

export type CleanupItem = {
  id: string;
  title: string;
  filePath: string;
  fileSizeBytes: number;
  durationSeconds: number | null;
  thumbnailPath: string | null;
  addedAt: string;
  lastWatchedAt: string | null;
  completed: boolean;
  playlistTitle: string | null;
  progressPercent: number | null;
};

type CleanupRow = Omit<CleanupItem, "completed"> & {
  completed: number;
};

export type StorageSummary = {
  storageDirectory: string;
  totalDiskBytes: number;
  freeDiskBytes: number;
  usedDiskBytes: number;
  zentubeTotalBytes: number;
  breakdown: {
    video: StorageCategoryBreakdown;
    audio: StorageCategoryBreakdown;
    thumbnail: StorageCategoryBreakdown;
    subtitle: StorageCategoryBreakdown;
    metadata: StorageCategoryBreakdown;
    other: StorageCategoryBreakdown;
  };
  totalFiles: number;
  totalLibraryVideos: number;
  courses: StorageCourseItem[];
  cleanupCandidates: {
    completed: CleanupItem[];
    largest: CleanupItem[];
    stale: CleanupItem[];
  };
};

const VIDEO_EXTS = new Set([".mp4", ".mkv", ".webm", ".mov", ".avi", ".flv", ".ts", ".m4v"]);
const AUDIO_EXTS = new Set([".mp3", ".m4a", ".opus", ".wav", ".aac", ".flac", ".ogg", ".wma"]);
const THUMB_EXTS = new Set([".webp", ".jpg", ".jpeg", ".png", ".gif"]);
const SUB_EXTS = new Set([".vtt", ".srt", ".ass"]);
const META_EXTS = new Set([".json", ".txt"]);

export function getStorageSummary(customStorageDir?: string): StorageSummary {
  const db = getDatabase();
  const storageDir = customStorageDir || DEFAULT_OUT_DIR;

  // 1. System Drive Space using fs.statfsSync
  let totalDiskBytes = 0;
  let freeDiskBytes = 0;
  let usedDiskBytes = 0;

  try {
    const probePath = fs.existsSync(storageDir) ? storageDir : os.homedir();
    const stats = fs.statfsSync(probePath);
    totalDiskBytes = stats.blocks * stats.bsize;
    freeDiskBytes = stats.bfree * stats.bsize;
    usedDiskBytes = Math.max(0, totalDiskBytes - freeDiskBytes);
  } catch (err) {
    console.warn("Could not read statfs:", err);
  }

  // 2. Scan Zentube Directory (and tracked database files) for exact file breakdown
  const breakdown = {
    video: { bytes: 0, count: 0 },
    audio: { bytes: 0, count: 0 },
    thumbnail: { bytes: 0, count: 0 },
    subtitle: { bytes: 0, count: 0 },
    metadata: { bytes: 0, count: 0 },
    other: { bytes: 0, count: 0 }
  };

  const scannedPaths = new Set<string>();

  function processFile(filePath: string, size: number) {
    if (scannedPaths.has(filePath)) return;
    scannedPaths.add(filePath);

    const ext = path.extname(filePath).toLowerCase();
    if (VIDEO_EXTS.has(ext)) {
      breakdown.video.bytes += size;
      breakdown.video.count++;
    } else if (AUDIO_EXTS.has(ext)) {
      breakdown.audio.bytes += size;
      breakdown.audio.count++;
    } else if (THUMB_EXTS.has(ext)) {
      breakdown.thumbnail.bytes += size;
      breakdown.thumbnail.count++;
    } else if (SUB_EXTS.has(ext)) {
      breakdown.subtitle.bytes += size;
      breakdown.subtitle.count++;
    } else if (META_EXTS.has(ext)) {
      breakdown.metadata.bytes += size;
      breakdown.metadata.count++;
    } else {
      breakdown.other.bytes += size;
      breakdown.other.count++;
    }
  }

  // Read actual folder on disk if it exists
  if (fs.existsSync(storageDir)) {
    try {
      const dirEntries = fs.readdirSync(storageDir, { withFileTypes: true });
      for (const entry of dirEntries) {
        if (entry.isFile()) {
          const fullPath = path.join(storageDir, entry.name);
          try {
            const stat = fs.statSync(fullPath);
            processFile(fullPath, stat.size);
          } catch {
            // Ignore unreadable individual files
          }
        }
      }
    } catch (err) {
      console.warn("Could not scan Zentube dir:", err);
    }
  }

  // Also include any imported media items that live outside ~/Zentube
  const dbMediaRows = db
    .prepare("SELECT file_path AS filePath, file_size_bytes AS fileSizeBytes FROM media_items")
    .all() as Array<{ filePath: string; fileSizeBytes: number | null }>;

  for (const row of dbMediaRows) {
    if (row.filePath && !scannedPaths.has(row.filePath)) {
      try {
        if (fs.existsSync(row.filePath)) {
          const stat = fs.statSync(row.filePath);
          processFile(row.filePath, stat.size);
        } else if (row.fileSizeBytes) {
          processFile(row.filePath, row.fileSizeBytes);
        }
      } catch {
        if (row.fileSizeBytes) {
          processFile(row.filePath, row.fileSizeBytes);
        }
      }
    }
  }

  const zentubeTotalBytes =
    breakdown.video.bytes +
    breakdown.audio.bytes +
    breakdown.thumbnail.bytes +
    breakdown.subtitle.bytes +
    breakdown.metadata.bytes +
    breakdown.other.bytes;

  const totalFiles =
    breakdown.video.count +
    breakdown.audio.count +
    breakdown.thumbnail.count +
    breakdown.subtitle.count +
    breakdown.metadata.count +
    breakdown.other.count;

  // 3. Courses Storage Breakdown
  const courseRows = db
    .prepare(
      `SELECT p.id,
              p.name,
              COUNT(pi.media_id) AS videoCount,
              COALESCE(SUM(m.file_size_bytes), 0) AS totalSizeBytes,
              COALESCE(SUM(m.duration_seconds), 0) AS totalDurationSeconds,
              SUM(
                CASE
                  WHEN wp.completed = 1 OR (m.duration_seconds > 0 AND (wp.position_seconds / m.duration_seconds) >= 0.9)
                  THEN 1
                  ELSE 0
                END
              ) AS completedCount,
              (
                SELECT m2.thumbnail_path
                FROM playlist_items pi2
                JOIN media_items m2 ON m2.id = pi2.media_id
                WHERE pi2.playlist_id = p.id AND m2.thumbnail_path IS NOT NULL
                LIMIT 1
              ) AS coverThumbnail
       FROM playlists p
       LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
       LEFT JOIN media_items m ON m.id = pi.media_id
       LEFT JOIN watch_progress wp ON wp.media_id = m.id
       GROUP BY p.id
       ORDER BY totalSizeBytes DESC`
    )
    .all() as Array<{
      id: string;
      name: string;
      videoCount: number;
      totalSizeBytes: number;
      totalDurationSeconds: number;
      completedCount: number;
      coverThumbnail: string | null;
    }>;

  const courses: StorageCourseItem[] = courseRows.map((c) => ({
    ...c,
    percentOfZentube:
      zentubeTotalBytes > 0
        ? Math.min(100, Math.round((c.totalSizeBytes / zentubeTotalBytes) * 100))
        : 0
  }));

  // 4. Cleanup Recommendations
  // A. Completed Videos
  const completedRows = db
    .prepare(
      `SELECT m.id,
              m.title,
              m.file_path AS filePath,
              COALESCE(m.file_size_bytes, 0) AS fileSizeBytes,
              m.duration_seconds AS durationSeconds,
              m.thumbnail_path AS thumbnailPath,
              m.added_at AS addedAt,
              wp.updated_at AS lastWatchedAt,
              1 AS completed,
              p.name AS playlistTitle,
              100 AS progressPercent
       FROM media_items m
       JOIN watch_progress wp ON wp.media_id = m.id
       LEFT JOIN playlist_items pi ON pi.media_id = m.id
       LEFT JOIN playlists p ON p.id = pi.playlist_id
       WHERE wp.completed = 1 OR (m.duration_seconds > 0 AND (wp.position_seconds / m.duration_seconds) >= 0.9)
       ORDER BY m.file_size_bytes DESC`
    )
    .all() as CleanupRow[];

  // B. Largest Videos
  const largestRows = db
    .prepare(
      `SELECT m.id,
              m.title,
              m.file_path AS filePath,
              COALESCE(m.file_size_bytes, 0) AS fileSizeBytes,
              m.duration_seconds AS durationSeconds,
              m.thumbnail_path AS thumbnailPath,
              m.added_at AS addedAt,
              wp.updated_at AS lastWatchedAt,
              COALESCE(wp.completed, 0) AS completed,
              p.name AS playlistTitle,
              CASE
                WHEN wp.completed = 1 THEN 100
                WHEN m.duration_seconds > 0 AND wp.position_seconds > 0
                THEN ROUND((wp.position_seconds / m.duration_seconds) * 100)
                ELSE 0
              END AS progressPercent
       FROM media_items m
       LEFT JOIN watch_progress wp ON wp.media_id = m.id
       LEFT JOIN playlist_items pi ON pi.media_id = m.id
       LEFT JOIN playlists p ON p.id = pi.playlist_id
       ORDER BY m.file_size_bytes DESC
       LIMIT 30`
    )
    .all() as CleanupRow[];

  // C. Stale Videos (Older than 30 days, not watched in 30+ days)
  const staleRows = db
    .prepare(
      `SELECT m.id,
              m.title,
              m.file_path AS filePath,
              COALESCE(m.file_size_bytes, 0) AS fileSizeBytes,
              m.duration_seconds AS durationSeconds,
              m.thumbnail_path AS thumbnailPath,
              m.added_at AS addedAt,
              wp.updated_at AS lastWatchedAt,
              COALESCE(wp.completed, 0) AS completed,
              p.name AS playlistTitle,
              CASE
                WHEN wp.completed = 1 THEN 100
                WHEN m.duration_seconds > 0 AND wp.position_seconds > 0
                THEN ROUND((wp.position_seconds / m.duration_seconds) * 100)
                ELSE 0
              END AS progressPercent
       FROM media_items m
       LEFT JOIN watch_progress wp ON wp.media_id = m.id
       LEFT JOIN playlist_items pi ON pi.media_id = m.id
       LEFT JOIN playlists p ON p.id = pi.playlist_id
       WHERE datetime(m.added_at) <= datetime('now', '-30 days')
         AND (wp.updated_at IS NULL OR datetime(wp.updated_at) <= datetime('now', '-30 days'))
       ORDER BY m.file_size_bytes DESC`
    )
    .all() as CleanupRow[];

  const mapCleanup = (r: CleanupRow): CleanupItem => ({
    ...r,
    completed: Boolean(r.completed)
  });

  return {
    storageDirectory: storageDir,
    totalDiskBytes,
    freeDiskBytes,
    usedDiskBytes,
    zentubeTotalBytes,
    breakdown,
    totalFiles,
    totalLibraryVideos: dbMediaRows.length,
    courses,
    cleanupCandidates: {
      completed: completedRows.map(mapCleanup),
      largest: largestRows.map(mapCleanup),
      stale: staleRows.map(mapCleanup)
    }
  };
}

export function deleteStorageItems(
  mediaIds: string[],
  deleteFileFromDisk = true
): { deletedCount: number; reclaimedBytes: number } {
  const db = getDatabase();
  let deletedCount = 0;
  let reclaimedBytes = 0;

  for (const id of mediaIds) {
    const item = db
      .prepare("SELECT file_size_bytes AS fileSizeBytes FROM media_items WHERE id = ?")
      .get(id) as { fileSizeBytes: number | null } | undefined;

    if (item?.fileSizeBytes) {
      reclaimedBytes += item.fileSizeBytes;
    }

    const success = deleteMediaItem(id, deleteFileFromDisk);
    if (success) {
      deletedCount++;
    }
  }

  return { deletedCount, reclaimedBytes };
}

export async function openStorageDirectory(): Promise<boolean> {
  const target = fs.existsSync(DEFAULT_OUT_DIR) ? DEFAULT_OUT_DIR : os.homedir();
  const errorMsg = await shell.openPath(target);
  return !errorMsg;
}
