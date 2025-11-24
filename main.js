require("dotenv").config();
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
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
// FUNCION WHISPER CON AXIOS
// --------------------------------------------------
async function transcribirWhisper(wavBuffer) {
  try {
    const formData = new FormData();

    formData.append("model", "whisper-1");
    formData.append("file", wavBuffer, {
      filename: "audio.wav",
      contentType: "audio/wav"
    });

    console.log("🔄 Enviando a Whisper...");

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

    console.log("✅ Status:", response.status);
    console.log("📦 Respuesta:", response.data);

    if (response.data.text) {
      console.log("✅ Whisper dijo:", response.data.text);
      return response.data.text;
    } else {
      console.log("⚠️ No hay texto en la respuesta");
      return "";
    }

  } catch (err) {
    console.error("❌ Error Whisper:", err.response?.data || err.message);
    return "";
  }
}

// --------------------------------------------------
// RECIBIR AUDIO, GUARDAR WAV, ENVIAR A WHISPER
// --------------------------------------------------
ipcMain.on("audio-data", async (event, rawData) => {
  const wavBuffer = Buffer.from(rawData);

  console.log("📡 Audio recibido en main:", wavBuffer.length, "bytes");

  // 💾 GUARDAR WAV PARA ANALIZAR
  fs.writeFileSync(path.join(__dirname, "test.wav"), wavBuffer);
  console.log("💾 WAV guardado como test.wav");

  const texto = await transcribirWhisper(wavBuffer);

  if (texto && texto.trim() !== "") {
    event.sender.send("texto-transcrito", texto);
  } else {
    console.log("⚠️ No se recibió texto para enviar al renderer");
  }
});