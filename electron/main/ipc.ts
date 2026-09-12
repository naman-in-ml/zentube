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
import { addMediaItem, listMediaItems } from "../services/library/libraryService.js";
import { createPlaylist, listPlaylists } from "../services/playlists/playlistService.js";
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
  quality: z.enum(["best", "1080", "720", "480"]),
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

  ipcMain.handle("playlists:create", (_event, input: unknown) => {
    const payload = createPlaylistSchema.parse(input);
    return createPlaylist(payload);
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
