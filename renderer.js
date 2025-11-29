console.log("Renderer cargado correctamente");

// ============================================
// VARIABLES GLOBALES
// ============================================
let isRecordingManual = false;
let isRecordingAuto = false;
let audioChunksManual = [];
let audioChunksAuto = [];
let audioContextManual = null;
let audioContextAuto = null;
let processorManual = null;
let processorAuto = null;
let streamManual = null;
let streamAuto = null;

// VAD (Voice Activity Detection)
let silenceTimeout = null;
let isSpeaking = false;
const SILENCE_THRESHOLD = 0.01; // Umbral de volumen
const SILENCE_DURATION = 1500; // 1.5 segundos de silencio para parar

// ============================================
// ELEMENTOS DEL DOM
// ============================================
const micButton = document.getElementById("micButton");
const autoButton = document.getElementById("autoButton");
const micSelect = document.getElementById("micSelect");
const systemSelect = document.getElementById("systemSelect");
const manualStatus = document.getElementById("manualStatus");
const autoStatus = document.getElementById("autoStatus");
const subtitlesDiv = document.getElementById("subtitles");

// ============================================
// LISTAR MICRÓFONOS DISPONIBLES
// ============================================
async function listarMicrofonos() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');
    
    // Llenar ambos selectores
    [micSelect, systemSelect].forEach(select => {
      select.innerHTML = '';
      audioInputs.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Micrófono ${index + 1}`;
        select.appendChild(option);
      });
    });
    
    // Seleccionar diferentes por defecto si hay más de uno
    if (audioInputs.length > 1) {
      systemSelect.selectedIndex = 1;
    }
    
  } catch (error) {
    console.error("Error listando micrófonos:", error);
  }
}

// Cargar micrófonos al inicio
listarMicrofonos();

// ============================================
// CANAL MANUAL (Botón Hablar/Parar)
// ============================================
micButton.addEventListener("click", async () => {
  isRecordingManual = !isRecordingManual;
  
  if (isRecordingManual) {
    micButton.textContent = "⏹️ Parar";
    micButton.classList.add("recording");
    manualStatus.textContent = "🔴 Grabando...";
    manualStatus.style.backgroundColor = "#ffebee";
    manualStatus.style.color = "#c62828";
    
    await iniciarMicrofonoManual();
  } else {
    micButton.textContent = "🎤 Hablar";
    micButton.classList.remove("recording");
    manualStatus.textContent = "Procesando...";
    manualStatus.style.backgroundColor = "#fff3e0";
    manualStatus.style.color = "#e65100";
    
    enviarWav(audioChunksManual, "manual");
    audioChunksManual = [];
  }
});

async function iniciarMicrofonoManual() {
  try {
    const deviceId = micSelect.value;
    streamManual = await navigator.mediaDevices.getUserMedia({ 
      audio: { deviceId: deviceId ? { exact: deviceId } : undefined } 
    });

    audioContextManual = new AudioContext({ sampleRate: 44100 });
    const source = audioContextManual.createMediaStreamSource(streamManual);
    processorManual = audioContextManual.createScriptProcessor(4096, 1, 1);

    processorManual.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      if (isRecordingManual) {
        audioChunksManual.push(new Float32Array(inputData));
      }
    };

    source.connect(processorManual);
    processorManual.connect(audioContextManual.destination);

  } catch (error) {
    console.error("Error activando micrófono manual:", error);
    isRecordingManual = false;
    micButton.textContent = "🎤 Hablar";
    manualStatus.textContent = "❌ Error al activar micrófono";
    manualStatus.style.backgroundColor = "#ffebee";
  }
}

// ============================================
// CANAL AUTOMÁTICO (VAD - Voice Activity Detection)
// ============================================
autoButton.addEventListener("click", async () => {
  isRecordingAuto = !isRecordingAuto;
  
  if (isRecordingAuto) {
    autoButton.textContent = "⏹️ Detener Escucha";
    autoButton.classList.add("active");
    autoStatus.textContent = "👂 Escuchando...";
    autoStatus.style.backgroundColor = "#e3f2fd";
    autoStatus.style.color = "#1976d2";
    
    await iniciarMicrofonoAutomatico();
  } else {
    autoButton.textContent = "▶️ Iniciar Escucha Automática";
    autoButton.classList.remove("active");
    autoStatus.textContent = "Detenido";
    autoStatus.style.backgroundColor = "#f5f5f5";
    autoStatus.style.color = "#666";
    
    detenerMicrofonoAutomatico();
  }
});

async function iniciarMicrofonoAutomatico() {
  try {
    const deviceId = systemSelect.value;
    streamAuto = await navigator.mediaDevices.getUserMedia({ 
      audio: { deviceId: deviceId ? { exact: deviceId } : undefined } 
    });

    audioContextAuto = new AudioContext({ sampleRate: 44100 });
    const source = audioContextAuto.createMediaStreamSource(streamAuto);
    processorAuto = audioContextAuto.createScriptProcessor(4096, 1, 1);

    processorAuto.onaudioprocess = (e) => {
      if (!isRecordingAuto) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Calcular volumen RMS (Root Mean Square)
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      
      // Detección de voz
      if (rms > SILENCE_THRESHOLD) {
        // Hay voz
        if (!isSpeaking) {
          isSpeaking = true;
          audioChunksAuto = [];
          autoStatus.textContent = "🎙️ Detectando voz...";
          autoStatus.style.backgroundColor = "#fff3e0";
          autoStatus.style.color = "#e65100";
        }
        
        audioChunksAuto.push(new Float32Array(inputData));
        
        // Resetear timeout de silencio
        clearTimeout(silenceTimeout);
        silenceTimeout = setTimeout(() => {
          finalizarGrabacionAutomatica();
        }, SILENCE_DURATION);
        
      } else if (isSpeaking) {
        // Silencio pero estaba hablando (continuar grabando por si acaso)
        audioChunksAuto.push(new Float32Array(inputData));
      }
    };

    source.connect(processorAuto);
    processorAuto.connect(audioContextAuto.destination);

  } catch (error) {
    console.error("Error activando micrófono automático:", error);
    isRecordingAuto = false;
    autoButton.textContent = "▶️ Iniciar Escucha Automática";
    autoStatus.textContent = "❌ Error al activar micrófono";
    autoStatus.style.backgroundColor = "#ffebee";
  }
}

function finalizarGrabacionAutomatica() {
  if (audioChunksAuto.length > 0) {
    autoStatus.textContent = "⏳ Traduciendo...";
    autoStatus.style.backgroundColor = "#e8f5e9";
    autoStatus.style.color = "#2e7d32";
    
    enviarWav(audioChunksAuto, "auto");
    audioChunksAuto = [];
  }
  
  isSpeaking = false;
  
  if (isRecordingAuto) {
    autoStatus.textContent = "👂 Escuchando...";
    autoStatus.style.backgroundColor = "#e3f2fd";
    autoStatus.style.color = "#1976d2";
  }
}

function detenerMicrofonoAutomatico() {
  clearTimeout(silenceTimeout);
  
  if (streamAuto) {
    streamAuto.getTracks().forEach(track => track.stop());
  }
  if (processorAuto) {
    processorAuto.disconnect();
  }
  if (audioContextAuto) {
    audioContextAuto.close();
  }
  
  audioChunksAuto = [];
  isSpeaking = false;
}

// ============================================
// ENVIAR AUDIO AL MAIN
// ============================================
function enviarWav(chunks, canal) {
  if (chunks.length === 0) return;

  const totalLength = chunks.reduce((acc, curr) => acc + curr.length, 0);
  let merged = new Float32Array(totalLength);
  let offset = 0;

  for (let chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  const wavBuffer = convertFloatToWav(merged);

  if (window.lynvo) {
    window.lynvo.sendAudio(wavBuffer, canal);
  }
}

// ============================================
// CONVERTIR FLOAT32 → WAV
// ============================================
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

// ============================================
// MOSTRAR TEXTO Y REPRODUCIR AUDIO
// ============================================
window.lynvo.onTexto((data) => {
  const { original, traduccion, audio, canal } = data;

  // Limpiar mensaje inicial si existe
  if (subtitlesDiv.children.length === 1 && 
      subtitlesDiv.children[0].textContent.includes("Esperando audio")) {
    subtitlesDiv.innerHTML = '';
  }

  const mensajeDiv = document.createElement("div");
  mensajeDiv.className = canal === "auto" ? "message incoming" : "message";
  
  const timestamp = new Date().toLocaleTimeString();
  const etiqueta = canal === "manual" ? "Tú" : "Entrada";
  
  mensajeDiv.innerHTML = `
    <span class="timestamp">${timestamp} - ${etiqueta}</span><br>
    <strong>${canal === "manual" ? "Español" : "Inglés"}:</strong> ${original}<br>
    <strong>${canal === "manual" ? "Inglés" : "Español"}:</strong> ${traduccion}
  `;
  
  subtitlesDiv.appendChild(mensajeDiv);
  subtitlesDiv.scrollTop = subtitlesDiv.scrollHeight;

  // Reproducir audio
  if (audio) {
  const blob = new Blob([audio], { type: "audio/mp3" });
  const url = URL.createObjectURL(blob);
  const audioPlayer = new Audio(url);
  audioPlayer.play();
}
  
  // Actualizar estados
  if (canal === "manual") {
    manualStatus.textContent = "✅ Listo";
    manualStatus.style.backgroundColor = "#e8f5e9";
    manualStatus.style.color = "#2e7d32";
    setTimeout(() => {
      manualStatus.textContent = "Esperando...";
      manualStatus.style.backgroundColor = "#e3f2fd";
      manualStatus.style.color = "#1976d2";
    }, 2000);
  }
});