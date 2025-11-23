console.log("Renderer cargado correctamente");

const subtitlesDiv = document.getElementById("subtitles");

async function iniciarMicrofono() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);

    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    source.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = async (event) => {
      const float32 = event.inputBuffer.getChannelData(0);

      const pcm16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        pcm16[i] = Math.max(-1, Math.min(1, float32[i])) * 0x7fff;
      }

      const buffer = Buffer.from(pcm16.buffer);

      // Envío al main por IPC
      const texto = await window.electronAPI.enviarAudio(buffer);

      if (texto) {
        subtitlesDiv.innerText = texto;
      } else {
        subtitlesDiv.innerText = "Escuchando…";
      }
    };

    console.log("Micrófono iniciado");
  } catch (err) {
    console.error("Error de micrófono:", err);
    subtitlesDiv.innerText = "No se pudo acceder al micrófono.";
  }
}

iniciarMicrofono();
