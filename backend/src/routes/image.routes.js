import express from 'express';
import imageController from '../controllers/image.controller.js';
import { upload } from '../middleware/upload.middleware.js';

const router = express.Router();

router.post('/upload', upload.single('image'), (req, res) => {
  imageController.uploadImage(req, res);
});

router.get('/data', (req, res) => {
  imageController.getProcessedData(req, res);
});

export default router;

