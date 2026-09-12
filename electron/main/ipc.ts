import { dialog, ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { addMediaItem, listMediaItems } from "../services/library/libraryService.js";
import { createPlaylist, listPlaylists } from "../services/playlists/playlistService.js";
import { createQueueJob, listQueueJobs } from "../services/queue/queueService.js";

const createPlaylistSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional()
});

export function registerIpcHandlers() {
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
}
