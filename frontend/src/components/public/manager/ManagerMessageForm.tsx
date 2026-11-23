import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  LockKeyhole,
  Mail,
  Phone,
  Send,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { SofraConfig } from '@/lib/sofra';
import './manager-message.css';

type Props = {
  slug: string;
  lang: string;
  contact: SofraConfig['managerContact'];
  onBusy?: (busy: boolean) => void;
};
export default function ManagerMessageForm({
  slug,
  lang,
  contact,
  onBusy,
}: Props) {
  const en = !lang.startsWith('tr');
  const [kind, setKind] = useState<'suggestion' | 'complaint'>('suggestion');
  const [message, setMessage] = useState(''),
    [name, setName] = useState(''),
    [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState('');
  const lock = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    onBusy?.(busy);
  }, [busy, onBusy]);
  useEffect(() => () => onBusy?.(false), [onBusy]);
  if (!contact.enabled) return null;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (lock.current || done || message.trim().length < 5) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await api(`/api/menu/${encodeURIComponent(slug)}/manager-messages`, {
        method: 'POST',
        body: JSON.stringify({ kind, message, fullName: name, contact: reply }),
      });
      if (alive.current) {
        setDone(true);
        setMessage('');
        setName('');
        setReply('');
      }
    } catch (err) {
      if (alive.current)
        setError(
          err instanceof Error
            ? err.message
            : en
              ? 'Please try again.'
              : 'Lütfen yeniden deneyin.',
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  if (done)
    return (
      <div className="manager-note-done" role="status">
        <span>
          <Check size={30} />
        </span>
        <h3>{en ? 'Your note is with the manager.' : 'Notunuz yöneticide.'}</h3>
        <p>
          {en
            ? 'Thank you for sharing. Only the restaurant’s administrators can read this note.'
            : 'Paylaştığınız için teşekkür ederiz. Bu notu yalnızca işletmenin yöneticileri okuyabilir.'}
        </p>
      </div>
    );
  return (
    <form
      className={`manager-note${busy ? ' is-sending' : ''}`}
      onSubmit={submit}
    >
      <aside className="manager-note__aside">
        <span className="manager-note__seal" aria-hidden>
          <Mail size={27} strokeWidth={1.2} />
          <LockKeyhole size={13} />
        </span>
        <h3>{en ? 'A direct line.' : 'Aramızda kalsın.'}</h3>
        <p>
          {en
            ? 'A good idea or something we should put right. Write directly to the manager.'
            : 'Güzel bir fikir ya da düzeltmemiz gereken bir şey. Doğrudan yöneticiye yazın.'}
        </p>
        {(contact.email || contact.phone) && (
          <div className="manager-note__contact">
            <small>
              {en ? 'Or reach out directly' : 'Dilerseniz doğrudan ulaşın'}
            </small>
            {contact.email && (
              <a href={`mailto:${encodeURIComponent(contact.email)}`}>
                <Mail size={16} />
                <span>{contact.email}</span>
                <ArrowUpRight size={14} />
              </a>
            )}
            {contact.phone && (
              <a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`}>
                <Phone size={16} />
                <span>{contact.phone}</span>
                <ArrowUpRight size={14} />
              </a>
            )}
          </div>
        )}
        <small className="manager-note__private">
          <LockKeyhole size={13} />
          {en
            ? 'Only restaurant administrators.'
            : 'Yalnızca işletme yöneticilerine.'}
        </small>
      </aside>
      <div className="manager-note__write">
        <fieldset disabled={busy} className="manager-note__fields">
          <div
            className="manager-note__kinds"
            role="group"
            aria-label={en ? 'Note type' : 'Notun türü'}
          >
            <button
              type="button"
              aria-pressed={kind === 'suggestion'}
              onClick={() => setKind('suggestion')}
            >
              {en ? 'An idea' : 'Bir önerim var'}
            </button>
            <button
              type="button"
              aria-pressed={kind === 'complaint'}
              onClick={() => setKind('complaint')}
            >
              {en ? 'A concern' : 'Bir sorun yaşadım'}
            </button>
          </div>
          <label className="manager-note__message">
            <span>{en ? 'Your note' : 'Notunuz'}</span>
            <textarea
              aria-label={en ? 'Your note' : 'Notunuz'}
              required
              minLength={5}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={en ? 'Dear manager…' : 'Sevgili yönetici…'}
            />
            <small>{message.length} / 2000</small>
          </label>
          <details className="manager-note__reply">
            <summary>
              {en ? 'Would you like a reply?' : 'Size dönelim mi?'}{' '}
              <small>{en ? 'optional' : 'isteğe bağlı'}</small>
              <ChevronDown size={15} />
            </summary>
            <label>
              <span>{en ? 'Your name' : 'Adınız'}</span>
              <input
                value={name}
                minLength={2}
                maxLength={150}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </label>
            <label>
              <span>{en ? 'Email or phone' : 'E-posta veya telefon'}</span>
              <input
                value={reply}
                maxLength={150}
                onChange={(e) => setReply(e.target.value)}
                placeholder={
                  en ? 'How can we reach you?' : 'Size nereden ulaşalım?'
                }
              />
            </label>
          </details>
        </fieldset>
        {error && (
          <p className="manager-note__error" role="alert">
            {error}
          </p>
        )}
        <button
          className="manager-note__send"
          type="submit"
          disabled={busy || message.trim().length < 5}
        >
          <span>
            {busy
              ? en
                ? 'Sending…'
                : 'İletiliyor…'
              : en
                ? 'Send to manager'
                : 'Yöneticiye ilet'}
          </span>
          <Send size={19} />
        </button>
      </div>
    </form>
  );
}
