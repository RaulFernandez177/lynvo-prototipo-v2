require("dotenv").config();
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const FormData = require("form-data");

// --------------------------------------------------
// CREAR VENTANA
// --------------------------------------------------
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: false  
    }
  });

  win.loadFile("index.html");
}

app.whenReady().then(createWindow);

// --------------------------------------------------
// FUNCION WHISPER (CORRECTA)
// --------------------------------------------------
async function transcribirWhisper(wavBuffer) {
  try {
    const formData = new FormData();

    formData.append("model", "whisper-1");

    // WAV correcto para form-data
    formData.append("file", wavBuffer, {
      filename: "audio.wav",
      contentType: "audio/wav"
    });

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    const data = await response.json();
    console.log("📝 Whisper dijo:", data.text);
    return data.text || "";

  } catch (err) {
    console.error("❌ Error Whisper:", err);
    return "";
  }
}

// --------------------------------------------------
// RECIBIR AUDIO, CONVERTIR A BUFFER Y ENVIAR A WHISPER
// --------------------------------------------------
ipcMain.on("audio-data", async (event, rawData) => {
  // Convertimos correctamente de Uint8Array → Buffer nativo
  const wavBuffer = Buffer.from(rawData);

  console.log("📡 Audio recibido en main:", wavBuffer.length, "bytes");

  const texto = await transcribirWhisper(wavBuffer);

  if (texto && texto.trim() !== "") {
    event.sender.send("texto-transcrito", texto);
  }
});