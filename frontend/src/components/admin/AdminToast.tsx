import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, CircleAlert, X } from 'lucide-react';
import './admin-toast.css';

export type AdminToastNotice = { text: string; error: boolean } | null;

/** Floating, non-blocking feedback. It never reserves space in the page or takes focus. */
export default function AdminToast({
  notice,
  onClose,
}: {
  notice: AdminToastNotice;
  onClose: () => void;
}) {
  const [leaving, setLeaving] = useState(false),
    [paused, setPaused] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const duration = notice?.error ? 7000 : 4000;
  useEffect(() => {
    setPaused(false);
  }, [notice]);
  useEffect(() => {
    setLeaving(false);
    if (!notice || paused) return;
    const exit = window.setTimeout(() => setLeaving(true), duration - 180);
    const done = window.setTimeout(() => closeRef.current(), duration);
    return () => {
      clearTimeout(exit);
      clearTimeout(done);
    };
  }, [notice, paused, duration]);
  if (!notice) return null;
  return createPortal(
    <div
      className={`admin-toast${notice.error ? ' is-error' : ''}${leaving ? ' is-leaving' : ''}`}
      role={notice.error ? 'alert' : 'status'}
      aria-atomic="true"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <span className="admin-toast__icon" aria-hidden="true">
        {notice.error ? <CircleAlert size={19} /> : <Check size={19} />}
      </span>
      <span className="admin-toast__text">{notice.text}</span>
      <button
        type="button"
        aria-label="Bildirimi kapat"
        onClick={() => closeRef.current()}
      >
        <X size={17} />
      </button>
    </div>,
    document.body,
  );
}
