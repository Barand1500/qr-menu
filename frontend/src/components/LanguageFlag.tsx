import { useState } from 'react';
import { Globe } from 'lucide-react';
import { languageFlagUrl } from '@/lib/languageFlags';

type Props = {
  code: string;
  className?: string;
  /** Görsel genişliği (px) */
  size?: number;
  title?: string;
};

/**
 * Yerel SVG: emoji desteğine veya üçüncü taraf sunucuya ihtiyaç duymaz.
 */
export default function LanguageFlag({ code, className, size = 22, title }: Props) {
  const [failed, setFailed] = useState('');
  const src = languageFlagUrl(code, size <= 22 ? 40 : 80);
  const cls = ['lang-flag', className].filter(Boolean).join(' ');

  if (!src || failed === src) {
    return (
      <span className={`${cls} lang-flag--globe`} title={title} aria-hidden>
        <Globe size={size} />
      </span>
    );
  }

  return (
    <img
      className={cls}
      src={src}
      onError={() => setFailed(src)}
      alt=""
      title={title}
      width={size}
      height={Math.round(size * 0.75)}
      decoding="async"
      draggable={false}
      aria-hidden
    />
  );
}
