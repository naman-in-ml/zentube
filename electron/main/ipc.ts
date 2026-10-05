import { BrowserWindow, dialog, app, ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  cancelDownload,
  listDownloads,
  onDownloadsChange,
  startDownloads
} from "../services/downloads/downloadManager.js";
import { checkTools, resolveUrl } from "../services/downloads/ytdlp.js";
import {
  clearWatchHistory,
  deleteHistoryItem,
  listWatchHistory,
  logWatchSession
} from "../services/history/historyService.js";
import { addMediaItem, listMediaItems } from "../services/library/libraryService.js";
import {
  addItemToPlaylist,
  createPlaylist,
  deletePlaylist,
  getPlaylistDetails,
  listPlaylists,
  listPlaylistsWithSummary,
  removeItemFromPlaylist
} from "../services/playlists/playlistService.js";
import { getProgress, updateProgress } from "../services/progress/progressService.js";
import { createQueueJob, listQueueJobs } from "../services/queue/queueService.js";
import { registerUpdateIpcHandlers } from "../services/updates/updaterService.js";

const createPlaylistSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional()
});

const resolveUrlSchema = z.object({
  url: z.string().min(8)
});

const startDownloadSchema = z.object({
  entries: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        duration: z.number().nullable().optional(),
        url: z.string().min(8)
      })
    )
    .min(1)
    .max(5000),
  quality: z.enum(["best", "1080", "720", "480", "audio"]),
  playlistTitle: z.string().max(200).nullable().optional()
});

export function registerIpcHandlers() {
  ipcMain.handle("app:getVersion", () => app.getVersion());

  ipcMain.handle("library:list", () => listMediaItems());

  ipcMain.handle("library:importFiles", async () => {
    const result = await dialog.showOpenDialog({
      title: "Import media",
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Media",
          extensions: ["mp4", "mkv", "webm", "mov", "mp3", "m4a", "opus"]
        }
      ]
    });

    if (result.canceled) {
      return [];
    }

    return result.filePaths.map((filePath) => {
      const media = addMediaItem(filePath);
      createQueueJob({
        id: randomUUID(),
        type: "import-file",
        status: "completed",
        input: filePath,
        outputMediaId: media.id,
        progress: 1
      });
      return media;
    });
  });

  ipcMain.handle("playlists:list", () => listPlaylists());

  ipcMain.handle("playlists:listWithSummary", () => listPlaylistsWithSummary());

  ipcMain.handle("playlists:getDetails", (_event, raw: unknown) => {
    const { playlistId } = z.object({ playlistId: z.string().uuid() }).parse(raw);
    return getPlaylistDetails(playlistId);
  });

  ipcMain.handle("playlists:create", (_event, input: unknown) => {
    const payload = createPlaylistSchema.parse(input);
    return createPlaylist(payload);
  });

  ipcMain.handle("playlists:delete", (_event, raw: unknown) => {
    const { playlistId } = z.object({ playlistId: z.string().uuid() }).parse(raw);
    deletePlaylist(playlistId);
    return true;
  });

  ipcMain.handle("playlists:addItem", (_event, raw: unknown) => {
    const { playlistId, mediaId } = z
      .object({ playlistId: z.string().uuid(), mediaId: z.string().uuid() })
      .parse(raw);
    addItemToPlaylist(playlistId, mediaId);
    return true;
  });

  ipcMain.handle("playlists:removeItem", (_event, raw: unknown) => {
    const { playlistId, mediaId } = z
      .object({ playlistId: z.string().uuid(), mediaId: z.string().uuid() })
      .parse(raw);
    removeItemFromPlaylist(playlistId, mediaId);
    return true;
  });

  const mediaIdSchema = z.object({ mediaId: z.string().uuid() });

  ipcMain.handle("progress:get", (_event, raw: unknown) => {
    const { mediaId } = mediaIdSchema.parse(raw);
    return getProgress(mediaId);
  });

  ipcMain.handle("progress:update", (_event, raw: unknown) => {
    const input = z
      .object({
        mediaId: z.string().uuid(),
        position: z.number().finite().min(0),
        duration: z.number().finite().positive().nullable().optional()
      })
      .parse(raw);
    return updateProgress({
      mediaId: input.mediaId,
      position: input.position,
      duration: input.duration ?? null
    });
  });

  ipcMain.handle("history:log", (_event, raw: unknown) => {
    const input = z
      .object({
        mediaId: z.string().uuid(),
        startedAt: z.string(),
        stoppedAt: z.string(),
        startPosition: z.number().finite().min(0),
        stopPosition: z.number().finite().min(0),
        duration: z.number().finite().positive().nullable().optional(),
        completed: z.boolean().optional()
      })
      .parse(raw);
    return logWatchSession(input);
  });

  ipcMain.handle("history:list", (_event, raw: unknown) => {
    const limit = typeof raw === "number" && raw > 0 ? raw : 100;
    return listWatchHistory(limit);
  });

  ipcMain.handle("history:clear", () => {
    clearWatchHistory();
    return true;
  });

  ipcMain.handle("history:delete", (_event, raw: unknown) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(raw);
    deleteHistoryItem(id);
    return true;
  });

  ipcMain.handle("queue:list", () => listQueueJobs());

  ipcMain.handle("downloads:checkTools", () => checkTools());

  ipcMain.handle("downloads:resolve", async (_event, raw: unknown) => {
    const { url } = resolveUrlSchema.parse(raw);
    const result = await resolveUrl(url);
    const unique = new Map<string, typeof result.entries[number]>();
    for (const entry of result.entries) {
      unique.set(entry.id || entry.url, entry);
    }
    return { ...result, entries: [...unique.values()] };
  });

  ipcMain.handle("downloads:start", (_event, raw: unknown) => {
    const input = startDownloadSchema.parse(raw);
    return startDownloads(input);
  });

  ipcMain.handle("downloads:list", () => listDownloads());

  ipcMain.handle("downloads:cancel", (_event, raw: unknown) => {
    const { jobId } = z.object({ jobId: z.string().uuid() }).parse(raw);
    cancelDownload(jobId);
    return true;
  });

  onDownloadsChange((jobs) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("downloads:progress", jobs);
    }
  });

  registerUpdateIpcHandlers();
}
