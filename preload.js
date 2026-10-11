const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  verifyKey: (key) => ipcRenderer.invoke("verify-key", key),
  startBots: (data) => ipcRenderer.invoke("start-bots", data),
  windowControl: (action) => ipcRenderer.send("window-control", action)
});
