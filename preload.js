const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lynvo", {

  sendAudio: (uint8array) => {
    // Convertimos correctamente Uint8Array → Buffer
    const buffer = Buffer.from(uint8array);
    ipcRenderer.send("audio-data", buffer);
  },

  onTexto: (callback) => {
    ipcRenderer.on("texto-transcrito", (event, texto) => callback(texto));
  }

});
