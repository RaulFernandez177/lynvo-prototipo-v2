const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lynvo", {
  sendAudio: (float32Array) => {
    const buffer = Buffer.from(float32Array.buffer);
    ipcRenderer.send("audio:chunk", buffer);
  }
});
