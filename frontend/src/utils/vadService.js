/**
 * Voice Activity Detection (VAD) service for real-time audio chunk processing
 * Uses energy-based VAD optimized for chunk-by-chunk filtering
 */
class VADService {
  constructor() {
    this.ready = true; // Always ready (no async initialization needed)
    this.sampleRate = 16000;
    // Energy threshold - tuned for 16kHz audio
    // Lower values = more sensitive (detects quieter speech)
    // Higher values = less sensitive (filters out more noise)
    this.energyThreshold = 0.002; // RMS energy threshold
    this.zeroCrossingThreshold = 0.02; // Zero crossing rate threshold for speech
    
    // Statistics for adaptive threshold (optional)
    this.recentEnergies = [];
    this.maxRecentEnergies = 10;
  }

  /**
   * Check if audio chunk contains speech
   * @param {Float32Array|Int16Array|ArrayBuffer} audioData - Audio data
   * @param {number} sampleRate - Sample rate (default: 16000)
   * @returns {boolean} - True if speech detected
   */
  isSpeech(audioData, sampleRate = 16000) {
    try {
      // Convert audio data to Float32Array if needed
      let float32Data;
      
      if (audioData instanceof Float32Array) {
        float32Data = audioData;
      } else if (audioData instanceof Int16Array) {
        // Convert Int16 (-32768 to 32767) to Float32 (-1.0 to 1.0)
        float32Data = new Float32Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          float32Data[i] = audioData[i] / 32768.0;
        }
      } else if (audioData instanceof ArrayBuffer) {
        // Assume Int16 PCM format
        const int16Data = new Int16Array(audioData);
        float32Data = new Float32Array(int16Data.length);
        for (let i = 0; i < int16Data.length; i++) {
          float32Data[i] = int16Data[i] / 32768.0;
        }
      } else {
        console.warn('[VAD] Unsupported audio data type:', audioData.constructor.name);
        return true; // Assume speech for unknown formats
      }

      // Calculate RMS energy
      const rmsEnergy = this.calculateRMSEnergy(float32Data);
      
      // Update recent energies for adaptive threshold (optional)
      this.recentEnergies.push(rmsEnergy);
      if (this.recentEnergies.length > this.maxRecentEnergies) {
        this.recentEnergies.shift();
      }

      // Primary check: RMS energy threshold
      if (rmsEnergy < this.energyThreshold) {
        return false; // Too quiet, likely silence
      }

      // Secondary check: Zero crossing rate (helps distinguish speech from noise)
      // Speech typically has moderate zero crossing rate
      const zeroCrossingRate = this.calculateZeroCrossingRate(float32Data);
      
      // Very high zero crossing rate suggests noise, not speech
      if (zeroCrossingRate > 0.5) {
        return false; // Likely high-frequency noise
      }

      // Both checks passed, likely speech
      return true;
    } catch (error) {
      console.error('[VAD] Error detecting speech:', error);
      // On error, assume speech to avoid missing transcriptions
      return true;
    }
  }

  /**
   * Calculate RMS (Root Mean Square) energy of audio signal
   * @param {Float32Array} audioData - Audio data
   * @returns {number} - RMS energy value
   */
  calculateRMSEnergy(audioData) {
    if (audioData.length === 0) return 0;
    
    let sumSquares = 0;
    for (let i = 0; i < audioData.length; i++) {
      sumSquares += audioData[i] * audioData[i];
    }
    return Math.sqrt(sumSquares / audioData.length);
  }

  /**
   * Calculate zero crossing rate (helps distinguish speech from noise)
   * @param {Float32Array} audioData - Audio data
   * @returns {number} - Zero crossing rate (0-1)
   */
  calculateZeroCrossingRate(audioData) {
    if (audioData.length < 2) return 0;
    
    let zeroCrossings = 0;
    for (let i = 1; i < audioData.length; i++) {
      if ((audioData[i - 1] >= 0) !== (audioData[i] >= 0)) {
        zeroCrossings++;
      }
    }
    return zeroCrossings / (audioData.length - 1);
  }

  /**
   * Calculate energy of audio signal (alternative method)
   * @param {Float32Array} audioData - Audio data
   * @returns {number} - Energy value
   */
  calculateEnergy(audioData) {
    return this.calculateRMSEnergy(audioData);
  }

  /**
   * Check if audio buffer has sufficient speech duration
   * @param {Float32Array|Int16Array|ArrayBuffer} audioBuffer - Audio buffer
   * @param {number} sampleRate - Sample rate (default: 16000)
   * @param {number} minSpeechDurationMs - Minimum speech duration in milliseconds (default: 250)
   * @returns {boolean} - True if buffer contains sufficient speech
   */
  hasSufficientSpeech(audioBuffer, sampleRate = 16000, minSpeechDurationMs = 250) {
    // Check if we have enough data
    const minSamples = Math.floor((sampleRate * minSpeechDurationMs) / 1000);
    const minBytes = minSamples * 2; // 16-bit = 2 bytes

    let bufferLength;
    if (audioBuffer instanceof ArrayBuffer) {
      bufferLength = audioBuffer.byteLength;
    } else if (audioBuffer instanceof Float32Array || audioBuffer instanceof Int16Array) {
      bufferLength = audioBuffer.length * (audioBuffer instanceof Float32Array ? 4 : 2);
    } else {
      bufferLength = audioBuffer.length;
    }

    if (bufferLength < minBytes) {
      return false;
    }

    // Sample a few portions of the buffer
    const numSamples = Math.min(3, Math.floor(bufferLength / minBytes));
    let speechDetections = 0;

    for (let i = 0; i < numSamples; i++) {
      const start = Math.floor((i * bufferLength) / (numSamples + 1));
      const end = Math.min(start + minBytes, bufferLength);
      
      let chunk;
      if (audioBuffer instanceof ArrayBuffer) {
        chunk = audioBuffer.slice(start, end);
      } else if (audioBuffer instanceof Float32Array) {
        const startIdx = Math.floor(start / 4);
        const endIdx = Math.floor(end / 4);
        chunk = audioBuffer.slice(startIdx, endIdx);
      } else if (audioBuffer instanceof Int16Array) {
        const startIdx = Math.floor(start / 2);
        const endIdx = Math.floor(end / 2);
        chunk = audioBuffer.slice(startIdx, endIdx);
      } else {
        chunk = audioBuffer.slice(start, end);
      }

      if (this.isSpeech(chunk, sampleRate)) {
        speechDetections++;
      }
    }

    // Require at least 50% of samples to have speech
    return speechDetections >= numSamples / 2;
  }

  /**
   * Get initialization status
   * @returns {{ready: boolean}}
   */
  getStatus() {
    return {
      ready: this.ready,
    };
  }
}

// Export singleton instance
export const vadService = new VADService();
