console.log("Renderer cargado correctamente");

async function iniciarMicrofono() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);

    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);

      // enviamos el Float32Array al preload
      window.lynvo.sendAudio(inputData);
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    console.log("Micrófono iniciado");

  } catch (error) {
    console.error("Error activando micrófono:", error);
  }
}

iniciarMicrofono();
