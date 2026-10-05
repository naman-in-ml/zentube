import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "electron";
import { initializeDatabase } from "../dist-electron/services/db/client.js";
import { addMediaItem, deleteMediaItem, listMediaItems } from "../dist-electron/services/library/libraryService.js";
import { getProgress, updateProgress } from "../dist-electron/services/progress/progressService.js";
import {
  clearWatchHistory,
  deleteHistoryItem,
  listWatchHistory,
  logWatchSession
} from "../dist-electron/services/history/historyService.js";
import {
  addItemToPlaylist,
  getOrCreatePlaylist,
  getPlaylistDetails,
  listPlaylistsWithSummary
} from "../dist-electron/services/playlists/playlistService.js";

const home = fs.mkdtempSync(path.join(os.tmpdir(), "zentube-test-"));
app.setPath("userData", path.join(home, "user-data"));
initializeDatabase(app.getPath("userData"));

const mp4 = path.join(home, "sample.mp4");
fs.writeFileSync(mp4, Buffer.alloc(1024 * 1024));

const media = addMediaItem(mp4, { durationSeconds: 600, title: "Learn React & TypeScript" });
const assert = (label, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
  if (!ok) process.exitCode = 1;
};

// 1. Progress tests
assert("adds media with no progress", getProgress(media.id) === null);
assert("list shows null progress", listMediaItems()[0].progressPercent === null);

updateProgress({ mediaId: media.id, position: 231.4, duration: 600 });
let progress = getProgress(media.id);
assert("stores resume position", progress !== null && Math.abs(progress.positionSeconds - 231.4) < 1e-9);
assert("not completed", progress !== null && progress.completed === false);
assert("list shows 39%", listMediaItems()[0].progressPercent === 39);

updateProgress({ mediaId: media.id, position: 590, duration: 600 });
progress = getProgress(media.id);
assert("completes at >=90%", progress !== null && progress.completed === true);
assert("resets position on completion", progress !== null && progress.positionSeconds === 0);
assert("list shows 100%", listMediaItems()[0].progressPercent === 100);

updateProgress({ mediaId: media.id, position: 12.5, duration: null });
progress = getProgress(media.id);
assert("duration null never completes", progress !== null && progress.completed === false);
assert("stores position without duration", progress !== null && Math.abs(progress.positionSeconds - 12.5) < 1e-9);

// 2. Watch History tests
const started = new Date(Date.now() - 600000).toISOString();
const stopped = new Date().toISOString();
const historyId = logWatchSession({
  mediaId: media.id,
  startedAt: started,
  stoppedAt: stopped,
  startPosition: 10,
  stopPosition: 180,
  duration: 600,
  completed: false
});

let historyList = listWatchHistory(10);
assert("watch history records session", historyList.length === 1);
assert("history has media title", historyList[0].mediaTitle === "Learn React & TypeScript");
assert("history has correct start/stop position", historyList[0].startPositionSeconds === 10 && historyList[0].stopPositionSeconds === 180);

deleteHistoryItem(historyId);
assert("deleteHistoryItem removes entry", listWatchHistory(10).length === 0);

logWatchSession({
  mediaId: media.id,
  startedAt: started,
  stoppedAt: stopped,
  startPosition: 0,
  stopPosition: 600,
  duration: 600,
  completed: true
});
clearWatchHistory();
assert("clearWatchHistory empties list", listWatchHistory(10).length === 0);

// 3. Playlists & Course organization tests
const playlist = getOrCreatePlaylist("React Mastery Course");
assert("creates playlist", playlist.name === "React Mastery Course");

const samePlaylist = getOrCreatePlaylist("React Mastery Course");
assert("getOrCreatePlaylist is idempotent", samePlaylist.id === playlist.id);

addItemToPlaylist(playlist.id, media.id, 1);
const details = getPlaylistDetails(playlist.id);
assert("playlist details contain items", details !== null && details.items.length === 1);
assert("playlist item has title and position", details.items[0].title === "Learn React & TypeScript" && details.items[0].position === 1);

const summaries = listPlaylistsWithSummary();
assert("listPlaylistsWithSummary returns course with counts", summaries.length >= 1 && summaries[0].itemCount === 1);

deleteMediaItem(media.id, false);
assert("deleteMediaItem removes item from media list", listMediaItems().length === 0);
assert("deleteMediaItem cascades to playlist items", getPlaylistDetails(playlist.id).items.length === 0);

console.log("userData:", app.getPath("userData"));
app.exit(process.exitCode ?? 0);