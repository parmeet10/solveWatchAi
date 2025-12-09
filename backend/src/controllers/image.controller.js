import fs from 'fs';
import imageProcessingService from '../services/image-processing.service.js';
import { upload } from '../middleware/upload.middleware.js';

class ImageController {
  async uploadImage(req, res) {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const useContextEnabled = imageProcessingService.getUseContextEnabled();

    try {
      const result = await imageProcessingService.processImage(
        filePath,
        fileName,
        useContextEnabled
      );

      // Clean up uploaded file after processing
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting uploaded file:', err);
      });

      res.json({
        success: true,
        message: 'Image processed successfully',
        filename: fileName,
        extractedText: result.extractedText.substring(0, 200) + '...',
        gptResponse: result.gptResponse.substring(0, 200) + '...',
        usedContext: result.usedContext,
      });
    } catch (err) {
      // Clean up uploaded file on error
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting uploaded file:', err);
      });

      res.status(500).json({
        success: false,
        error: err.message || 'Error processing image',
      });
    }
  }

  getProcessedData(req, res) {
    try {
      const data = imageProcessingService.getProcessedData();
      res.json(data || []);
    } catch (err) {
      console.error('Error serving data:', err);
      res.json([]);
    }
  }
}

export default new ImageController();

