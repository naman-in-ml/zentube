import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "electron";
import { initializeDatabase } from "../dist-electron/services/db/client.js";
import { addMediaItem, listMediaItems } from "../dist-electron/services/library/libraryService.js";
import { getProgress, updateProgress } from "../dist-electron/services/progress/progressService.js";

const home = fs.mkdtempSync(path.join(os.tmpdir(), "zentube-progress-"));
app.setPath("userData", path.join(home, "user-data"));
initializeDatabase(app.getPath("userData"));

const mp4 = path.join(home, "sample.mp4");
fs.writeFileSync(mp4, Buffer.alloc(1024 * 1024));

const media = addMediaItem(mp4, { durationSeconds: 600 });
const assert = (label, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
  if (!ok) process.exitCode = 1;
};

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

console.log("userData:", app.getPath("userData"));
app.exit(process.exitCode ?? 0);