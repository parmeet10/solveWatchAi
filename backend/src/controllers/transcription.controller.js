import aiService from '../services/ai.service.js';
import transcriptionStorageService from '../services/transcription-storage.service.js';
import imageProcessingService from '../services/image-processing.service.js';
import emailService from '../services/email.service.js';
import fs from 'fs';
import path from 'path';

const EMAIL_CONFIG_FILE_PATH = path.join(process.cwd(), 'backend', 'config', 'email-config.json');

class TranscriptionController {
  /**
   * Process transcription with AI
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async processTranscription(req, res) {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required',
        });
      }

      // Get full transcription for the session
      const transcriptionText = transcriptionStorageService.getFullTranscription(sessionId);

      if (!transcriptionText || transcriptionText.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'No transcription found for this session',
        });
      }

      console.log(`📝 Processing transcription for session: ${sessionId}`);
      console.log(`📄 Transcription text (first 200 chars): ${transcriptionText.substring(0, 200)}...`);

      // Process with AI
      const aiResponse = await aiService.askGptTranscription(transcriptionText);
      const responseText = aiResponse.message.content;

      // Store the response for context mode (if enabled)
      imageProcessingService.setLastResponse(responseText);

      // Create a processed data entry
      const processedEntry = {
        filename: `transcription-${sessionId}`,
        timestamp: new Date().toLocaleString(),
        extractedText: transcriptionText.substring(0, 500) + (transcriptionText.length > 500 ? '...' : ''),
        gptResponse: responseText.substring(0, 1000) + (responseText.length > 1000 ? '...' : ''),
        usedContext: false,
        type: 'transcription',
      };

      // Add to processed data (similar to how screenshots/clipboard are handled)
      imageProcessingService.addProcessedData(processedEntry);

      // Send email if enabled
      try {
        let emailConfig = { enabled: false, email: '' };
        if (fs.existsSync(EMAIL_CONFIG_FILE_PATH)) {
          const configData = fs.readFileSync(EMAIL_CONFIG_FILE_PATH, 'utf8');
          emailConfig = JSON.parse(configData);
        }

        if (emailConfig.enabled && emailConfig.email) {
          await emailService.sendMail(
            process.env.EMAIL_FROM || 'sparmeet162000@gmail.com',
            emailConfig.email,
            'CodeSnapGPT - Processed Transcription',
            `Transcription:\n${transcriptionText}\n\nAI Response:\n${responseText}`,
          );
        }
      } catch (emailErr) {
        console.error('Error sending email (non-fatal):', emailErr);
        // Don't throw - email failure shouldn't break the main flow
      }

      console.log('✅ Transcription processed successfully');

      res.json({
        success: true,
        data: processedEntry,
        fullTranscription: transcriptionText,
        fullResponse: responseText,
      });
    } catch (err) {
      console.error('Error processing transcription:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to process transcription',
        details: err.message,
      });
    }
  }

  /**
   * Get transcription for a session
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getTranscription(req, res) {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required',
        });
      }

      const transcriptionText = transcriptionStorageService.getFullTranscription(sessionId);
      const transcriptions = transcriptionStorageService.getTranscriptions(sessionId);
      const session = transcriptionStorageService.getSession(sessionId);

      res.json({
        success: true,
        sessionId,
        fullText: transcriptionText,
        chunks: transcriptions,
        createdAt: session ? session.createdAt : null,
      });
    } catch (err) {
      console.error('Error getting transcription:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to get transcription',
        details: err.message,
      });
    }
  }
}

export default new TranscriptionController();

