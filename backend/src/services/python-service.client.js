/**
 * HTTP client for Python transcription service REST API
 */
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { CONFIG } from '../config/constants.js';

class PythonServiceClient {
  constructor() {
    this.baseURL = CONFIG.PYTHON_SERVICE_URL;
  }

  /**
   * Transcribe an audio file
   * @param {string} filePath - Path to the audio file
   * @param {string} filename - Original filename
   * @returns {Promise<{success: boolean, text: string, confidence: number}>}
   */
  async transcribeFile(filePath, filename) {
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath), filename);

      const response = await axios.post(
        `${this.baseURL}/transcribe`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 300000, // 5 minutes timeout for large files
        },
      );

      return response.data;
    } catch (error) {
      console.error(
        'Error calling Python transcription service:',
        error.message,
      );
      if (error.response) {
        throw new Error(
          `Transcription service error: ${
            error.response.data.detail || error.response.statusText
          }`,
        );
      }
      throw new Error(
        `Failed to connect to transcription service: ${error.message}`,
      );
    }
  }

  /**
   * Check if Python service is healthy
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000,
      });
      return response.data.status === 'healthy';
    } catch (error) {
      return false;
    }
  }
}

export default new PythonServiceClient();
