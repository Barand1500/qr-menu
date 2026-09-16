import 'dotenv/config';

const jwtFromEnv = process.env.JWT_SECRET?.trim();
if (!jwtFromEnv && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET production ortamında zorunludur');
}

export const config = {
  port: Number(process.env.PORT) || 3001,
  jwtSecret: jwtFromEnv || 'dev-secret',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174').split(','),
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  version: '0.1.0',
};
