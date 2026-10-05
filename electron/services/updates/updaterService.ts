import { app, BrowserWindow, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";

const FRIENDLY_ERROR =
  "Couldn't reach GitHub releases — check your internet connection.";

export type UpdateStatus =
  | { state: "not-packaged" }
  | { state: "checking" }
  | { state: "update-available"; version: string; currentVersion: string }
  | { state: "update-not-available" }
  | { state: "downloading"; percent: number }
  | { state: "update-downloaded"; version: string }
  | { state: "error"; message: string };

function broadcast(status: UpdateStatus) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("updates:status", status);
  }
}

let downloadedVersion: string | null = null;

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowPrerelease = false;

autoUpdater.on("checking-for-update", () => broadcast({ state: "checking" }));
autoUpdater.on("update-available", (info) =>
  broadcast({
    state: "update-available",
    version: info.version,
    currentVersion: app.getVersion()
  })
);
autoUpdater.on("update-not-available", () => broadcast({ state: "update-not-available" }));
autoUpdater.on("download-progress", (progress) =>
  broadcast({ state: "downloading", percent: progress.percent })
);
autoUpdater.on("update-downloaded", (info) => {
  downloadedVersion = info.version;
  broadcast({ state: "update-downloaded", version: info.version });
});
autoUpdater.on("error", (error) => {
  const message = error.message ?? String(error);
  console.error("Update check failed:", message);
  broadcast({ state: "error", message: FRIENDLY_ERROR });
});

export function registerUpdateIpcHandlers() {
  ipcMain.handle("updates:check", () => {
    if (!app.isPackaged) {
      return { state: "not-packaged" } satisfies UpdateStatus;
    }
    void autoUpdater.checkForUpdates();
    return null;
  });

  ipcMain.handle("updates:install", () => {
    if (!app.isPackaged) {
      return { state: "not-packaged" } satisfies UpdateStatus;
    }
    if (downloadedVersion) {
      autoUpdater.quitAndInstall();
      return null;
    }
    void autoUpdater.downloadUpdate();
    return null;
  });
}