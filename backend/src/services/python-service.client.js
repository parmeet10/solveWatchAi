/**
 * HTTP client for Python transcription service REST API
 */
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import { CONFIG } from '../config/constants.js';
import logger from '../utils/logger.js';

const log = logger('PythonServiceClient');

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

      const startTime = Date.now();
      const response = await axios.post(
        `${this.baseURL}/transcribe`,
        formData,
        {
          headers: formData.getHeaders(),
          timeout: 300000, // 5 minutes timeout for large files
        },
      );

      const duration = Date.now() - startTime;
      log.info('Python transcription complete', {
        filename,
        success: response.data.success,
        textLength: response.data.text?.length || 0,
        confidence: response.data.confidence || 0,
        duration: `${duration}ms`,
      });

      return response.data;
    } catch (error) {
      log.error('Error calling Python transcription service', error);

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

      const isHealthy = response.data.status === 'healthy';
      return isHealthy;
    } catch (error) {
      log.warn('Python service health check failed', { error: error.message });
      return false;
    }
  }
}

export default new PythonServiceClient();
