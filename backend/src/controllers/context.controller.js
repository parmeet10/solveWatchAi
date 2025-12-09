import imageProcessingService from '../services/image-processing.service.js';

class ContextController {
  getContextState(req, res) {
    try {
      const useContextEnabled = imageProcessingService.getUseContextEnabled();
      res.json({ useContextEnabled });
    } catch (err) {
      console.error('Error getting context state:', err);
      res.status(500).json({ error: 'Failed to get context state' });
    }
  }

  updateContextState(req, res) {
    try {
      const { enabled } = req.body;
      if (typeof enabled === 'boolean') {
        imageProcessingService.setUseContextEnabled(enabled);
        console.log(
          `🔄 Use Context ${
            enabled ? 'ENABLED' : 'DISABLED'
          } - Will apply to uploads, auto-detected screenshots, and clipboard monitoring`,
        );
        res.json({ success: true, useContextEnabled: enabled });
      } else {
        res
          .status(400)
          .json({ error: 'Invalid request. "enabled" must be a boolean.' });
      }
    } catch (err) {
      console.error('Error updating context state:', err);
      res.status(500).json({ error: 'Failed to update context state' });
    }
  }
}

export default new ContextController();
