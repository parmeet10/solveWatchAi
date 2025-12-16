import express from 'express';
import contextController from '../controllers/context.controller.js';

const router = express.Router();

router.get('/context-state', (req, res) => {
  contextController.getContextState(req, res);
});

router.post('/context-state', (req, res) => {
  contextController.updateContextState(req, res);
});

export default router;

