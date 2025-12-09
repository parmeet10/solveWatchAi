import express from 'express';
import clipboardController from '../controllers/clipboard.controller.js';

const router = express.Router();

router.post('/clipboard', (req, res) => {
  clipboardController.processClipboard(req, res);
});

export default router;

