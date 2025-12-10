/**
 * Controller for transcription endpoints
 */
import pythonServiceClient from '../services/python-service.client.js';
import path from 'path';
import fs from 'fs';

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

      console.log(
        `\n[${new Date().toISOString()}] [FILE UPLOAD] Processing: ${filename}`,
      );

      // Transcribe using Python service
      const result = await pythonServiceClient.transcribeFile(
        filePath,
        filename,
      );

      // Log transcription to terminal
      const timestamp = new Date().toISOString();
      console.log(`\n[${timestamp}] [TRANSCRIPTION] File: ${filename}`);
      console.log(`Text: ${result.text}`);
      console.log(`Confidence: ${(result.confidence * 100).toFixed(2)}%`);
      console.log(`[END TRANSCRIPTION]\n`);

      // Clean up uploaded file
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.error('Error deleting temporary file:', error);
      }

      // Return success acknowledgment (transcription logged to terminal)
      return res.status(200).json({
        success: true,
        message:
          'File transcribed successfully. Check server terminal for transcription.',
        filename: filename,
      });
    } catch (error) {
      console.error('[Transcribe Controller] Error:', error.message);

      // Clean up file on error
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error('Error cleaning up file:', cleanupError);
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
