import { spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export type QualityPreset = "best" | "1080" | "720" | "480";

export const QUALITY_PRESETS: QualityPreset[] = ["best", "1080", "720", "480"];

export type ResolvedEntry = {
  id: string;
  title: string;
  duration: number | null;
  url: string;
};

export type ResolveResult = {
  title: string | null;
  isPlaylist: boolean;
  entries: ResolvedEntry[];
};

export const DEFAULT_OUT_DIR = path.join(os.homedir(), "Zentube");
export const ARCHIVE_FILE = path.join(DEFAULT_OUT_DIR, ".zarchiv.txt");

const BIN = process.env.ZENTUBE_YTDLP_BIN ?? "yt-dlp";

const MEDIA_EXTENSIONS = new Set([
  ".mp4",
  ".mkv",
  ".webm",
  ".mov",
  ".mp3",
  ".m4a",
  ".opus"
]);

export function formatSelector(quality: QualityPreset): string {
  switch (quality) {
    case "1080":
      return "bv*[height<=1080]+ba/b";
    case "720":
      return "bv*[height<=720]+ba/b";
    case "480":
      return "bv*[height<=480]+ba/b";
    case "best":
    default:
      return "bv*+ba/b";
  }
}

export function isMediaPath(filePath: string): boolean {
  return MEDIA_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function checkTools(): {
  ytDlp: boolean;
  ytDlpVersion: string | null;
  ffmpeg: boolean;
} {
  const ytDlp = spawnSync(BIN, ["--version"], { timeout: 10000, encoding: "utf8" });
  const ffmpeg = spawnSync("ffmpeg", ["-version"], { timeout: 10000, encoding: "utf8" });

  return {
    ytDlp: ytDlp.status === 0,
    ytDlpVersion: ytDlp.status === 0 ? ytDlp.stdout.trim().split("\n")[0] : null,
    ffmpeg: ffmpeg.status === 0
  };
}

export function resolveUrl(input: string): Promise<ResolveResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      BIN,
      ["-J", "--flat-playlist", "--no-warnings", "--no-color", input],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    let out = "";
    let err = "";

    child.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      err += chunk.toString();
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 30_000);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`yt-dlp failed to start: ${error.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(trimFallback(err, `yt-dlp exited with code ${code}`)));
        return;
      }

      try {
        resolve(normalize(JSON.parse(out), input));
      } catch {
        reject(new Error(`Could not parse yt-dlp output: ${trimFallback(err, "")}`));
      }
    });
  });
}

export function buildDownloadArgs(options: {
  url: string;
  quality: QualityPreset;
  playlistTitle: string | null | undefined;
}): string[] {
  mkdirSync(DEFAULT_OUT_DIR, { recursive: true });

  const prefix = options.playlistTitle ? `${safeSegment(options.playlistTitle)} - ` : "";
  const template = path.join(DEFAULT_OUT_DIR, `${prefix}%(title)s [%(id)s].%(ext)s`);

  return [
    "--no-warnings",
    "--no-color",
    "--newline",
    "--progress",
    "--continue",
    "--no-playlist",
    "--ignore-errors",
    "--write-thumbnail",
    "--write-subs",
    "--sub-langs",
    "en.*,en",
    "--write-info-json",
    "--download-archive",
    ARCHIVE_FILE,
    "--print",
    "after_move:filepath",
    "-f",
    formatSelector(options.quality),
    "-o",
    template,
    options.url
  ];
}

function normalize(data: Record<string, unknown>, originalUrl: string): ResolveResult {
  const entries = data.entries;

  if (Array.isArray(entries)) {
    return {
      title: typeof data.title === "string" ? data.title : "Playlist",
      isPlaylist: true,
      entries: entries.map((entry) => toEntry(entry as Record<string, unknown>, originalUrl))
    };
  }

  return {
    title: typeof data.title === "string" ? data.title : "Video",
    isPlaylist: false,
    entries: [toEntry(data, originalUrl)]
  };
}

function toEntry(data: Record<string, unknown>, originalUrl: string): ResolvedEntry {
  const id = typeof data.id === "string" ? data.id : "";
  const title = typeof data.title === "string" ? data.title : "Untitled";
  const duration =
    typeof data.duration === "number" && Number.isFinite(data.duration) ? data.duration : null;
  const url =
    (typeof data.webpage_url === "string" && data.webpage_url) ||
    (typeof data.url === "string" && data.url) ||
    fallbackUrl(id, originalUrl);

  return { id, title, duration, url };
}

function fallbackUrl(id: string, originalUrl: string): string {
  if (id) {
    return `https://www.youtube.com/watch?v=${id}`;
  }
  return originalUrl;
}

function safeSegment(title: string): string {
  return title
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function trimFallback(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed || fallback;
}