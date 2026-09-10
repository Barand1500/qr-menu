/** Garson PWA yardımcıları — kurulum, bildirim, titreşim */

const SW_URL = '/garson-sw.js';
const MANIFEST_URL = '/garson-manifest.webmanifest';

export function isGarsonStandalone() {
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    return Boolean(nav.standalone);
  } catch {
    return false;
  }
}

export function injectGarsonManifest() {
  let link = document.querySelector('link[data-garson-manifest]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'manifest';
    link.setAttribute('data-garson-manifest', '1');
    document.head.appendChild(link);
  }
  link.href = MANIFEST_URL;

  let apple = document.querySelector('link[data-garson-apple]') as HTMLLinkElement | null;
  if (!apple) {
    apple = document.createElement('link');
    apple.rel = 'apple-touch-icon';
    apple.setAttribute('data-garson-apple', '1');
    document.head.appendChild(apple);
  }
  apple.href = '/garson-apple-touch.png';

  document.querySelectorAll('meta[data-garson-meta]').forEach((n) => n.remove());
  const metas: [string, string][] = [
    ['theme-color', '#0f766e'],
    ['apple-mobile-web-app-capable', 'yes'],
    ['apple-mobile-web-app-status-bar-style', 'black-translucent'],
    ['apple-mobile-web-app-title', 'Garson'],
    ['mobile-web-app-capable', 'yes'],
  ];
  for (const [name, content] of metas) {
    const m = document.createElement('meta');
    m.setAttribute('data-garson-meta', '1');
    m.name = name;
    m.content = content;
    document.head.appendChild(m);
  }
}

export async function registerGarsonServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(SW_URL, { scope: '/' });
  } catch {
    return null;
  }
}

export async function ensureGarsonNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function vibrateGarsonAlert() {
  try {
    if (navigator.vibrate) navigator.vibrate([180, 80, 180, 80, 240]);
  } catch {
    /* ignore */
  }
}

export async function showGarsonCallNotification(opts: {
  title: string;
  body: string;
  tag?: string;
}) {
  vibrateGarsonAlert();
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const options = {
    body: opts.body,
    icon: '/garson-icon-192.png',
    badge: '/garson-icon-192.png',
    tag: opts.tag || 'garson-call',
    renotify: true,
    vibrate: [180, 80, 180, 80, 240],
    data: { url: '/garson' },
  } as NotificationOptions & { vibrate?: number[]; renotify?: boolean };

  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg?.showNotification) {
      await reg.showNotification(opts.title, options);
      return;
    }
  } catch {
    /* fall through */
  }

  try {
    const n = new Notification(opts.title, options);
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* ignore */
  }
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredInstall: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<(ready: boolean) => void>();

export function getDeferredGarsonInstall() {
  return deferredInstall;
}

export function subscribeGarsonInstallReady(cb: (ready: boolean) => void) {
  installListeners.add(cb);
  cb(Boolean(deferredInstall) && !isGarsonStandalone());
  return () => installListeners.delete(cb);
}

export function armGarsonInstallCapture() {
  const onBip = (e: Event) => {
    e.preventDefault();
    deferredInstall = e as BeforeInstallPromptEvent;
    installListeners.forEach((cb) => cb(true));
  };
  window.addEventListener('beforeinstallprompt', onBip);
  return () => window.removeEventListener('beforeinstallprompt', onBip);
}

export async function promptGarsonInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (isGarsonStandalone()) return 'unavailable';
  if (!deferredInstall) return 'unavailable';
  const ev = deferredInstall;
  deferredInstall = null;
  installListeners.forEach((cb) => cb(false));
  await ev.prompt();
  const choice = await ev.userChoice;
  return choice.outcome;
}

export function isIosSafari() {
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua);
  const chrome = /CriOS|FxiOS|EdgiOS/.test(ua);
  return iOS && webkit && !chrome;
}
