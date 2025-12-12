/**
 * Controller for transcription endpoints
 */
import pythonServiceClient from '../services/python-service.client.js';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger.js';

const log = logger('TranscribeController');

class TranscribeController {
  /**
   * Handle file upload transcription
   */
  async transcribeFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No audio file provided',
        });
      }

      const filePath = req.file.path;
      const filename = req.file.originalname;

      log.info(`Processing audio file upload: ${filename}`);

      // Transcribe using Python service
      const result = await pythonServiceClient.transcribeFile(
        filePath,
        filename,
      );

      log.info('File transcription complete', {
        filename,
        textLength: result.text?.length || 0,
        confidence: result.confidence || 0,
      });

      // Clean up uploaded file
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        log.error('Error deleting temporary file', error);
      }

      // Return success acknowledgment (transcription logged to terminal)
      return res.status(200).json({
        success: true,
        message: 'File transcribed successfully.',
        filename: filename,
      });
    } catch (error) {
      log.error('Error transcribing file', error);

      // Clean up file on error
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          log.error('Error cleaning up file', cleanupError);
        }
      }

      return res.status(500).json({
        success: false,
        error: error.message || 'Transcription failed',
      });
    }
  }
}

export default new TranscribeController();
