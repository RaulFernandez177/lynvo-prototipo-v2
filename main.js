require("dotenv").config();
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const axios = require("axios");
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
      contextIsolation: true
    }
  });

  win.loadFile("index.html");
}

app.whenReady().then(createWindow);

// --------------------------------------------------
// FUNCIÓN WHISPER (AXIOS)
// --------------------------------------------------
async function transcribirWhisper(wavBuffer) {
  try {
    const formData = new FormData();
    formData.append("model", "whisper-1");
    formData.append("file", wavBuffer, {
      filename: "audio.wav",
      contentType: "audio/wav"
    });

    const response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      formData,
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          ...formData.getHeaders()
        }
      }
    );

    return response.data.text || "";

  } catch (err) {
    console.error("❌ Error Whisper:", err.response?.data || err.message);
    return "";
  }
}

// --------------------------------------------------
// RECIBIR WAV DESDE RENDERER → ENVIAR A WHISPER
// --------------------------------------------------
ipcMain.on("audio-data", async (event, rawData) => {
  const wavBuffer = Buffer.from(rawData);

  const texto = await transcribirWhisper(wavBuffer);

  if (texto.trim() !== "") {
    event.sender.send("texto-transcrito", texto);
  }
});
