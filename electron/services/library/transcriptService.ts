import fs from "node:fs";
import { getDatabase } from "../db/client.js";
import { findSiblingSubtitle } from "./libraryService.js";

export type MediaTranscriptResult = {
  hasTranscript: boolean;
  title: string;
  text: string | null;
};

export type PlaylistTranscriptResult = {
  hasTranscript: boolean;
  title: string;
  text: string | null;
  videoCount: number;
};

export function cleanVttTranscript(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const cleanedLines: string[] = [];
  let lastLine = "";

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Skip WEBVTT header and cues metadata
    if (
      line.startsWith("WEBVTT") ||
      line.startsWith("Kind:") ||
      line.startsWith("Language:") ||
      line.startsWith("NOTE") ||
      line.startsWith("STYLE")
    ) {
      continue;
    }

    // Skip timing line (e.g. 00:00:01.000 --> 00:00:04.000)
    if (line.includes("-->")) {
      continue;
    }

    // Skip numeric cue IDs
    if (/^\d+$/.test(line)) {
      continue;
    }

    // Strip HTML / styling tags e.g. <c.colorE5E5E5>, </c>, <00:00:01.000>
    line = line.replace(/<[^>]+>/g, "").trim();
    if (!line) continue;

    // Deduplicate consecutive identical lines (common in auto-generated captions)
    if (line === lastLine) {
      continue;
    }

    cleanedLines.push(line);
    lastLine = line;
  }

  return formatTranscriptParagraphs(cleanedLines);
}

function formatTranscriptParagraphs(lines: string[]): string {
  const fullText = lines.join(" ").replace(/\s+/g, " ");
  if (!fullText) return "";

  // Split into sentences (by .!?)
  const sentences = fullText.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [fullText];
  const paragraphs: string[] = [];
  let current: string[] = [];

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    current.push(trimmed);
    if (current.length >= 4) {
      paragraphs.push(current.join(" "));
      current = [];
    }
  }

  if (current.length > 0) {
    paragraphs.push(current.join(" "));
  }

  return paragraphs.join("\n\n");
}

export function getMediaTranscript(mediaId: string): MediaTranscriptResult {
  const db = getDatabase();
  const row = db
    .prepare("SELECT title, file_path AS filePath FROM media_items WHERE id = ?")
    .get(mediaId) as { title: string; filePath: string } | undefined;

  if (!row) {
    return { hasTranscript: false, title: "Unknown", text: null };
  }

  const subPath = findSiblingSubtitle(row.filePath);
  if (!subPath || !fs.existsSync(subPath)) {
    return { hasTranscript: false, title: row.title, text: null };
  }

  try {
    const raw = fs.readFileSync(subPath, "utf-8");
    const cleaned = cleanVttTranscript(raw);
    const formatted = `# ${row.title}\n\n${cleaned}`;
    return { hasTranscript: Boolean(cleaned), title: row.title, text: formatted };
  } catch {
    return { hasTranscript: false, title: row.title, text: null };
  }
}

export function getPlaylistTranscript(playlistId: string): PlaylistTranscriptResult {
  const db = getDatabase();
  const playlist = db
    .prepare("SELECT name, description FROM playlists WHERE id = ?")
    .get(playlistId) as { name: string; description: string | null } | undefined;

  if (!playlist) {
    return { hasTranscript: false, title: "Unknown", text: null, videoCount: 0 };
  }

  const items = db
    .prepare(
      `SELECT m.id, m.title, m.file_path AS filePath, pi.position
       FROM playlist_items pi
       JOIN media_items m ON m.id = pi.media_id
       WHERE pi.playlist_id = ?
       ORDER BY pi.position ASC`
    )
    .all(playlistId) as Array<{ id: string; title: string; filePath: string; position: number }>;

  const sections: string[] = [
    `# Course: ${playlist.name}`,
    playlist.description ? `Description: ${playlist.description}` : "",
    `Total Lessons: ${items.length}\n`
  ].filter(Boolean);

  let transcriptCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const subPath = findSiblingSubtitle(item.filePath);
    let body = "*(No transcript available for this lesson)*";

    if (subPath && fs.existsSync(subPath)) {
      try {
        const raw = fs.readFileSync(subPath, "utf-8");
        const cleaned = cleanVttTranscript(raw);
        if (cleaned) {
          body = cleaned;
          transcriptCount++;
        }
      } catch {
        // Keep fallback body
      }
    }

    sections.push(`---\n\n## Lesson ${item.position || i + 1}: ${item.title}\n\n${body}`);
  }

  return {
    hasTranscript: transcriptCount > 0,
    title: playlist.name,
    text: sections.join("\n\n"),
    videoCount: items.length
  };
}
