const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lynvo", {
  sendAudio: (float32Array) => {
    // Convertimos el Float32Array a buffer antes de enviarlo
    const buffer = Buffer.from(float32Array.buffer);

    // Mandamos el audio al proceso MAIN
    ipcRenderer.send("audio-data", buffer);
  }
});

