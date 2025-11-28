console.log("Renderer cargado correctamente");

let isRecording = false;
let audioChunks = [];

// 🔵 Botón Hablar / Parar
const micButton = document.getElementById("micButton");

micButton.addEventListener("click", () => {
  isRecording = !isRecording;
  micButton.textContent = isRecording ? "⏹️ Parar" : "🎤 Hablar";

  if (!isRecording) {
    enviarWav();
  }
});

// 🔵 Iniciar micrófono
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
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

  } catch (error) {
    console.error("Error activando micrófono:", error);
  }
}

iniciarMicrofono();

// --------------------------------------------------------
// Convertir y enviar WAV al main
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

  audioChunks = [];

  const wavBuffer = convertFloatToWav(merged);

  if (window.lynvo) {
    window.lynvo.sendAudio(wavBuffer);
  }
}

// --------------------------------------------------------
// Convertir Float32 → WAV
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
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 44100, true);
  view.setUint32(28, 44100 * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, float32Array.length * 2, true);

  let offset = 44;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Uint8Array(buffer);
}

// --------------------------------------------------------
// Mostrar texto transcrito y reproducir voz (ACUMULANDO)
// --------------------------------------------------------
window.lynvo.onTexto((data) => {
  const { original, traduccion, audio } = data;

  // 🔵 CAMBIO AQUÍ: Crear elemento nuevo en vez de reemplazar todo
  const subtitlesDiv = document.getElementById("subtitles");
  
  // Crear un nuevo mensaje
  const mensajeDiv = document.createElement("div");
  mensajeDiv.style.marginBottom = "15px";
  mensajeDiv.style.padding = "10px";
  mensajeDiv.style.backgroundColor = "#f0f0f0";
  mensajeDiv.style.borderRadius = "5px";
  
  const timestamp = new Date().toLocaleTimeString();
  
  mensajeDiv.innerHTML = `
    <small style="color: #666;">${timestamp}</small><br>
    <strong>Español:</strong> ${original}<br>
    <strong>Inglés:</strong> ${traduccion}
  `;
  
  // Añadir al principio (más reciente arriba) o al final (más reciente abajo)
  subtitlesDiv.appendChild(mensajeDiv); // Para que lo nuevo salga abajo
  // O usa: subtitlesDiv.insertBefore(mensajeDiv, subtitlesDiv.firstChild); // Para que lo nuevo salga arriba
  
  // Auto-scroll hacia abajo para ver lo último
  subtitlesDiv.scrollTop = subtitlesDiv.scrollHeight;

  if (audio) {
    const blob = new Blob([audio], { type: "audio/mp3" });
    const url = URL.createObjectURL(blob);
    const audioPlayer = new Audio(url);
    audioPlayer.play();
  }
});