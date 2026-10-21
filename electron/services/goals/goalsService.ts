import { randomUUID } from "node:crypto";
import { getDatabase } from "../db/client.js";

export type Goal = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  targetHours: number | null;
  createdAt: string;
  updatedAt: string;
};

export type GoalItem = {
  goalId: string;
  itemType: "playlist" | "media";
  itemId: string;
  position: number;
  addedAt: string;
  title: string;
  thumbnailPath: string | null;
  itemCount?: number;
  completedCount?: number;
};

export type GoalSummary = Goal & {
  totalMediaCount: number;
  completedMediaCount: number;
  progressPercent: number;
  items: GoalItem[];
  upNextMedia: {
    id: string;
    title: string;
    thumbnailPath: string | null;
    durationSeconds: number | null;
    playlistTitle: string | null;
  } | null;
};

export function createGoal(input: {
  title: string;
  description?: string | null;
  icon?: string | null;
  targetHours?: number | null;
}): Goal {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO goals (id, title, description, icon, target_hours, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.title.trim(),
    input.description?.trim() || null,
    input.icon || null,
    input.targetHours || null,
    now,
    now
  );

  return {
    id,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    icon: input.icon || null,
    targetHours: input.targetHours || null,
    createdAt: now,
    updatedAt: now
  };
}

export function updateGoal(input: {
  id: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  targetHours?: number | null;
}): Goal {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE goals
     SET title = ?, description = ?, icon = ?, target_hours = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    input.title.trim(),
    input.description?.trim() || null,
    input.icon || null,
    input.targetHours || null,
    now,
    input.id
  );

  const updated = db
    .prepare(
      `SELECT id, title, description, icon, target_hours AS targetHours, created_at AS createdAt, updated_at AS updatedAt
       FROM goals WHERE id = ?`
    )
    .get(input.id) as Goal;

  return updated;
}

export function deleteGoal(id: string): void {
  getDatabase().prepare("DELETE FROM goals WHERE id = ?").run(id);
}

export function addGoalItem(
  goalId: string,
  itemType: "playlist" | "media",
  itemId: string,
  position?: number
): void {
  const db = getDatabase();
  const now = new Date().toISOString();

  let targetPosition = position;
  if (typeof targetPosition !== "number") {
    const max = db
      .prepare("SELECT COALESCE(MAX(position), -1) AS maxPos FROM goal_items WHERE goal_id = ?")
      .get(goalId) as { maxPos: number };
    targetPosition = max.maxPos + 1;
  }

  db.prepare(
    `INSERT INTO goal_items (goal_id, item_type, item_id, position, added_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(goal_id, item_type, item_id) DO UPDATE SET position = excluded.position`
  ).run(goalId, itemType, itemId, targetPosition, now);

  db.prepare("UPDATE goals SET updated_at = ? WHERE id = ?").run(now, goalId);
}

