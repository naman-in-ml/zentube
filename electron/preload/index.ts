import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("zentube", {
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
  }
});
