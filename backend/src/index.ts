import 'dotenv/config';
import { createApp } from './app.js';
import { config } from './config.js';
import { ensureDefaultCurrency } from './lib/currencies.js';

const app = createApp();

ensureDefaultCurrency().catch((err) => {
  console.warn('[backend] Varsayılan para birimi (TRY) oluşturulamadı:', err);
});

const server = app.listen(config.port, () => {
  console.log(`Menu QR: http://localhost:${config.port}`);
  console.log(`API:     http://localhost:${config.port}/api`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\n[backend] Port ${config.port} zaten kullanımda.\n` +
        `Çözüm: proje kökünden "npm run dev" çalıştırın veya "npm run dev:backend" ile eski süreç otomatik kapatılır.\n` +
        `Manuel: npx kill-port ${config.port}\n`
    );
    process.exit(1);
  }
  console.error('[backend] Sunucu hatası:', err);
  process.exit(1);
});