export function removeGoalItem(goalId: string, itemType: "playlist" | "media", itemId: string): void {
  const db = getDatabase();
  db.prepare("DELETE FROM goal_items WHERE goal_id = ? AND item_type = ? AND item_id = ?").run(
    goalId,
    itemType,
    itemId
  );
  db.prepare("UPDATE goals SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), goalId);
}

export function listGoals(): GoalSummary[] {
  const db = getDatabase();

  const goals = db
    .prepare(
      `SELECT id, title, description, icon, target_hours AS targetHours, created_at AS createdAt, updated_at AS updatedAt
       FROM goals
       ORDER BY updated_at DESC`
    )
    .all() as Goal[];

  return goals.map((goal) => getGoalSummary(goal.id, goal));
}

export function getGoalDetails(goalId: string): GoalSummary | null {
  const db = getDatabase();
  const goal = db
    .prepare(
      `SELECT id, title, description, icon, target_hours AS targetHours, created_at AS createdAt, updated_at AS updatedAt
       FROM goals WHERE id = ?`
    )
    .get(goalId) as Goal | undefined;

  if (!goal) return null;
  return getGoalSummary(goalId, goal);
}

function getGoalSummary(goalId: string, existingGoal?: Goal): GoalSummary {
  const db = getDatabase();
  const goal =
    existingGoal ??
    (db
      .prepare(
        `SELECT id, title, description, icon, target_hours AS targetHours, created_at AS createdAt, updated_at AS updatedAt
         FROM goals WHERE id = ?`
      )
      .get(goalId) as Goal);

  const rawItems = db
    .prepare(
      `SELECT gi.item_type AS itemType, gi.item_id AS itemId, gi.position, gi.added_at AS addedAt
       FROM goal_items gi
       WHERE gi.goal_id = ?
       ORDER BY gi.position ASC`
    )
    .all(goalId) as Array<{ itemType: "playlist" | "media"; itemId: string; position: number; addedAt: string }>;

  const items: GoalItem[] = [];
  const mediaIdMap = new Map<string, { playlistTitle: string | null }>();

  for (const raw of rawItems) {
    if (raw.itemType === "playlist") {
      const pl = db
        .prepare("SELECT id, name FROM playlists WHERE id = ?")
        .get(raw.itemId) as { id: string; name: string } | undefined;

      if (pl) {
        const plMedia = db
          .prepare(
            `SELECT m.id, m.thumbnail_path AS thumbnailPath
             FROM playlist_items pi
             JOIN media_items m ON m.id = pi.media_id
             WHERE pi.playlist_id = ?
             ORDER BY pi.position ASC`
          )
          .all(raw.itemId) as Array<{ id: string; thumbnailPath: string | null }>;

        for (const m of plMedia) {
          if (!mediaIdMap.has(m.id)) {
            mediaIdMap.set(m.id, { playlistTitle: pl.name });
          }
        }

        const firstThumb = plMedia[0]?.thumbnailPath ?? null;
        items.push({
          goalId,
          itemType: "playlist",
          itemId: raw.itemId,
          position: raw.position,
          addedAt: raw.addedAt,
          title: pl.name,
          thumbnailPath: firstThumb,
          itemCount: plMedia.length
        });
      }
    } else {
      const media = db
        .prepare("SELECT id, title, thumbnail_path AS thumbnailPath FROM media_items WHERE id = ?")
        .get(raw.itemId) as { id: string; title: string; thumbnailPath: string | null } | undefined;

      if (media) {
        if (!mediaIdMap.has(media.id)) {
          mediaIdMap.set(media.id, { playlistTitle: null });
        }
        items.push({
          goalId,
          itemType: "media",
          itemId: raw.itemId,
          position: raw.position,
          addedAt: raw.addedAt,
          title: media.title,
          thumbnailPath: media.thumbnailPath,
          itemCount: 1
        });
      }
    }
  }

  // Calculate completion for all unique media IDs in this goal
  const uniqueMediaIds = [...mediaIdMap.keys()];
  let completedCount = 0;
  let upNextMedia: GoalSummary["upNextMedia"] = null;

  if (uniqueMediaIds.length > 0) {
    const placeholders = uniqueMediaIds.map(() => "?").join(",");
    const progressList = db
      .prepare(
        `SELECT m.id, m.title, m.thumbnail_path AS thumbnailPath, m.duration_seconds AS durationSeconds,
                wp.position_seconds AS positionSeconds, wp.completed
         FROM media_items m
         LEFT JOIN watch_progress wp ON wp.media_id = m.id
         WHERE m.id IN (${placeholders})`
      )
      .all(...uniqueMediaIds) as Array<{
        id: string;
        title: string;
        thumbnailPath: string | null;
        durationSeconds: number | null;
        positionSeconds: number | null;
        completed: number | null;
      }>;

    const progressMap = new Map(progressList.map((p) => [p.id, p]));

    for (const mediaId of uniqueMediaIds) {
      const prog = progressMap.get(mediaId);
      const isCompleted =
        Boolean(prog?.completed) ||
        (Boolean(prog?.positionSeconds && prog?.durationSeconds) &&
          (prog?.positionSeconds ?? 0) / (prog?.durationSeconds ?? 1) >= 0.9);

      if (isCompleted) {
        completedCount++;
      } else if (!upNextMedia && prog) {
        upNextMedia = {
          id: prog.id,
          title: prog.title,
          thumbnailPath: prog.thumbnailPath,
          durationSeconds: prog.durationSeconds,
          playlistTitle: mediaIdMap.get(prog.id)?.playlistTitle ?? null
        };
      }
    }
  }

  const totalMediaCount = uniqueMediaIds.length;
  const progressPercent = totalMediaCount > 0 ? Math.round((completedCount / totalMediaCount) * 100) : 0;

  return {
    ...goal,
    totalMediaCount,
    completedMediaCount: completedCount,
    progressPercent,
    items,
    upNextMedia
  };
}
