import { randomUUID } from "node:crypto";
import { getDatabase } from "../db/client.js";

export type Playlist = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
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
    name: input.name,
    description: input.description ?? null,
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
