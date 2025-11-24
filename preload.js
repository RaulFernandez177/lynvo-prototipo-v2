const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lynvo", {

  sendAudio: (uint8Array) => {
    // Enviar directamente el Uint8Array sin convertirlo
    // El main.js ya hace: Buffer.from(rawData)
    ipcRenderer.send("audio-data", uint8Array);
  },

  onTexto: (callback) => {
    ipcRenderer.on("texto-transcrito", (event, texto) => callback(texto));
  }

});
