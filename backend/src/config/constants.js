import os from 'os';
import path from 'path';

export const CONFIG = {
  PORT: process.env.PORT || 4000,
  HTTPS_PORT: process.env.HTTPS_PORT || 8443,
  FUNCTION_INTERVAL: process.env.FUNCTION_INTERVAL || 5000,
  SCREENSHOTS_PATH:
    process.env.SCREENSHOTS_PATH || '/Users/parmeet1.0/Documents/screenshots',
  UPLOAD_DIR: path.join(process.cwd(), 'uploads'),
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_AUDIO_FILE_SIZE: 25 * 1024 * 1024, // 25MB for audio files
  ALLOWED_IMAGE_TYPES: /jpeg|jpg|png|gif|bmp|webp/,
  ALLOWED_AUDIO_TYPES: /mp3|wav|m4a|mpeg|mp4|webm/,
  BLACKLISTED_FILES: ['.DS_Store'],
  REFRESH_INTERVAL: 2000, // 2 seconds for frontend refresh
  PYTHON_SERVICE_URL: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
  PYTHON_SERVICE_WS_URL:
    process.env.PYTHON_SERVICE_WS_URL || 'ws://localhost:8000',
};

export const getLocalIP = () => {
  const networkInterfaces = os.networkInterfaces();
  let localIP = 'localhost';

  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
    if (localIP !== 'localhost') break;
  }

  return localIP;
};
