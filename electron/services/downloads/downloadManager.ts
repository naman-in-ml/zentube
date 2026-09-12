import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { addMediaItem } from "../library/libraryService.js";
import { createQueueJob } from "../queue/queueService.js";
import {
  ARCHIVE_FILE,
  buildDownloadArgs,
  DEFAULT_OUT_DIR,
  isMediaPath,
  type QualityPreset,
  type ResolvedEntry
} from "./ytdlp.js";

export type DownloadJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type DownloadJob = {
  id: string;
  entryId: string;
  title: string;
  url: string;
  quality: QualityPreset;
  playlistTitle: string | null;
  status: DownloadJobStatus;
  percent: number;
  speed: string | null;
  eta: string | null;
  outputPath: string | null;
  error: string | null;
};

export type StartDownloadInput = {
  entries: Array<Pick<ResolvedEntry, "id" | "title" | "url"> & { duration?: number | null }>;
  quality: QualityPreset;
  playlistTitle?: string | null;
};

const BIN = process.env.ZENTUBE_YTDLP_BIN ?? "yt-dlp";

const jobs = new Map<string, DownloadJob>();
const queue: string[] = [];
let activeId: string | null = null;
let activeProcess: ChildProcess | null = null;
let changeListener: ((jobs: DownloadJob[]) => void) | null = null;

export function onDownloadsChange(listener: (jobs: DownloadJob[]) => void): () => void {
  changeListener = listener;
  return () => {
    if (changeListener === listener) {
      changeListener = null;
    }
  };
}

export function listDownloads(): DownloadJob[] {
  return [...jobs.values()];
}

function emit() {
  changeListener?.([...jobs.values()]);
}

export function startDownloads(input: StartDownloadInput): string[] {
  const ids = input.entries.map((entry) => {
    const job: DownloadJob = {
      id: randomUUID(),
      entryId: entry.id,
      title: entry.title,
      url: entry.url,
      quality: input.quality,
      playlistTitle: input.playlistTitle ?? null,
      status: "queued",
      percent: 0,
      speed: null,
      eta: null,
      outputPath: null,
      error: null
    };
    jobs.set(job.id, job);
    queue.push(job.id);
    return job.id;
  });

  emit();
  runNext();
  return ids;
}

export function cancelDownload(jobId: string) {
  const job = jobs.get(jobId);
  if (!job || job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
    return;
  }

  if (job.status === "queued") {
    job.status = "cancelled";
    const index = queue.indexOf(jobId);
    if (index >= 0) {
      queue.splice(index, 1);
    }
    emit();
    return;
  }

  job.status = "cancelled";
  activeProcess?.kill("SIGTERM");
}

export function killAllDownloads() {
  activeProcess?.kill("SIGTERM");
}

function runNext() {
  if (activeId) {
    return;
  }

  const next = queue.shift();
  if (!next) {
    return;
  }

  const job = jobs.get(next);
  if (!job) {
    runNext();
    return;
  }

  activeId = job.id;
  job.status = "running";
  job.error = null;
  job.percent = 0;
  emit();

  const args = buildDownloadArgs({
    url: job.url,
    quality: job.quality,
    playlistTitle: job.playlistTitle
  });

  const child = spawn(BIN, args, { stdio: ["ignore", "pipe", "pipe"] });
  activeProcess = child;

  let stderrTail = "";

  child.stdout.on("data", (chunk: Buffer) => {
    const lines = chunk.toString().split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      if (line.startsWith("DT|")) {
        const [, percent, speed, eta] = line.split("|");
        const parsed = Number.parseFloat(percent);
        if (Number.isFinite(parsed)) {
          job.percent = parsed;
        }
        job.speed = speed && speed !== "NA" ? speed : null;
        job.eta = eta && eta !== "NA" ? eta : null;
      } else if (line.startsWith("[download]")) {
        const percent = line.match(/[0-9.]+%/);
        if (percent) {
          const parsed = Number.parseFloat(percent[0]);
          if (Number.isFinite(parsed)) {
            job.percent = parsed;
          }
        }
        const speed = line.match(/at\s+([0-9.]+[A-Za-z]+\/s)/);
        job.speed = speed ? speed[1] : null;
        const eta = line.match(/ETA\s+(\S+)/);
        job.eta = eta && eta[1] !== "Unknown" ? eta[1] : null;
      } else if (!job.outputPath && isMediaPath(line) && fs.existsSync(line)) {
        job.outputPath = line;
      }
    }
    emit();
  });

  child.stderr.on("data", (chunk: Buffer) => {
    stderrTail = (stderrTail + chunk.toString()).slice(-4000);
  });

  child.on("error", (error) => {
    activeProcess = null;
    activeId = null;
    job.status = "failed";
    job.error = error.message;
    emit();
    runNext();
  });

  child.on("close", (code) => {
    activeProcess = null;
    activeId = null;

    if (job.status === "cancelled") {
      emit();
      runNext();
      return;
    }

    if (code === 0) {
      job.status = "completed";
      job.percent = 100;
      job.error = null;
      if (!job.outputPath) {
        job.outputPath = findNewestFileIn(DEFAULT_OUT_DIR);
      }

      if (job.outputPath) {
        try {
          const metadata = readDownloadMetadata(job.outputPath);
          const media = addMediaItem(job.outputPath, metadata);
          createQueueJob({
            id: randomUUID(),
            type: "yt-download",
            status: "completed",
            input: job.url,
            outputMediaId: media.id,
            progress: 1
          });
        } catch (error) {
          job.error =
            error instanceof Error ? `Saved but not indexed: ${error.message}` : "Indexing failed";
        }
      }
    } else {
      job.status = "failed";
      job.error =
        stderrTail.trim().split("\n").slice(-2).join("\n") || `yt-dlp exited with code ${code}`;
    }

    emit();
    runNext();
  });

  emit();
}

function readDownloadMetadata(mediaPath: string): {
  durationSeconds: number | null;
  title: string | null;
} {
  const base = mediaPath.slice(0, -path.extname(mediaPath).length);
  const infoPath = `${base}.info.json`;
  const metadata: { durationSeconds: number | null; title: string | null } = {
    durationSeconds: null,
    title: null
  };

  try {
    const raw = fs.readFileSync(infoPath, "utf8");
    const data = JSON.parse(raw) as { duration?: unknown; title?: unknown };
    if (typeof data.duration === "number" && Number.isFinite(data.duration)) {
      metadata.durationSeconds = Math.round(data.duration);
    }
    if (typeof data.title === "string" && data.title.trim()) {
      metadata.title = data.title.trim();
    }
  } catch {
    return metadata;
  }

  return metadata;
}

function findNewestFileIn(directory: string): string | null {
  let newest: string | null = null;
  let newestMtime = 0;

  try {
    for (const name of fs.readdirSync(directory)) {
      if (name.endsWith(".part")) {
        continue;
      }
      const fullPath = path.join(directory, name);
      if (!isMediaPath(fullPath)) {
        continue;
      }
      const stat = fs.statSync(fullPath);
      if (stat.mtimeMs > newestMtime) {
        newestMtime = stat.mtimeMs;
        newest = fullPath;
      }
    }
  } catch {
    return null;
  }

  return newest;
}