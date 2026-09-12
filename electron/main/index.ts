import { app, BrowserWindow, protocol } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { initializeDatabase } from "../services/db/client.js";
import { registerIpcHandlers } from "./ipc.js";

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

protocol.registerSchemesAsPrivileged([
  {
    scheme: "local-file",
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true
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
    backgroundColor: "#f5f3ef",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL!);
    window.webContents.openDevTools({ mode: "detach" });
    return;
  }

  const indexPath = path.join(__dirname, "../../dist/index.html");
  void window.loadURL(pathToFileURL(indexPath).toString());
}

app.whenReady().then(() => {
  protocol.registerFileProtocol("local-file", (request, callback) => {
    const filePath = decodeURIComponent(request.url.replace("local-file://", ""));
    callback({ path: filePath });
  });

  initializeDatabase(app.getPath("userData"));
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
