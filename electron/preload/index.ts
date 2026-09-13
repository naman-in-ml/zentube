import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

contextBridge.exposeInMainWorld("zentube", {
  getVersion: () => ipcRenderer.invoke("app:getVersion"),
  library: {
    list: () => ipcRenderer.invoke("library:list"),
    importFiles: () => ipcRenderer.invoke("library:importFiles")
  },
  playlists: {
    list: () => ipcRenderer.invoke("playlists:list"),
    create: (input: { name: string; description?: string }) =>
      ipcRenderer.invoke("playlists:create", input)
  },
  queue: {
    list: () => ipcRenderer.invoke("queue:list")
  },
  progress: {
    get: (mediaId: string) => ipcRenderer.invoke("progress:get", { mediaId }),
    update: (input: { mediaId: string; position: number; duration: number | null }) =>
      ipcRenderer.invoke("progress:update", input)
  },
  downloads: {
    checkTools: () => ipcRenderer.invoke("downloads:checkTools"),
    resolve: (url: string) => ipcRenderer.invoke("downloads:resolve", { url }),
    start: (input: {
      entries: { id: string; title: string; duration: number | null; url: string }[];
      quality: string;
      playlistTitle: string | null;
    }) => ipcRenderer.invoke("downloads:start", input),
    cancel: (jobId: string) => ipcRenderer.invoke("downloads:cancel", { jobId }),
    list: () => ipcRenderer.invoke("downloads:list"),
    onProgress: (callback: (jobs: unknown[]) => void) => {
      const listener = (_event: IpcRendererEvent, jobs: unknown[]) => callback(jobs);
      ipcRenderer.on("downloads:progress", listener);
      return () => ipcRenderer.removeListener("downloads:progress", listener);
    }
  },
  updates: {
    check: () => ipcRenderer.invoke("updates:check"),
    install: () => ipcRenderer.invoke("updates:install"),
    onStatus: (callback: (status: unknown) => void) => {
      const listener = (_event: IpcRendererEvent, status: unknown) => callback(status);
      ipcRenderer.on("updates:status", listener);
      return () => ipcRenderer.removeListener("updates:status", listener);
    }
  }
});
