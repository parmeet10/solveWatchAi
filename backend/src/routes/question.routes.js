import express from 'express';
import questionController from '../controllers/question.controller.js';

const router = express.Router();

/**
 * POST /api/question/process
 * Process the latest question from a session with AI
 * Body: { sessionId?: string } (optional - will use latest if not provided)
 */
router.post('/process', questionController.processQuestion.bind(questionController));

/**
 * GET /api/question/latest-session
 * Get the latest active session ID that has questions
 */
router.get('/latest-session', questionController.getLatestSession.bind(questionController));

/**
 * GET /api/question/:sessionId
 * Get question(s) for a specific session
 */
router.get('/:sessionId', questionController.getQuestion.bind(questionController));

export default router;

