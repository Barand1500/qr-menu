import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Headphones,
  Mail,
  MessageCircle,
  Phone,
  X,
} from 'lucide-react';
import { Button, Textarea } from '@/components/ui';
import {
  SUPPORT_PHONE_DISPLAY,
  supportWhatsAppUrl,
} from '@/lib/supportContact';

const CHANNELS = [
  'Satın alma',
  'Kod girişi',
  'QR paketi',
  'Dil paketi',
  'Tema / Başlangıç',
  'Diğer',
] as const;

const EMAILS = ['arge@guzelteknoloji.com', 'destek@guzelteknoloji.com'] as const;

interface SupportContactModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SupportContactModal({ open, onClose }: SupportContactModalProps) {
  const [step, setStep] = useState<'form' | 'contact'>('form');
  const [channel, setChannel] = useState<(typeof CHANNELS)[number] | ''>('');
  const [detail, setDetail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setStep('form');
    setChannel('');
    setDetail('');
    setError(null);
    setAnimKey(0);
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function goContact() {
    if (!channel) {
      setError('Lütfen sorun yaşadığınız kanalı seçin');
      return;
    }
    if (!detail.trim()) {
      setError('Kısaca sıkıntınızı yazın');
      return;
    }
    setError(null);
    setStep('contact');
    setAnimKey((k) => k + 1);
  }

  function buildWhatsAppText() {
    return [
      'Merhaba, Menu QR eklenti / satın alma desteği.',
      `Kanal: ${channel}`,
      `Sorun: ${detail.trim()}`,
    ].join('\n');
  }

  function openWhatsApp() {
    window.open(supportWhatsAppUrl(buildWhatsAppText()), '_blank', 'noopener,noreferrer');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[6px]" />
      <div
        className="relative w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] shadow-2xl overflow-hidden support-modal-panel"
        style={{
          background: 'var(--admin-card)',
          border: '1px solid var(--admin-card-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="support-modal-hero px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="support-modal-hero__icon shrink-0">
                <Headphones className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">
                  Güzel Teknoloji
                </p>
                <h2 className="text-lg font-bold text-white mt-0.5">Destek talebi</h2>
                <p className="text-sm text-white/75 mt-1 leading-snug">
                  {step === 'form'
                    ? 'Önce kısa formu doldurun, sonra size ulaşabileceğimiz kanalları göstereceğiz.'
                    : 'Form hazır. Aşağıdan WhatsApp veya e-posta ile bize ulaşın.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition shrink-0"
              aria-label="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="support-modal-steps mt-4">
            <span className={step === 'form' ? 'is-active' : 'is-done'}>1 · Form</span>
            <span className="support-modal-steps__line" aria-hidden />
            <span className={step === 'contact' ? 'is-active' : ''}>2 · İletişim</span>
          </div>
        </div>

        <div className="p-5" key={`${step}-${animKey}`}>
          <div className="support-modal-step-body">
            {step === 'form' ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide admin-text-muted mb-2">
                    Hangi kanalda sorun yaşadınız?
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {CHANNELS.map((item) => {
                      const active = channel === item;
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            setChannel(item);
                            setError(null);
                          }}
                          className={`h-9 px-3 rounded-xl text-xs font-semibold border transition ${
                            active
                              ? 'border-[var(--admin-accent)] bg-[var(--admin-accent)] text-white'
                              : 'border-[var(--admin-card-border)] bg-[var(--admin-input-bg)] text-[var(--admin-text)] hover:border-[var(--admin-accent)]'
                          }`}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wide admin-text-muted mb-2">
                    Sıkıntınız nedir?
                  </p>
                  <Textarea
                    rows={4}
                    placeholder="Kısaca anlatın; formu gönderince iletişim kanallarını açacağız…"
                    value={detail}
                    onChange={(e) => {
                      setDetail(e.target.value);
                      setError(null);
                    }}
                  />
                </div>

                {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

                <Button type="button" className="w-full" onClick={goContact}>
                  Formu gönder
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  className="rounded-xl px-3.5 py-3 text-sm"
                  style={{
                    background: 'var(--admin-accent-soft)',
                    color: 'var(--admin-text)',
                  }}
                >
                  <p className="font-semibold">Talebiniz hazır</p>
                  <p className="text-xs admin-text-muted mt-1 leading-relaxed">
                    {channel} · {detail.trim().slice(0, 120)}
                    {detail.trim().length > 120 ? '…' : ''}
                  </p>
                </div>

                <button type="button" className="support-contact-row" onClick={openWhatsApp}>
                  <span className="support-contact-row__icon" style={{ background: '#25D366' }}>
                    <Phone className="w-4 h-4 text-white" />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block text-sm font-bold text-[var(--admin-text)]">
                      {SUPPORT_PHONE_DISPLAY}
                    </span>
                    <span className="block text-[11px] admin-text-muted">
                      WhatsApp ile yaz — form mesaja eklenir
                    </span>
                  </span>
                  <MessageCircle className="w-4 h-4 shrink-0" style={{ color: '#25D366' }} />
                </button>

                {EMAILS.map((email) => (
                  <a
                    key={email}
                    href={`mailto:${email}?subject=${encodeURIComponent(
                      'Menu QR Destek Talebi'
                    )}&body=${encodeURIComponent(buildWhatsAppText())}`}
                    className="support-contact-row"
                  >
                    <span
                      className="support-contact-row__icon"
                      style={{ background: 'var(--admin-accent)' }}
                    >
                      <Mail className="w-4 h-4 text-white" />
                    </span>
                    <span className="min-w-0 text-left">
                      <span className="block text-sm font-bold text-[var(--admin-text)] truncate">
                        {email}
                      </span>
                      <span className="block text-[11px] admin-text-muted">
                        E-posta ile gönder — form içeriği eklenir
                      </span>
                    </span>
                    <Mail
                      className="w-4 h-4 shrink-0"
                      style={{ color: 'var(--admin-accent)' }}
                    />
                  </a>
                ))}

                <button
                  type="button"
                  className="w-full text-center text-sm font-semibold py-2 admin-text-muted hover:text-[var(--admin-accent)] transition"
                  onClick={() => {
                    setStep('form');
                    setAnimKey((k) => k + 1);
                  }}
                >
                  Forma geri dön
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
