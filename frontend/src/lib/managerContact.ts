import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { SofraConfig } from '@/lib/sofra';
type Contact = SofraConfig['managerContact'];
const EMPTY: Contact = { enabled: false, email: '', phone: '' };
const EVENT = 'menu-manager-contact-updated';
export function notifyManagerContactChanged() {
  window.dispatchEvent(new Event(EVENT));
  try {
    localStorage.setItem(EVENT, String(Date.now()) + Math.random());
  } catch {
    /* storage can be unavailable */
  }
}
/** Keep open menus in sync without sharing any private message content. */
export function useManagerContact(
  slug: string | null | undefined,
  initial?: Contact,
): Contact {
  const [contact, setContact] = useState(initial || EMPTY);
  useEffect(() => {
    setContact(initial || EMPTY);
    if (!slug) return;
    let alive = true,
      request = 0;
    const refresh = () => {
      const id = ++request;
      void api<Contact>(
        `/api/menu/${encodeURIComponent(slug)}/manager-contact`,
        { cache: 'no-store' },
      )
        .then((value) => {
          if (alive && id === request) setContact(value);
        })
        .catch(() => {
          /* Keep the last known state; the submission endpoint checks the saved setting. */
        });
    };
    const visible = () => {
      if (!document.hidden) refresh();
    };
    const changed = (e: StorageEvent) => {
      if (e.key === EVENT) refresh();
    };
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener('storage', changed);
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    const timer = window.setInterval(visible, 30000);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener('storage', changed);
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
    };
    // Only saved values matter, not a new object identity on ordinary page updates.
  }, [slug, initial?.enabled, initial?.email, initial?.phone]);
  return slug ? contact : EMPTY;
}
