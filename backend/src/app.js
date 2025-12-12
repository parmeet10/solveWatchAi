import express from 'express';
import cors from 'cors';
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
import logger from './utils/logger.js';

dotenv.config();

const log = logger('App');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', imageRoutes);
app.use('/api', contextRoutes);
app.use('/api', clipboardRoutes);
app.use('/api', configRoutes);
app.use('/api', transcribeRoutes);

// Frontend is served by Vite dev server at https://192.168.178.46:3000
// Backend only serves API endpoints and WebSocket connections

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
