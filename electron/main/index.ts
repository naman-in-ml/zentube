import { app, BrowserWindow, net, protocol } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { killAllDownloads } from "../services/downloads/downloadManager.js";
import { initializeDatabase } from "../services/db/client.js";
import { backfillThumbnails } from "../services/library/libraryService.js";
import { registerIpcHandlers } from "./ipc.js";

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

protocol.registerSchemesAsPrivileged([
  {
    scheme: "local-file",
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
      bypassCSP: true
    }
  }
]);

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: "Zentube",
    backgroundColor: "#0f0f0f",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (process.env.ZENTUBE_DEBUG_RENDERER) {
    window.webContents.on("console-message", (_event, level, message) => {
      console.log(`[renderer:${level}] ${message}`);
    });
    window.webContents.on("did-finish-load", () => {
      void window.webContents.executeJavaScript(
        `JSON.stringify({ title: document.title, rootChildren: document.getElementById("root")?.childElementCount ?? -1, text: document.body.innerText.slice(0, 200) })`
      ).then((dump) => console.log(`[renderer-dump] ${dump}`));
    });
  }

  if (isDev) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL!);
    window.webContents.openDevTools({ mode: "detach" });
    return;
  }

  const indexPath = path.join(__dirname, "../../dist/index.html");
  void window.loadURL(pathToFileURL(indexPath).toString());
}

app.whenReady().then(() => {
  protocol.handle("local-file", (request) => {
    try {
      let raw = decodeURIComponent(request.url.slice("local-file://".length));
      const qIndex = raw.indexOf("?");
      if (qIndex !== -1) raw = raw.slice(0, qIndex);
      const hashIndex = raw.indexOf("#");
      if (hashIndex !== -1) raw = raw.slice(0, hashIndex);

      if (!raw.startsWith("/") && process.platform !== "win32") {
        raw = "/" + raw;
      }

      // Auto-heal path if file moved between ~/Zentube and ~/Pictures/Zentube
      if (!fs.existsSync(raw)) {
        const home = os.homedir();
        if (raw.startsWith(path.join(home, "Zentube"))) {
          const alternate = raw.replace(path.join(home, "Zentube"), path.join(home, "Pictures/Zentube"));
          if (fs.existsSync(alternate)) {
            raw = alternate;
          }
        } else if (raw.startsWith(path.join(home, "Pictures/Zentube"))) {
          const alternate = raw.replace(path.join(home, "Pictures/Zentube"), path.join(home, "Zentube"));
          if (fs.existsSync(alternate)) {
            raw = alternate;
          }
        }
      }

      return net.fetch(pathToFileURL(raw).toString());
    } catch (err) {
      console.error("local-file protocol error:", err);
      return new Response("Not found", { status: 404 });
    }
  });

  initializeDatabase(app.getPath("userData"));
  backfillThumbnails();
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  killAllDownloads();
});
