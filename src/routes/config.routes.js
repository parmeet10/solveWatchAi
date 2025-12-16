import express from 'express';
import configController from '../controllers/config.controller.js';

const router = express.Router();

router.get('/config/keys', (req, res) => {
  configController.getApiKeys(req, res);
});

router.post('/config/keys', (req, res) => {
  configController.saveApiKeys(req, res);
});

export default router;
