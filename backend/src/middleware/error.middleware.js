import multer from 'multer';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

const log = logger('ErrorMiddleware');

export const errorHandler = (err, req, res, next) => {
  log.error('Request error', err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 10MB.',
      });
    }
  }

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
};

export const notFoundHandler = (req, res) => {
  // Skip API routes - return 404 JSON
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      error: 'Route not found',
    });
  }

  // For all other routes, serve the React app (SPA routing)
  const frontendDistPath = path.join(process.cwd(), 'frontend', 'dist');
  const indexPath = path.join(frontendDistPath, 'index.html');

  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
};
