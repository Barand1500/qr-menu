import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { QrCode, X, Building2 } from 'lucide-react';
import { Input } from '@/components/ui';

function ContactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="login-glass w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <p className="text-white/50 text-xs mb-1">Anasayfa » İletişim » İletişim Formu</p>
            <h2 className="text-2xl font-bold text-white">İletişim Formu</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-white/70 hover:text-white transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-white/60 text-sm mb-6">
          Giriş yaparken sorun yaşıyorsanız aşağıdaki iletişim kanallarından bize ulaşabilirsiniz.
        </p>

        <div className="space-y-5">
          <ContactBlock
            title="Genel Bilgiler"
            icon={Building2}
            rows={[
              { label: 'Ünvan', value: 'GÜZEL İÇ VE DIŞ TİC. LTD. ŞTİ.' },
              { label: 'Vergi Bilgileri', value: 'Antalya Kurumlar / 9250508945' },
              { label: 'Telefon', value: '+90 850 885 12 60', href: 'tel:+908508851260' },
              { label: 'GSM', value: '+90 540 885 12 60', href: 'tel:+905408851260' },
              {
                label: 'E-Posta',
                value: 'bilgi@vetahsilat.com\ndestek@vetahsilat.com',
                href: 'mailto:bilgi@vetahsilat.com',
              },
              {
                label: 'Adres',
                value: '2000 Evler Mah. Üniversite Alanı No:13/131 Merkez / Nevşehir',
              },
            ]}
          />

          <ContactBlock
            title="Antalya Mağaza / Showroom"
            rows={[
              { label: 'Yetkili Kişi', value: 'SERCAN GÜZEL' },
              { label: 'GSM', value: '+90 542 104 60 60', href: 'tel:+905421046060' },
              { label: 'Telefon', value: '+90 850 885 11 60', href: 'tel:+908508851160' },
              { label: 'Whatsapp', value: '+90 543 885 11 60', href: 'https://wa.me/905438851160' },
              {
                label: 'E-Posta',
                value: 'sercan@guzelteknoloji.com\nbilgi@guzelteknoloji.com',
                href: 'mailto:sercan@guzelteknoloji.com',
              },
              {
                label: 'Adres',
                value: 'Yeni Emek Mah. Yıldırım Beyazıt Cad. 130A Kepez / Antalya',
              },
            ]}
          />

          <ContactBlock
            title="Antalya Yazılım Geliştirme Ofisi"
            rows={[
              { label: 'Yetkili Kişi', value: 'SEMİHCAN GÜZEL' },
              { label: 'GSM', value: '+90 542 105 60 60', href: 'tel:+905421056060' },
              { label: 'Telefon', value: '+90 850 885 11 60', href: 'tel:+908508851160' },
              { label: 'Whatsapp', value: '+90 543 885 11 60', href: 'https://wa.me/905438851160' },
              {
                label: 'E-Posta',
                value: 'semihcan@guzelteknoloji.com\nbilgi@guzelteknoloji.com',
                href: 'mailto:semihcan@guzelteknoloji.com',
              },
              {
                label: 'Adres',
                value: 'Yeni Emek Mah. Yıldırım Beyazıt Cad. 130A Kepez / Antalya',
              },
            ]}
          />

          <ContactBlock
            title="Nevşehir Teknopark AR-GE Ofisi"
            rows={[
              { label: 'Yetkili Kişi', value: 'ERCAN GÜZEL' },
              { label: 'GSM', value: '+90 532 567 46 60', href: 'tel:+905325674660' },
              { label: 'Telefon', value: '+90 850 885 12 60', href: 'tel:+908508851260' },
              { label: 'Whatsapp', value: '+90 540 885 12 60', href: 'https://wa.me/905408851260' },
              {
                label: 'E-Posta',
                value: 'ercan@guzelteknoloji.com\narge@guzelteknoloji.com',
                href: 'mailto:ercan@guzelteknoloji.com',
              },
              {
                label: 'Adres',
                value: '2000 Evler Mah. Üniversite Alanı No:13/131 Merkez / Nevşehir',
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function ContactBlock({
  title,
  icon: Icon,
  rows,
}: {
  title: string;
  icon?: typeof Building2;
  rows: { label: string; value: string; href?: string }[];
}) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 sm:p-5">
      <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-blue-300" />}
        {title}
      </h3>
      <dl className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[110px_1fr] sm:grid-cols-[130px_1fr] gap-2 text-sm">
            <dt className="text-white/50 font-medium">{row.label}</dt>
            <dd className="text-white/90 whitespace-pre-line">
              {row.href ? (
                <a
                  href={row.href}
                  className="hover:text-blue-300 transition underline-offset-2 hover:underline"
                  target={row.href.startsWith('http') ? '_blank' : undefined}
                  rel={row.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                >
                  {row.value}
                </a>
              ) : (
                row.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  if (user) return <Navigate to="/admin" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password, remember);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-scene flex flex-col min-h-screen">
      <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full login-glass flex items-center justify-center">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-wide">Menu QR</span>
        </div>
        <button
          type="button"
          onClick={() => setContactOpen(true)}
          className="text-sm text-white/80 hover:text-white transition px-4 py-2 rounded-full login-glass hover:bg-white/10"
        >
          İletişim
        </button>
      </header>

      <div className="absolute bottom-0 inset-x-0 h-48 pointer-events-none opacity-30">
        <svg viewBox="0 0 1440 200" className="w-full h-full" preserveAspectRatio="none">
          <path
            d="M0,200 L0,120 Q200,60 400,100 T800,80 T1200,110 T1440,90 L1440,200 Z"
            fill="rgba(0,0,0,0.3)"
          />
          <path
            d="M0,200 L0,140 Q300,80 600,130 T1000,100 T1440,130 L1440,200 Z"
            fill="rgba(0,0,0,0.2)"
          />
        </svg>
      </div>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="login-glass w-full max-w-md rounded-3xl p-8 sm:p-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-white text-center mb-2">
            Giriş Yap
          </h1>
          <p className="text-center text-white/60 text-sm mb-8">
            Dijital menü panelinize hoş geldiniz
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-xl bg-red-500/20 border border-red-400/30 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            )}

            <Input
              variant="glass"
              type="email"
              label="E-posta"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <Input
              variant="glass"
              type="password"
              label="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded border-white/30 bg-white/10 text-blue-500 focus:ring-blue-400/50"
              />
              Beni hatırla
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white font-semibold text-base transition disabled:opacity-60 shadow-lg shadow-blue-500/30"
            >
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>

          <p className="text-center text-white/40 text-xs mt-6">
            Giriş yapamıyor musunuz?{' '}
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className="text-blue-300 hover:text-blue-200 underline underline-offset-2"
            >
              İletişime geçin
            </button>
          </p>

          <p className="text-center text-white/40 text-xs mt-4">
            Güzel Teknoloji © 2026
          </p>
        </div>
      </main>

      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </div>
  );
}
