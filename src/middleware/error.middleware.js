import multer from 'multer';
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
  // Backend only serves API endpoints and WebSocket connections
  // COMMENTED OUT: Frontend removed
  // // Frontend is served by Vite dev server at https://192.168.178.46:3000
  res.status(404).json({
    success: false,
    error: 'Route not found',
    // COMMENTED OUT: Frontend removed
    // message:
    //   'Backend only serves API endpoints. Access frontend at https://192.168.178.46:3000',
  });
};
