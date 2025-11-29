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
    width: 1000,
    height: 800,
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
async function transcribirWhisper(wavBuffer, idioma = "es") {
  try {
    const formData = new FormData();
    formData.append("model", "whisper-1");
    formData.append("language", idioma); // "es" o "en"
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
// 2) TRADUCIR TEXTO
// --------------------------------------------------
async function traducirTexto(texto, idiomaDestino) {
  try {
    const prompt = idiomaDestino === "en" 
      ? `Traduce este texto al inglés: ${texto}`
      : `Translate this text to Spanish: ${texto}`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Eres un traductor profesional." },
          { role: "user", content: prompt }
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
    return texto;
  }
}

// --------------------------------------------------
// 3) GENERAR VOZ (TTS)
// --------------------------------------------------
async function generarVoz(texto, idioma = "en") {
  try {
    // Seleccionar voz según idioma
    const voice = idioma === "en" ? "alloy" : "nova"; // nova suena más natural en español

    const response = await axios.post(
      "https://api.openai.com/v1/audio/speech",
      {
        model: "gpt-4o-mini-tts",
        voice: voice,
        input: texto
      },
      {
        responseType: "arraybuffer",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return Buffer.from(response.data);

  } catch (err) {
    console.error("❌ Error generando voz:", err.response?.data || err.message);
    return null;
  }
}

// --------------------------------------------------
// 4) FLUJO COMPLETO CON DOS CANALES
// --------------------------------------------------
ipcMain.on("audio-data", async (event, data) => {
  const { audio, canal } = data;
  const wavBuffer = Buffer.from(audio);

  console.log(`📥 Audio recibido del canal: ${canal}`);

  // Configurar idiomas según el canal
  let idiomaOrigen, idiomaDestino, idiomaVoz;
  
  if (canal === "manual") {
    // Tu voz: Español → Inglés
    idiomaOrigen = "es";
    idiomaDestino = "en";
    idiomaVoz = "en";
  } else {
    // Audio entrante: Inglés → Español
    idiomaOrigen = "en";
    idiomaDestino = "es";
    idiomaVoz = "es";
  }

  // 1. Transcribir
  const textoOriginal = await transcribirWhisper(wavBuffer, idiomaOrigen);
  if (!textoOriginal.trim()) {
    console.log("⚠️ No se detectó texto en el audio");
    return;
  }

  console.log(`📝 Transcripción (${idiomaOrigen}): ${textoOriginal}`);

  // 2. Traducir
  const textoTraducido = await traducirTexto(textoOriginal, idiomaDestino);
  console.log(`🌍 Traducción (${idiomaDestino}): ${textoTraducido}`);

  // 3. Generar voz
  const audioTTS = await generarVoz(textoTraducido, idiomaVoz);

  // 4. Enviar al renderer
  event.sender.send("texto-transcrito", {
    original: textoOriginal,
    traduccion: textoTraducido,
    audio: audioTTS,
    canal: canal
  });

  console.log(`✅ Proceso completado para canal: ${canal}\n`);
});
