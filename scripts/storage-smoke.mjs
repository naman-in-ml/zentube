import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "electron";
import { initializeDatabase } from "../dist-electron/services/db/client.js";
import { addMediaItem, listMediaItems } from "../dist-electron/services/library/libraryService.js";
import { updateProgress } from "../dist-electron/services/progress/progressService.js";
import {
  addItemToPlaylist,
  getOrCreatePlaylist
} from "../dist-electron/services/playlists/playlistService.js";
import {
  deleteStorageItems,
  getStorageSummary
} from "../dist-electron/services/storage/storageService.js";

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "zentube-storage-test-"));
const testStorageDir = path.join(testDir, "Zentube");
fs.mkdirSync(testStorageDir, { recursive: true });
process.env.ZENTUBE_OUT_DIR = testStorageDir;

app.setPath("userData", path.join(testDir, "user-data"));
initializeDatabase(app.getPath("userData"));

const assert = (label, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
  if (!ok) {
    console.error(`Assertion failed: ${label}`);
    process.exitCode = 1;
  }
};

console.log("--- 1. Testing Storage Summary on Empty Library ---");
let summary = getStorageSummary(testStorageDir);
assert("Summary returns storageDirectory path", typeof summary.storageDirectory === "string" && summary.storageDirectory.length > 0);
assert("Drive total capacity detected (> 0 bytes)", summary.totalDiskBytes > 0);
assert("Drive free space detected (> 0 bytes)", summary.freeDiskBytes > 0);
assert("Empty library has 0 video bytes", summary.breakdown.video.bytes === 0);
assert("Empty library has 0 courses", summary.courses.length === 0);
assert("Empty library has 0 completed cleanup candidates", summary.cleanupCandidates.completed.length === 0);

console.log("--- 2. Creating Mock Media and Testing Footprint Tracking ---");
const videoPath = path.join(testStorageDir, "lecture.mp4");
const thumbPath = path.join(testStorageDir, "lecture.webp");
const vttPath = path.join(testStorageDir, "lecture.en.vtt");
const infoPath = path.join(testStorageDir, "lecture.info.json");

const FIVE_MB = 5 * 1024 * 1024;
fs.writeFileSync(videoPath, Buffer.alloc(FIVE_MB));
fs.writeFileSync(thumbPath, Buffer.alloc(100 * 1024));
fs.writeFileSync(vttPath, Buffer.alloc(20 * 1024));
fs.writeFileSync(infoPath, Buffer.alloc(5 * 1024));

const media = addMediaItem(videoPath, {
  title: "Advanced Distributed Systems",
  durationSeconds: 3600
});

const pl = getOrCreatePlaylist("Distributed Systems Masterclass");
addItemToPlaylist(pl.id, media.id, 1);

summary = getStorageSummary(testStorageDir);
assert("Media video bytes tracked accurately", summary.breakdown.video.bytes >= FIVE_MB);
assert("Video file count tracked", summary.breakdown.video.count >= 1);
assert("Course storage tracked with correct byte size", summary.courses.length === 1 && summary.courses[0].totalSizeBytes >= FIVE_MB);
assert("Course percent of Zentube calculated", summary.courses[0].percentOfZentube > 0);
assert("Largest cleanup candidates contains media", summary.cleanupCandidates.largest.some((c) => c.id === media.id));

console.log("--- 3. Testing Completed Video Identification ---");
assert("Uncompleted video is not in completed cleanup candidates", !summary.cleanupCandidates.completed.some((c) => c.id === media.id));

updateProgress({ mediaId: media.id, position: 3500, duration: 3600 });
summary = getStorageSummary(testStorageDir);
assert("Finished video appears in completed cleanup candidates", summary.cleanupCandidates.completed.some((c) => c.id === media.id));

console.log("--- 4. Testing Storage Space Reclamation (Deletion) ---");
assert("Video file exists on disk prior to deletion", fs.existsSync(videoPath));

const result = deleteStorageItems([media.id], true);
assert("deleteStorageItems reports deletedCount = 1", result.deletedCount === 1);
assert("deleteStorageItems reports reclaimedBytes >= 5MB", result.reclaimedBytes >= FIVE_MB);
assert("Video file is purged from disk", !fs.existsSync(videoPath));
assert("Database media items is now 0", listMediaItems().length === 0);

summary = getStorageSummary(testStorageDir);
assert("Storage breakdown video count reset", summary.breakdown.video.count === 0);
assert("Course totalSizeBytes updated to 0", summary.courses[0].totalSizeBytes === 0);
assert("Completed cleanup candidates empty after purge", summary.cleanupCandidates.completed.length === 0);

console.log("All Storage & Disk Cleanup Integration Tests Passed Successfully!");
app.exit(0);
