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
  createPlaylist,
  deletePlaylist,
  getOrCreatePlaylist,
  getPlaylistDetails,
  listPlaylistsWithSummary
} from "../dist-electron/services/playlists/playlistService.js";
import {
  addGoalItem,
  createGoal,
  deleteGoal,
  getGoalDetails,
  listGoals,
  removeGoalItem,
  updateGoal
} from "../dist-electron/services/goals/goalsService.js";
import { getDashboardSummary } from "../dist-electron/services/dashboard/dashboardService.js";

const home = fs.mkdtempSync(path.join(os.tmpdir(), "zentube-dash-test-"));
app.setPath("userData", path.join(home, "user-data"));
initializeDatabase(app.getPath("userData"));

const assert = (label, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
  if (!ok) {
    console.error(`Assertion failed: ${label}`);
    process.exitCode = 1;
  }
};

console.log("--- 1. Testing Empty Dashboard State ---");
let dash = getDashboardSummary();
assert("Empty dashboard has null continueLearning", dash.continueLearning === null);
assert("Empty dashboard has null upNext", dash.upNext === null);
assert("Empty dashboard has empty goals", dash.goals.length === 0);
assert("Empty dashboard stats are 0", dash.stats.todayMinutes === 0 && dash.stats.completedVideosCount === 0);

console.log("--- 2. Testing Media & Playlist Creation ---");
const file1 = path.join(home, "v1.mp4");
const file2 = path.join(home, "v2.mp4");
const file3 = path.join(home, "v3.mp4");
fs.writeFileSync(file1, Buffer.alloc(1024));
fs.writeFileSync(file2, Buffer.alloc(1024));
fs.writeFileSync(file3, Buffer.alloc(1024));

const m1 = addMediaItem(file1, { title: "Lesson 1: Rust Basics", durationSeconds: 600 });
const m2 = addMediaItem(file2, { title: "Lesson 2: Ownership & Borrowing", durationSeconds: 1200 });
const m3 = addMediaItem(file3, { title: "Lesson 3: Concurrency with Tokio", durationSeconds: 1800 });

const pl = getOrCreatePlaylist("Mastering Rust");
addItemToPlaylist(pl.id, m1.id, 1);
addItemToPlaylist(pl.id, m2.id, 2);
addItemToPlaylist(pl.id, m3.id, 3);

console.log("--- 3. Testing Goal Creation & Item Linking ---");
const goal = createGoal({
  title: "Systems Programming Master",
  description: "Learn low-level systems with Rust",
  icon: "🦀"
});
assert("Goal created with correct properties", goal.title === "Systems Programming Master" && goal.icon === "🦀");

addGoalItem(goal.id, "playlist", pl.id);
let goalDetail = getGoalDetails(goal.id);
assert("Goal has attached playlist item", goalDetail.items.length === 1 && goalDetail.items[0].title === "Mastering Rust");
assert("Goal computed totalMediaCount correctly", goalDetail.totalMediaCount === 3);
assert("Initial goal progress is 0%", goalDetail.progressPercent === 0);
assert("Initial upNext is Lesson 1", goalDetail.upNextMedia.id === m1.id);

console.log("--- 4. Testing Continue Learning & Up Next Invariants ---");
// Simulate user watching Lesson 1 partially (300s of 600s = 50%)
updateProgress({ mediaId: m1.id, position: 300, duration: 600 });

dash = getDashboardSummary();
assert("continueLearning picks in-progress Lesson 1", dash.continueLearning !== null && dash.continueLearning.id === m1.id);
assert("continueLearning has accurate progressPercent (50%)", dash.continueLearning.progressPercent === 50);
assert("continueLearning has attached course name", dash.continueLearning.playlistTitle === "Mastering Rust");

// Up Next should be Lesson 1 because Lesson 1 is not yet completed
assert("Up Next is still Lesson 1", dash.upNext !== null && dash.upNext.id === m1.id);

console.log("--- 5. Testing Completion Progression ---");
// Now complete Lesson 1 (580s of 600s >= 90% completed)
updateProgress({ mediaId: m1.id, position: 580, duration: 600 });

dash = getDashboardSummary();
// Because Lesson 1 completed, position was reset and completed = 1
// Therefore continueLearning should be null (or next in-progress)
assert("continueLearning resets after completion", dash.continueLearning === null);

// Up Next should advance sequentially to Lesson 2!
assert("Up Next advanced to Lesson 2", dash.upNext !== null && dash.upNext.id === m2.id);

goalDetail = getGoalDetails(goal.id);
assert("Goal progress updated to 33% (1 of 3)", goalDetail.progressPercent === 33);
assert("Goal completedMediaCount is 1", goalDetail.completedMediaCount === 1);

console.log("--- 6. Testing Watch History Analytics Aggregation ---");
const now = new Date();
const todaySession = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
logWatchSession({
  mediaId: m1.id,
  startedAt: todaySession,
  stoppedAt: now.toISOString(),
  startPosition: 0,
  stopPosition: 580,
  duration: 580,
  completed: true
});

// A session 3 days ago (within 7 days)
const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
logWatchSession({
  mediaId: m2.id,
  startedAt: threeDaysAgo,
  stoppedAt: threeDaysAgo,
  startPosition: 0,
  stopPosition: 600,
  duration: 600,
  completed: false
});

// A session 20 days ago (outside 7 days)
const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
logWatchSession({
  mediaId: m3.id,
  startedAt: twentyDaysAgo,
  stoppedAt: twentyDaysAgo,
  startPosition: 0,
  stopPosition: 300,
  duration: 300,
  completed: false
});

dash = getDashboardSummary();
assert("Today's watch time is recorded (~10 mins)", dash.stats.todayMinutes === Math.round(580 / 60));
assert("Week watch time includes 3-day-old session (~20 mins)", dash.stats.weekMinutes === Math.round((580 + 600) / 60));
assert("Completed video count is 1", dash.stats.completedVideosCount === 1);
assert("Total library video count is 3", dash.stats.totalLibraryVideos === 3);

console.log("--- 7. Testing Cascading Safety & Clean Deletion ---");
// Deleting playlist should not crash or corrupt the goal
deletePlaylist(pl.id);
goalDetail = getGoalDetails(goal.id);
assert("Goal survives playlist deletion", goalDetail !== null);
assert("Goal totalMediaCount reflects removed playlist", goalDetail.totalMediaCount === 0);

// Deleting goal should not delete media items
deleteGoal(goal.id);
assert("Goal deleted cleanly", listGoals().length === 0);
assert("Media items remain safe after goal deletion", listMediaItems().length === 3);

console.log("All Dashboard & Goals Integration Tests Passed Successfully!");
app.exit(0);
