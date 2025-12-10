import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import imageRoutes from './routes/image.routes.js';
import contextRoutes from './routes/context.routes.js';
import clipboardRoutes from './routes/clipboard.routes.js';
import configRoutes from './routes/config.routes.js';
import transcribeRoutes from './routes/transcribe.routes.js';
import {
  errorHandler,
  notFoundHandler,
} from './middleware/error.middleware.js';
import { CONFIG } from './config/constants.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes (must be before static files)
app.use('/api', imageRoutes);
app.use('/api', contextRoutes);
app.use('/api', clipboardRoutes);
app.use('/api', configRoutes);
app.use('/api', transcribeRoutes);

// Serve static files from frontend/dist (React build)
const frontendDistPath = path.join(process.cwd(), 'frontend', 'dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
} else {
  console.warn(
    '⚠️  Frontend dist folder not found. Run "npm run build" to build the React app.',
  );
}

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
