import aiService from '../services/ai.service.js';
import questionStorageService from '../services/question-storage.service.js';
import imageProcessingService from '../services/image-processing.service.js';
import emailService from '../services/email.service.js';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

const log = logger('QuestionController');

const EMAIL_CONFIG_FILE_PATH = path.join(
  process.cwd(),
  'backend',
  'config',
  'email-config.json',
);

class QuestionController {
  /**
   * Process extracted question with AI
   * Called when user presses Cmd+Shift+P
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async processQuestion(req, res) {
    try {
      let { sessionId } = req.body;

      // If no sessionId provided, get the latest active session
      if (!sessionId) {
        sessionId = questionStorageService.getLatestActiveSession();
        if (!sessionId) {
          return res.status(400).json({
            success: false,
            error: 'No active question session found',
            message:
              'No questions available. Make sure your mobile app is sending text chunks.',
          });
        }
        log.debug('No sessionId provided, using latest active session', {
          sessionId,
        });
      }

      log.info(`Processing question for session: ${sessionId}`);

      // Get the latest question from the session
      const question = questionStorageService.getLatestQuestion(sessionId);

      if (!question) {
        return res.status(400).json({
          success: false,
          error: 'No question found for this session',
          sessionId,
        });
      }

      log.info('Processing question - Cmd+Shift+P triggered', {
        sessionId,
        question: question.question,
        questionLength: question.question.length,
        questionType: question.type,
        confidence: question.confidence,
      });

      // Process question with AI
      log.info('Sending question to AI service', {
        sessionId,
        question: question.question,
        provider: 'fallback-enabled',
      });

      const aiResponse = await aiService.askGptQuestion(question.question);
      const answer = aiResponse.message.content;
      const provider = aiResponse.provider || 'unknown';

      log.info('AI response received', {
        sessionId,
        question: question.question,
        answer: answer,
        answerLength: answer.length,
        provider: provider,
        answerPreview: answer.substring(0, 200),
      });

      // Store the response for context mode (if enabled)
      imageProcessingService.setLastResponse(answer);

      // Create a processed data entry (same format as transcription)
      const processedEntry = {
        filename: `question-${sessionId}`,
        timestamp: new Date().toLocaleString(),
        extractedText:
          question.question.substring(0, 500) +
          (question.question.length > 500 ? '...' : ''),
        gptResponse:
          answer.substring(0, 1000) + (answer.length > 1000 ? '...' : ''),
        usedContext: false,
        type: 'question',
      };

      // Add to processed data (same way as transcriptions/screenshots)
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
            'CodeSnapGPT - Processed Question',
            `Question:\n${question.question}\n\nAI Response:\n${answer}`,
          );
        }
      } catch (emailErr) {
        log.error('Error sending email (non-fatal)', emailErr);
        // Don't throw - email failure shouldn't break the main flow
      }

      log.info('Question processed successfully - Cmd+Shift+P completed', {
        sessionId,
        question: question.question,
        answer: answer,
        questionLength: question.question.length,
        answerLength: answer.length,
        provider: provider,
        processedEntry: {
          filename: processedEntry.filename,
          type: processedEntry.type,
          timestamp: processedEntry.timestamp,
        },
      });

      // Clear question storage for this session so next "Cmd+Shift+P" only processes new questions
      questionStorageService.clearSession(sessionId);
      log.debug(`Cleared question storage for session: ${sessionId}`);

      res.json({
        success: true,
        data: processedEntry,
        question: question.question,
        fullResponse: answer,
      });
    } catch (err) {
      log.error('Error processing question', err);
      res.status(500).json({
        success: false,
        error: 'Failed to process question',
        details: err.message,
      });
    }
  }

  /**
   * Get question for a session
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getQuestion(req, res) {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required',
        });
      }

      const question = questionStorageService.getLatestQuestion(sessionId);
      const allQuestions = questionStorageService.getQuestions(sessionId);
      const session = questionStorageService.getSession(sessionId);

      if (!question) {
        return res.status(404).json({
          success: false,
          error: 'No question found for this session',
        });
      }

      res.json({
        success: true,
        sessionId,
        latestQuestion: question,
        allQuestions: allQuestions,
        createdAt: session ? session.createdAt : null,
        lastUpdated: session ? session.lastUpdated : null,
      });
    } catch (err) {
      log.error('Error getting question', err);
      res.status(500).json({
        success: false,
        error: 'Failed to get question',
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
      const latestSession = questionStorageService.getLatestActiveSession();

      log.debug('Getting latest question session', {
        latestSession,
      });

      if (!latestSession) {
        return res.json({
          success: false,
          sessionId: null,
          message: 'No active sessions with questions found',
        });
      }

      res.json({
        success: true,
        sessionId: latestSession,
      });
    } catch (err) {
      log.error('Error getting latest session', err);
      res.status(500).json({
        success: false,
        error: 'Failed to get latest session',
        details: err.message,
      });
    }
  }
}

export default new QuestionController();

