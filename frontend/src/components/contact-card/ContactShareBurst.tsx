import type { ReactNode } from 'react';
import { MessageSquareText, Share2 } from 'lucide-react';
import SocialBrandIcon from '@/components/SocialBrandIcon';
import type { ContactCardCopy } from '@/lib/contactCardCopy';

type Target = {
  id: string;
  label: string;
  color: string;
  icon: ReactNode;
  href?: string;
  external?: boolean;
  onClick?: () => void;
};

/**
 * Paylaş'a basınca düğmeden fırlayan yuvarlak uygulama balonları.
 * Bağlantı o anda panoya kopyalanmıştır; balonlar yalnızca gönderme yolunu açar.
 */
export default function ContactShareBurst({
  url,
  text,
  copy: t,
  closing,
  onNative,
  onPick,
}: {
  url: string;
  text: string;
  copy: ContactCardCopy;
  closing: boolean;
  /** Tarayıcının kendi paylaşım penceresi (varsa resimle birlikte) */
  onNative?: () => void;
  onPick: () => void;
}) {
  const message = `${text} ${url}`;
  const targets: Target[] = [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      color: 'linear-gradient(145deg,#4ade80,#16a34a)',
      icon: <SocialBrandIcon id="whatsapp" className="w-6 h-6" />,
      href: `https://wa.me/?text=${encodeURIComponent(message)}`,
      external: true,
    },
    {
      id: 'instagram',
      label: t.instagram,
      color: 'linear-gradient(45deg,#f59e0b,#ef4444 45%,#c026d3 75%,#6366f1)',
      icon: <SocialBrandIcon id="instagram" className="w-6 h-6" />,
      // Instagram'ın web paylaşım bağlantısı yok: bağlantı kopyalı, mesajlar açılır, yapıştırılır
      href: 'https://www.instagram.com/direct/inbox/',
      external: true,
    },
    {
      id: 'telegram',
      label: t.telegram,
      color: 'linear-gradient(145deg,#38bdf8,#0284c7)',
      icon: <SocialBrandIcon id="telegram" className="w-6 h-6" />,
      href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      external: true,
    },
    {
      id: 'sms',
      label: t.sms,
      color: 'linear-gradient(145deg,#a3e635,#65a30d)',
      icon: <MessageSquareText size={24} aria-hidden="true" />,
      // "?&" hem Android hem iPhone mesaj uygulamasında gövdeyi doldurur
      href: `sms:?&body=${encodeURIComponent(message)}`,
    },
  ];
  if (onNative) {
    targets.push({
      id: 'more',
      label: t.more,
      color: 'linear-gradient(145deg,#a8a29e,#57534e)',
      icon: <Share2 size={22} aria-hidden="true" />,
      onClick: onNative,
    });
  }
  const n = targets.length;
  // Balonlar, sağdaki Paylaş düğmesinin (kartın %75'i) altından yelpaze gibi açılır
  const arc = (i: number) => Math.round(Math.abs(i - (n - 1) / 2) * 7);

  return (
    <div className={`cc-burst${closing ? ' is-closing' : ''}`} role="group" aria-label={t.share}>
      <p className="cc-burst__hint">{t.shareHint}</p>
      <div className="cc-burst__row" style={{ ['--n' as string]: n }}>
        {targets.map((target, i) => {
          const style = {
            '--i': i,
            '--c': target.color,
            '--fx': `${(75 - ((i + 0.5) * 100) / n).toFixed(2)}cqw`,
            '--arc': `${arc(i)}px`,
          } as React.CSSProperties;
          const body = (
            <>
              <span className="cc-burst__bubble">
                <span className="cc-burst__icon">{target.icon}</span>
              </span>
              <span className="cc-burst__label">{target.label}</span>
            </>
          );
          return target.href ? (
            <a
              key={target.id}
              className="cc-burst__item"
              style={style}
              href={target.href}
              target={target.external ? '_blank' : undefined}
              rel={target.external ? 'noopener noreferrer' : undefined}
              onClick={onPick}
            >
              {body}
            </a>
          ) : (
            <button
              key={target.id}
              type="button"
              className="cc-burst__item"
              style={style}
              onClick={() => {
                target.onClick?.();
                onPick();
              }}
            >
              {body}
            </button>
          );
        })}
      </div>
    </div>
  );
}
