// -------------------------------------------------------------
// PRELOAD.JS — expone funciones seguras al renderer
// -------------------------------------------------------------

const { contextBridge, ipcRenderer } = require("electron");

// Exponemos funcionalidades al renderer
contextBridge.exposeInMainWorld("lynvo", {

  // -------------------------
  // 🔵 ENVÍO DE AUDIO (ahora incluye el canal)
  // -------------------------
  sendAudio: (uint8Array, canal) => {
    ipcRenderer.send("audio-data", { audio: uint8Array, canal: canal });
  },

  // -------------------------
  // 🔵 TEXTO QUE VIENE DESDE main.js
  // -------------------------
  onTexto: (callback) => {
    ipcRenderer.on("texto-transcrito", (event, data) => callback(data));
  }

});