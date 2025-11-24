console.log("Renderer cargado correctamente");

let isRecording = false;
let audioChunks = [];       // almacenamiento del audio
let silenceCounter = 0;     // contador de silencio

// 🔵 BOTÓN HABLAR/PARAR
const micButton = document.getElementById("micButton");

micButton.addEventListener("click", () => {
  isRecording = !isRecording;
  micButton.textContent = isRecording ? "⏹️ Parar" : "🎤 Hablar";

  // Si paramos, enviar lo que quede
  if (!isRecording) {
    enviarWav();
    silenceCounter = 0;
  }
});

// 🔵 INICIAR MICRÓFONO AUTOMÁTICAMENTE
async function iniciarMicrofono() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const audioContext = new AudioContext({ sampleRate: 44100 });
    const source = audioContext.createMediaStreamSource(stream);

    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);

      if (isRecording) {
        audioChunks.push(new Float32Array(inputData.slice(0)));

        // Detectar silencio
        const volume = Math.max(...inputData);
        if (volume < 0.001) {
          silenceCounter++;
        } else {
          silenceCounter = 0;
        }

        // Si llevamos silencio suficiente → enviar frase
        if (silenceCounter > 10) {
          enviarWav();
          silenceCounter = 0;
        }
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    console.log("Micrófono iniciado");

  } catch (error) {
    console.error("Error activando micrófono:", error);
  }
}

iniciarMicrofono();

// --------------------------------------------------------
// FUNCIÓN: GENERAR WAV Y ENVIARLO AL MAIN
// --------------------------------------------------------
function enviarWav() {
  if (audioChunks.length === 0) return;

  const totalLength = audioChunks.reduce((acc, curr) => acc + curr.length, 0);

  let merged = new Float32Array(totalLength);
  let offset = 0;

  for (let chunk of audioChunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  audioChunks = []; // limpiar para la siguiente frase

  const wavBuffer = convertFloatToWav(merged);

  // 👉 Enviar WAV al main
  if (window.lynvo) {
    window.lynvo.sendAudio(wavBuffer);
  }
}

// --------------------------------------------------------
// FUNCIÓN: CONVERTIR FLOAT32 → WAV
// --------------------------------------------------------
function convertFloatToWav(float32Array) {
  const buffer = new ArrayBuffer(44 + float32Array.length * 2);
  const view = new DataView(buffer);

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + float32Array.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);   // PCM
  view.setUint16(22, 1, true);   // mono
  view.setUint32(24, 44100, true);   // sample rate
  view.setUint32(28, 44100 * 2, true); // byte rate
  view.setUint16(32, 2, true);      // block align
  view.setUint16(34, 16, true);     // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, float32Array.length * 2, true);

  let offset = 44;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Uint8Array(buffer); // 👈 IMPORTANTÍSIMO: renderer NO usa Buffer
}

// --------------------------------------------------------
// MOSTRAR TEXTO TRANSCRITO EN PANTALLA
// --------------------------------------------------------
window.lynvo.onTexto((texto) => {
  document.getElementById("subtitles").textContent = texto;
});
