import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUpRight,
  Bell,
  CarFront,
  Gamepad2,
  HandHelping,
  X,
} from 'lucide-react';
import {
  SERVICE_CALL_CONFIRMED_EVENT,
  type ServiceCallReceipt,
} from '@/lib/serviceCallFeedback';
import './service-call-notice.css';

const VISIBLE_MS = 6500;
const EXIT_MS = 320;

/** A receipt, not another request. Future service types can reuse the same event and presentation. */
export default function ServiceCallNotice({
  onGames,
}: {
  onGames?: () => void;
}) {
  const [notice, setNotice] = useState<
    (ServiceCallReceipt & { sequence: number }) | null
  >(null);
  const [visible, setVisible] = useState(false);
  const [settled, setSettled] = useState(false);
  const [paused, setPaused] = useState(false);
  const sequence = useRef(0);
  const root = useRef<HTMLElement>(null);
  const priorFocus = useRef<HTMLElement | null>(null);
  const dismiss = useCallback(() => {
    setVisible(false);
    if (
      root.current?.contains(document.activeElement) &&
      priorFocus.current?.isConnected
    ) {
      priorFocus.current.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => {
    const confirmed = (event: Event) => {
      const detail = (event as CustomEvent<ServiceCallReceipt>).detail;
      if (!detail || typeof detail.kind !== 'string') return;
      priorFocus.current = document.activeElement as HTMLElement | null;
      let lang = detail.lang || 'tr';
      if (!detail.lang) {
        try {
          lang = localStorage.getItem('menu_lang') || 'tr';
        } catch {
          /* Use Turkish. */
        }
      }
      setNotice({ ...detail, lang, sequence: ++sequence.current });
      setSettled(false);
      setPaused(false);
      setVisible(true);
    };
    window.addEventListener(SERVICE_CALL_CONFIRMED_EVENT, confirmed);
    return () =>
      window.removeEventListener(SERVICE_CALL_CONFIRMED_EVENT, confirmed);
  }, []);

  useEffect(() => {
    if (!notice || !visible) return;
    const timer = window.setTimeout(() => setSettled(true), 1700);
    return () => window.clearTimeout(timer);
  }, [notice, visible]);
  useEffect(() => {
    if (!notice || !visible || paused) return;
    const timer = window.setTimeout(dismiss, VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [notice, visible, paused, dismiss]);
  useEffect(() => {
    if (visible || !notice) return;
    const timer = window.setTimeout(() => setNotice(null), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [visible, notice]);

  if (!notice) return null;
  const en = notice.lang?.split('-')[0] !== 'tr';
  const Icon =
    notice.kind === 'waiter'
      ? HandHelping
      : notice.kind === 'valet'
        ? CarFront
        : Bell;
  const title = notice.duplicate
    ? en
      ? 'Your request is already sent'
      : 'Çağrın zaten iletildi'
    : notice.kind === 'waiter'
      ? en
        ? 'Waiter called'
        : 'Garson çağrıldı'
      : notice.kind === 'valet'
        ? en
          ? 'Valet called'
          : 'Vale çağrıldı'
        : en
          ? 'Request sent'
          : 'Çağrın iletildi';

  return createPortal(
    <div className="service-notice-host">
      <section
        key={notice.sequence}
        ref={root}
        className={`service-notice ${visible ? 'is-visible' : 'is-leaving'} ${settled ? 'is-settled' : ''}`}
        inert={!visible}
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() =>
          setPaused(root.current?.contains(document.activeElement) || false)
        }
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setPaused(false);
        }}
      >
        <span className="service-notice__symbol" aria-hidden="true">
          <span className="service-notice__wave" />
          <span className="service-notice__wave service-notice__wave--second" />
          <Icon
            className="service-notice__service-icon"
            size={29}
            strokeWidth={1.6}
          />
          <svg
            className="service-notice__check"
            width="30"
            height="30"
            viewBox="0 0 30 30"
            fill="none"
          >
            <path
              d="m7 15 5.5 5.5L23 10"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div
          className="service-notice__copy"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="service-notice__eyebrow">
            <span className="service-notice__dot" />
            {en ? 'REQUEST RECEIVED' : 'ÇAĞRIN ALINDI'}
            {notice.tableNumber && (
              <span className="service-notice__table">
                {en ? 'Table' : 'Masa'} {notice.tableNumber}
              </span>
            )}
          </div>
          <h2>{title}</h2>
          <p>
            {notice.duplicate
              ? en
                ? 'The team already has your request.'
                : 'Talebin ekibe daha önce ulaştı.'
              : en
                ? 'Your request has been sent to the team.'
                : 'Talebin ekibe başarıyla iletildi.'}
          </p>
        </div>
        <button
          type="button"
          className="service-notice__close"
          aria-label={en ? 'Dismiss notification' : 'Bildirimi kapat'}
          onClick={dismiss}
        >
          <X size={18} />
        </button>
        {settled && onGames && notice.kind === 'waiter' && (
          <div className="service-notice__after">
            <span>{en ? 'While you wait…' : 'Beklerken küçük bir mola…'}</span>
            <button
              type="button"
              onClick={() => {
                setVisible(false);
                onGames();
              }}
            >
              <Gamepad2 size={17} />
              {en ? 'Explore games' : 'Oyunlara göz at'}
              <ArrowUpRight size={17} />
            </button>
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}
