/**
 * Multer middleware for audio file uploads
 */
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { CONFIG } from '../config/constants.js';

// Ensure upload directory exists
if (!fs.existsSync(CONFIG.UPLOAD_DIR)) {
  fs.mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, CONFIG.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'audio-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const extname = CONFIG.ALLOWED_AUDIO_TYPES.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype =
    file.mimetype &&
    (file.mimetype.startsWith('audio/') ||
      file.mimetype.startsWith('video/') ||
      CONFIG.ALLOWED_AUDIO_TYPES.test(file.mimetype));

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed! (MP3, WAV, M4A, etc.)'));
  }
};

export const audioUpload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: CONFIG.MAX_AUDIO_FILE_SIZE },
});
