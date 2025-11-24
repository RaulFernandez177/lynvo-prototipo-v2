console.log("Renderer cargado correctamente");

let isRecording = false;

// 🔵 BOTÓN HABLAR/PARAR
const micButton = document.getElementById("micButton");

micButton.addEventListener("click", () => {
  isRecording = !isRecording;
  micButton.textContent = isRecording ? "⏹️ Parar" : "🎤 Hablar";
});

// 🔵 INICIAR MICRÓFONO AUTOMÁTICAMENTE (opción 2)
async function iniciarMicrofono() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);

    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);

      // Solo enviar audio si el usuario está grabando
      if (isRecording && window.lynvo) {
        window.lynvo.sendAudio(inputData);
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    console.log("Micrófono iniciado");

  } catch (error) {
    console.error("Error activando micrófono:", error);
  }
}

// 👉 importante: iniciamos el micro una vez
iniciarMicrofono();

