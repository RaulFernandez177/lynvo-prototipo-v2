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
// 1) TRANSCRIBIR AUDIO → TEXTO (WHISPER)
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
// 2) TRADUCIR TEXTO (GPT-4o-mini o GPT-4o)
// --------------------------------------------------
async function traducirTexto(texto) {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Eres un traductor profesional." },
          { role: "user", content: `Traduce este texto al inglés: ${texto}` }
        ]
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.choices[0].message.content.trim();

  } catch (err) {
    console.error("❌ Error al traducir:", err.response?.data || err.message);
    return texto; // fallback
  }
}

// --------------------------------------------------
// 3) RECIBIR AUDIO → TRANSCRIBIR → TRADUCIR → ENVIAR A UI
// --------------------------------------------------
ipcMain.on("audio-data", async (event, rawData) => {
  const wavBuffer = Buffer.from(rawData);

  // 1) Transcribir
  const textoOriginal = await transcribirWhisper(wavBuffer);

  if (!textoOriginal.trim()) return;

  // 2) Traducir
  const textoTraducido = await traducirTexto(textoOriginal);

  // 3) Enviar texto traducido al renderer
  event.sender.send("texto-transcrito", {
    original: textoOriginal,
    traduccion: textoTraducido
  });
});

