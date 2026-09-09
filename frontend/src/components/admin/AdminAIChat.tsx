import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Send,
  X,
  ArrowUpRight,
  Loader2,
  CircleHelp,
  PictureInPicture2,
  Maximize2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { adminPath } from '@/lib/adminPath';
import '@/admin-ai.css';

type AiAction =
  | { type: 'navigate'; path: string; label: string }
  | { type: 'created'; kind: 'group' | 'product' | 'user'; id: number; label: string }
  | { type: 'reload' };

type ChatMsg = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  actions?: AiAction[];
};

const SUGGESTIONS = [
  'Merhaba',
  'Rapor ver',
  'Ürünler sayfasını aç',
  'Grup ekle Tatlılar',
  'Yardım',
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AdminAIChat({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [pip, setPip] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pipRef = useRef(false);

  useEffect(() => {
    pipRef.current = pip;
  }, [pip]);

  useEffect(() => {
    if (!open) {
      setMessages([]);
      setInput('');
      setBusy(false);
      setPip(false);
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 180);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const runNavigate = (path: string) => {
    navigate(adminPath(...(path ? path.split('/') : [])));
    if (!pipRef.current) onClose();
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;

    const userMsg: ChatMsg = { id: uid(), role: 'user', text };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setBusy(true);

    try {
      const res = await api<{ reply: string; actions?: AiAction[] }>('/api/admin/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      });
      setMessages((m) => [
        ...m,
        {
          id: uid(),
          role: 'assistant',
          text: res.reply,
          actions: res.actions,
        },
      ]);

      const nav = res.actions?.find((a) => a.type === 'navigate');
      if (nav && /sayfasina yonlendiriyorum|yönlendiriyorum/i.test(res.reply)) {
        window.setTimeout(() => runNavigate(nav.path), 650);
      }

      if (res.actions?.some((a) => a.type === 'reload')) {
        window.setTimeout(() => {
          window.location.reload();
        }, 900);
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: uid(),
          role: 'assistant',
          text: err instanceof Error ? err.message : 'Bir sorun oluştu.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  if (!open) return null;

  return createPortal(
    <div
      className={`admin-ai-root${pip ? ' admin-ai-root--pip' : ''}`}
      role="dialog"
      aria-modal={!pip}
      aria-label="Yapay zeka asistanı"
    >
      {!pip && <div className="admin-ai-backdrop" aria-hidden />}
      <div className={`admin-ai-panel${pip ? ' admin-ai-panel--pip' : ''}`}>
        <div className="admin-ai-glow" aria-hidden />
        <header className="admin-ai-header">
          <div className="admin-ai-brand">
            <span className="admin-ai-orb">
              <Sparkles className="w-4 h-4" strokeWidth={2} />
            </span>
            <div>
              <p className="admin-ai-title">Asistan</p>
              <p className="admin-ai-sub">
                {pip ? 'Pencere modu · sayfada kalır' : 'Tek kullanımlık sohbet · geçmiş tutulmaz'}
              </p>
            </div>
          </div>
          <div className="admin-ai-header-actions">
            <button
              type="button"
              className={`admin-ai-icon-btn${pip ? ' admin-ai-icon-btn--on' : ''}`}
              onClick={() => setPip((v) => !v)}
              title={pip ? 'Tam boyuta büyüt' : 'Pencere modu'}
              aria-label={pip ? 'Tam boyuta büyüt' : 'Pencere moduna geç'}
              aria-pressed={pip}
            >
              {pip ? (
                <Maximize2 className="w-[18px] h-[18px]" strokeWidth={1.75} />
              ) : (
                <PictureInPicture2 className="w-[18px] h-[18px]" strokeWidth={1.75} />
              )}
            </button>
            <button
              type="button"
              className="admin-ai-icon-btn"
              onClick={onClose}
              aria-label="Kapat"
              title="Kapat"
            >
              <X className="w-5 h-5" strokeWidth={1.75} />
            </button>
          </div>
        </header>

        <div className="admin-ai-body" ref={listRef}>
          {messages.length === 0 ? (
            <div className="admin-ai-empty">
              <div className="admin-ai-empty-orb">
                <Sparkles className="w-7 h-7" strokeWidth={1.5} />
              </div>
              <h2 className="admin-ai-empty-title">Nasıl yardımcı olayım?</h2>
              <p className="admin-ai-empty-text">
                Sayfalara gidebilir, ürün / grup / kullanıcı ekleyebilir veya kısa rapor verebilirim.
              </p>
              <div className="admin-ai-chips">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="admin-ai-chip"
                    disabled={busy}
                    onClick={() => void send(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="admin-ai-thread">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`admin-ai-msg admin-ai-msg--${msg.role}`}
                >
                  {msg.role === 'assistant' && (
                    <span className="admin-ai-msg-avatar" aria-hidden>
                      <Sparkles className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <div className="admin-ai-msg-bubble">
                    <p className="admin-ai-msg-text">{msg.text}</p>
                    {msg.actions?.some((a) => a.type === 'navigate') && (
                      <div className="admin-ai-msg-actions">
                        {msg.actions
                          .filter((a): a is Extract<AiAction, { type: 'navigate' }> => a.type === 'navigate')
                          .map((a) => (
                            <button
                              key={`${a.path}-${a.label}`}
                              type="button"
                              className="admin-ai-goto"
                              onClick={() => runNavigate(a.path)}
                            >
                              {a.label}
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="admin-ai-msg admin-ai-msg--assistant">
                  <span className="admin-ai-msg-avatar" aria-hidden>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  </span>
                  <div className="admin-ai-msg-bubble admin-ai-msg-bubble--typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="admin-ai-footer">
          <form className="admin-ai-composer" onSubmit={onSubmit}>
            <div className="admin-ai-composer-inner">
              <textarea
                ref={inputRef}
                className="admin-ai-input"
                rows={1}
                placeholder="Bir şey sor veya yaz…"
                value={input}
                disabled={busy}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
              />
              <div className="admin-ai-composer-actions">
                <button
                  type="button"
                  className="admin-ai-help"
                  disabled={busy}
                  title="Komutları göster"
                  aria-label="Komutları göster"
                  onClick={() => void send('yardım')}
                >
                  <CircleHelp className="w-4 h-4" strokeWidth={2} />
                </button>
                <button
                  type="submit"
                  className="admin-ai-send"
                  disabled={busy || !input.trim()}
                  aria-label="Gönder"
                >
                  <Send className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
            </div>
          </form>
          <p className="admin-ai-footer-hint">
            {pip ? 'Enter ile gönder · Esc ile kapat' : 'Enter ile gönder · Esc ile kapat · pencere ikonuyla küçült'}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AdminAIButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="sidebar-footer-btn sidebar-footer-btn--ai"
      title="Yapay zeka"
      aria-label="Yapay zeka"
      data-tour="ai-assistant"
      onClick={onClick}
    >
      <Sparkles className="w-[18px] h-[18px]" strokeWidth={1.75} />
    </button>
  );
}
