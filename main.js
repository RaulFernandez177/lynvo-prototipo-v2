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
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
      sandbox: false,
      audio: {
        sandbox: false
      }
    }
  });

  win.loadFile("index.html");
}

app.whenReady().then(createWindow);

// --------------------------------------------------
// 1) TRANSCRIBIR AUDIO → TEXTO (WHISPER + FILTROS)
// --------------------------------------------------
async function transcribirWhisper(wavBuffer, idioma = "es") {
  try {
    const formData = new FormData();
    formData.append("model", "whisper-1");
    formData.append("language", idioma);
    formData.append("response_format", "verbose_json");
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

    const { text, segments } = response.data;
    const texto = text || "";
    const lower = texto.toLowerCase();

    // 🔥 1) FILTRO: no_speech_prob
    if (segments && segments.length > 0) {
      const maxNoSpeech = Math.max(...segments.map(s => s.no_speech_prob || 0));
      if (maxNoSpeech > 0.60) {
        console.log(`⛔ Ignorado: no_speech_prob alto (${maxNoSpeech.toFixed(2)})`);
        return "";
      }
    }

    // 🔥 2) BLACKLIST
    const blacklist = [
      "subtítulos", "subtitles",
      "suscríbete", "subscribe",
      "gracias por ver", "thanks for watching",
      "comunidad", "community"
    ];

    if (blacklist.some(w => lower.includes(w))) {
      console.log(`⛔ BLOQUEADO (blacklist): ${texto}`);
      return "";
    }

    // 🔥 3) Texto muy corto
    if (texto.trim().length < 3) {
      console.log(`⛔ BLOQUEADO (muy corto): "${texto}"`);
      return "";
    }

    // 🔥 4) Caracteres sospechosos
    if (/►|●|■|▶|◀/.test(texto)) {
      console.log(`⛔ BLOQUEADO (símbolos): ${texto}`);
      return "";
    }

    // 🔥 5) Patrones no conversacionales
    const patronesNo = [
      /subtítulos/i, /caption/i, /transcripción/i,
      /suscrib/i, /patreon/i, /gracias por ver/i
    ];

    if (patronesNo.some(p => p.test(texto))) {
      console.log(`⛔ BLOQUEADO (no conversacional): ${texto}`);
      return "";
    }

    // 🔥 6) Subtítulo largo perfecto
    if (texto.split(" ").length > 12 && texto.endsWith(".")) {
      console.log(`⛔ BLOQUEADO (subtítulo largo): ${texto}`);
      return "";
    }

    // 🔥 7) Texto repetido
    if (/(\b.+\b)\s+\1/.test(lower)) {
      console.log(`⛔ BLOQUEADO (repetido): ${texto}`);
      return "";
    }

    return texto;

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
    const idioma = idiomaDestino === "en" ? "inglés" : "español";
    
    const systemPrompt = `Traduce exactamente al ${idioma}. SOLO responde con la traducción, sin explicaciones ni frases adicionales.
Texto: "${texto}"`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "user", content: systemPrompt }
        ],
        temperature: 0.3
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
    const voice = idioma === "en" ? "alloy" : "nova";

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
// 4) FLUJO COMPLETO
// --------------------------------------------------
ipcMain.on("audio-data", async (event, data) => {
  const { audio, canal } = data;
  const wavBuffer = Buffer.from(audio);

  console.log(`📥 Audio recibido del canal: ${canal}`);

  let idiomaOrigen, idiomaDestino, idiomaVoz;

  let outputDevice;

if (canal === "manual") {
  idiomaOrigen = "es";
  idiomaDestino = "en";
  idiomaVoz = "en";
  outputDevice = "CALL";     // ← Enviar a Voicemeeter (VAIO3)
} else {
  idiomaOrigen = "en";
  idiomaDestino = "es";
  idiomaVoz = "es";
  outputDevice = "HEADPHONES";  // ← Salida normal
}

  // 1. TRANSCRIBIR
  const textoOriginal = await transcribirWhisper(wavBuffer, idiomaOrigen);
  if (!textoOriginal.trim()) {
    console.log("⚠️ Sin texto válido detectado");
    return;
  }

  console.log(`📝 Transcripción (${idiomaOrigen}): ${textoOriginal}`);

  // 2. TRADUCIR
  const textoTraducido = await traducirTexto(textoOriginal, idiomaDestino);
  console.log(`🌍 Traducción (${idiomaDestino}): ${textoTraducido}`);

  // 3. TTS
  const audioTTS = await generarVoz(textoTraducido, idiomaVoz);

  // 4. ENVIAR AL RENDERER
  event.sender.send("texto-transcrito", {
  original: textoOriginal,
  traduccion: textoTraducido,
  audio: audioTTS,
  canal: canal,
  outputDevice: outputDevice   // ← NUEVO
});

  console.log(`✅ Proceso completado para canal: ${canal}\n`);
});

