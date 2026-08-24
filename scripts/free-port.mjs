/**
 * Dev başlamadan önce portu boşalt (Windows + Unix).
 * Kullanım: node scripts/free-port.mjs 3001
 */
import { execSync } from 'node:child_process';

const port = Number(process.argv[2] || 3001);
if (!Number.isFinite(port) || port <= 0) {
  console.error('[free-port] Geçersiz port:', process.argv[2]);
  process.exit(1);
}

function killWindowsPort(targetPort) {
  try {
    const out = execSync(`netstat -ano | findstr :${targetPort}`, { encoding: 'utf8' });
    const pids = new Set(
      out
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.includes('LISTENING'))
        .map((line) => line.split(/\s+/).pop())
        .filter((pid) => pid && pid !== '0')
    );

    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`[free-port] Port ${targetPort} — PID ${pid} kapatıldı`);
      } catch {
        /* process may already be gone */
      }
    }
  } catch {
    /* port free */
  }
}

function killUnixPort(targetPort) {
  try {
    execSync(`npx --yes kill-port ${targetPort}`, { stdio: 'inherit' });
  } catch {
    /* port free or kill-port unavailable */
  }
}

if (process.platform === 'win32') {
  killWindowsPort(port);
} else {
  killUnixPort(port);
}
