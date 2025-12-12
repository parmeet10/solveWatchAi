/**
 * Routes for transcription endpoints
 */
import express from 'express';
import transcribeController from '../controllers/transcribe.controller.js';
import transcriptionController from '../controllers/transcription.controller.js';
import { audioUpload } from '../middleware/audio-upload.middleware.js';

const router = express.Router();

router.post('/transcribe', audioUpload.single('audio'), (req, res) => {
  transcribeController.transcribeFile(req, res);
});

// Process stored transcription with AI
router.post('/transcription/process', (req, res) => {
  transcriptionController.processTranscription(req, res);
});

// Get latest active session (must be before /:sessionId route)
router.get('/transcription/latest-session', (req, res) => {
  transcriptionController.getLatestSession(req, res);
});

// Get transcription for a session (must be after specific routes)
router.get('/transcription/:sessionId', (req, res) => {
  transcriptionController.getTranscription(req, res);
});

export default router;
