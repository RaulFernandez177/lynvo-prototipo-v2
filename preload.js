// -------------------------------------------------------------
// PRELOAD.JS — expone funciones seguras al renderer
// -------------------------------------------------------------

const { contextBridge, ipcRenderer } = require("electron");

// Exponemos funcionalidades al renderer
contextBridge.exposeInMainWorld("lynvo", {

  // -------------------------
  // 🔵 ENVÍO DE AUDIO
  // -------------------------
  sendAudio: (uint8Array) => {
    ipcRenderer.send("audio-data", uint8Array);
  },

  // -------------------------
  // 🔵 TEXTO QUE VIENE DESDE main.js
  // -------------------------
  onTexto: (callback) => {
    ipcRenderer.on("texto-transcrito", (event, texto) => callback(texto));
  }

});
