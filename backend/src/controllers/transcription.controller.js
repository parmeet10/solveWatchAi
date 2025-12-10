import aiService from '../services/ai.service.js';
import transcriptionStorageService from '../services/transcription-storage.service.js';
import imageProcessingService from '../services/image-processing.service.js';
import emailService from '../services/email.service.js';
import pythonServiceWS from '../services/python-service.ws.js';
import fs from 'fs';
import path from 'path';

const EMAIL_CONFIG_FILE_PATH = path.join(
  process.cwd(),
  'backend',
  'config',
  'email-config.json',
);

class TranscriptionController {
  /**
   * Process transcription with AI
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async processTranscription(req, res) {
    try {
      const { sessionId, cutoffTimestamp } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required',
        });
      }

      console.log(`📝 Processing transcription for session: ${sessionId}`);

      // Flush buffer before retrieving transcriptions to ensure all audio is processed
      try {
        console.log(`🔄 Flushing buffer for session: ${sessionId}`);
        await pythonServiceWS.flushBuffer(
          sessionId,
          cutoffTimestamp || null,
          500,
        );

        // Wait additional grace period to ensure all transcriptions are stored
        // This catches any in-transit packets and ensures backend has received all transcriptions
        await new Promise((resolve) => setTimeout(resolve, 400));

        console.log(`✅ Buffer flushed, retrieving transcriptions`);
      } catch (flushError) {
        console.warn(
          `⚠️ Error flushing buffer (non-fatal): ${flushError.message}`,
        );
        // Continue anyway - might still have transcriptions
      }

      // Get full transcription for the session
      const transcriptionText =
        transcriptionStorageService.getFullTranscription(sessionId);

      // Debug: Check what sessions exist
      const activeSessions = transcriptionStorageService.getActiveSessions();
      console.log(
        `[processTranscription] Active sessions: ${activeSessions.join(', ')}`,
      );
      console.log(`[processTranscription] Requested sessionId: ${sessionId}`);
      console.log(
        `[processTranscription] Session exists: ${
          transcriptionStorageService.getSession(sessionId) !== null
        }`,
      );
      console.log(
        `[processTranscription] Transcription length: ${
          transcriptionText ? transcriptionText.length : 0
        }`,
      );

      if (!transcriptionText || transcriptionText.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'No transcription found for this session',
          debug: {
            sessionId,
            activeSessions,
            sessionExists:
              transcriptionStorageService.getSession(sessionId) !== null,
          },
        });
      }

      console.log(`📝 Processing transcription for session: ${sessionId}`);
      console.log(
        `📄 Transcription text (first 200 chars): ${transcriptionText.substring(
          0,
          200,
        )}...`,
      );

      // Process with AI
      const aiResponse = await aiService.askGptTranscription(transcriptionText);
      const responseText = aiResponse.message.content;

      // Store the response for context mode (if enabled)
      imageProcessingService.setLastResponse(responseText);

      // Create a processed data entry
      const processedEntry = {
        filename: `transcription-${sessionId}`,
        timestamp: new Date().toLocaleString(),
        extractedText:
          transcriptionText.substring(0, 500) +
          (transcriptionText.length > 500 ? '...' : ''),
        gptResponse:
          responseText.substring(0, 1000) +
          (responseText.length > 1000 ? '...' : ''),
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

      // Clear transcription storage for this session so next "pp" only processes new audio
      transcriptionStorageService.clearSession(sessionId);
      console.log(`🧹 Cleared transcription storage for session: ${sessionId}`);

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

      const transcriptionText =
        transcriptionStorageService.getFullTranscription(sessionId);
      const transcriptions =
        transcriptionStorageService.getTranscriptions(sessionId);
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

  /**
   * Get latest active session ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getLatestSession(req, res) {
    try {
      const activeSessions = transcriptionStorageService.getActiveSessions();

      console.log(
        `[getLatestSession] Active sessions: ${activeSessions.length}`,
      );
      if (activeSessions.length === 0) {
        return res.json({
          success: false,
          sessionId: null,
          message: 'No active sessions found',
        });
      }

      // Get the most recent session (by creation time) that has transcriptions
      let latestSession = null;
      let latestTime = 0;

      for (const sessionId of activeSessions) {
        const session = transcriptionStorageService.getSession(sessionId);
        if (!session) {
          continue;
        }

        // Check if session has transcriptions
        const fullTranscription =
          transcriptionStorageService.getFullTranscription(sessionId);
        if (!fullTranscription || fullTranscription.trim() === '') {
          console.log(
            `[getLatestSession] Skipping session ${sessionId} - no transcriptions`,
          );
          continue;
        }

        if (session.createdAt) {
          const sessionTime = new Date(session.createdAt).getTime();
          if (sessionTime > latestTime) {
            latestTime = sessionTime;
            latestSession = sessionId;
          }
        } else {
          // If no createdAt, use this session if we don't have one yet
          if (!latestSession) {
            latestSession = sessionId;
          }
        }
      }

      // If no session has createdAt, return the first one with transcriptions
      if (!latestSession && activeSessions.length > 0) {
        for (const sessionId of activeSessions) {
          const fullTranscription =
            transcriptionStorageService.getFullTranscription(sessionId);
          if (fullTranscription && fullTranscription.trim() !== '') {
            latestSession = sessionId;
            break;
          }
        }
      }

      if (!latestSession) {
        console.log('[getLatestSession] No sessions with transcriptions found');
        return res.json({
          success: false,
          sessionId: null,
          message: 'No active sessions with transcriptions found',
        });
      }

      console.log(
        `[getLatestSession] Returning latest session: ${latestSession}`,
      );
      res.json({
        success: true,
        sessionId: latestSession,
      });
    } catch (err) {
      console.error('Error getting latest session:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to get latest session',
        details: err.message,
      });
    }
  }
}

export default new TranscriptionController();
