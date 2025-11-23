const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  enviarAudio: (buffer) => ipcRenderer.invoke("whisper:audio", buffer)
});
