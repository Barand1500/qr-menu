import { useEffect, useState } from 'react';
import LoginWelcome from '@/components/auth/LoginWelcome';
import { X, Building2 } from 'lucide-react';

function ContactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
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
  const [contactOpen, setContactOpen] = useState(false);
  return <>
    <LoginWelcome onContact={() => setContactOpen(true)} />
    <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
  </>;
}
