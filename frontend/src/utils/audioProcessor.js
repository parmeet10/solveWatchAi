/**
 * Audio processing utilities for chunking and format conversion
 */

/**
 * Convert audio blob to 16kHz WAV format
 * @param {Blob} audioBlob - Audio blob from MediaRecorder
 * @returns {Promise<Blob>} - WAV blob at 16kHz
 */
export async function convertTo16kHzWAV(audioBlob) {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const fileReader = new FileReader();

    fileReader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Create offline context at 16kHz
        const offlineContext = new OfflineAudioContext(
          1, // mono
          audioBuffer.length * (16000 / audioBuffer.sampleRate),
          16000,
        );

        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(offlineContext.destination);
        source.start();

        const resampledBuffer = await offlineContext.startRendering();

        // Convert to WAV
        const wavBlob = audioBufferToWav(resampledBuffer);
        resolve(wavBlob);
      } catch (error) {
        reject(error);
      }
    };

    fileReader.onerror = reject;
    fileReader.readAsArrayBuffer(audioBlob);
  });
}

/**
 * Convert AudioBuffer to WAV Blob
 * @param {AudioBuffer} audioBuffer - Audio buffer
 * @returns {Blob} - WAV blob
 */
function audioBufferToWav(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const length = audioBuffer.length * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, length, true);

  // Convert audio data
  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(
        -1,
        Math.min(1, audioBuffer.getChannelData(channel)[i]),
      );
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true,
      );
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Chunk audio blob into smaller pieces
 * @param {Blob} audioBlob - Audio blob
 * @param {number} chunkDurationMs - Duration of each chunk in milliseconds
 * @returns {Promise<Blob[]>} - Array of audio chunks
 */
export async function chunkAudio(audioBlob, chunkDurationMs = 5000) {
  const chunks = [];
  const chunkSize =
    (audioBlob.size / (audioBlob.size / 1024)) * (chunkDurationMs / 1000) * 16; // Rough estimate

  for (let i = 0; i < audioBlob.size; i += chunkSize) {
    const chunk = audioBlob.slice(i, Math.min(i + chunkSize, audioBlob.size));
    chunks.push(chunk);
  }

  return chunks;
}
