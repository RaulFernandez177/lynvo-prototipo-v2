const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadFile("index.html");
}

app.whenReady().then(createWindow);

// 🔵 Recibe audio desde preload (cada fragmento)
ipcMain.on("audio-data", (event, buffer) => {
  console.log("📡 Audio recibido en main:", buffer.length, "bytes");
});

