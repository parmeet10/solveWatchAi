import imageProcessingService from '../services/image-processing.service.js';
import logger from '../utils/logger.js';

const log = logger('ContextController');

class ContextController {
  getContextState(req, res) {
    try {
      const useContextEnabled = imageProcessingService.getUseContextEnabled();
      res.json({ useContextEnabled });
    } catch (err) {
      log.error('Error getting context state', err);
      res.status(500).json({ error: 'Failed to get context state' });
    }
  }

  updateContextState(req, res) {
    try {
      const { enabled } = req.body;
      if (typeof enabled === 'boolean') {
        imageProcessingService.setUseContextEnabled(enabled);
        log.info(`Use Context ${enabled ? 'ENABLED' : 'DISABLED'}`);
        res.json({ success: true, useContextEnabled: enabled });
      } else {
        res
          .status(400)
          .json({ error: 'Invalid request. "enabled" must be a boolean.' });
      }
    } catch (err) {
      log.error('Error updating context state', err);
      res.status(500).json({ error: 'Failed to update context state' });
    }
  }
}

export default new ContextController();
