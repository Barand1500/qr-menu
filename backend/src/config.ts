import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 3001,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174').split(','),
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  version: '0.1.0',
};
