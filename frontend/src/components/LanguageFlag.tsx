import { languageCountryCode, languageFlagUrl } from '@/lib/languageFlags';

type Props = {
  code: string;
  className?: string;
  /** Görsel genişliği (px) */
  size?: number;
  title?: string;
};

/**
 * Bayrak görseli — emoji yerine PNG (Chrome/Windows’ta TR harfi sorunu olmaz).
 */
export default function LanguageFlag({ code, className, size = 22, title }: Props) {
  const iso = languageCountryCode(code);
  const src = languageFlagUrl(code, size <= 22 ? 40 : 80);
  const cls = ['lang-flag', className].filter(Boolean).join(' ');

  if (!iso || !src) {
    return (
      <span className={`${cls} lang-flag--globe`} title={title} aria-hidden>
        🌐
      </span>
    );
  }

  return (
    <img
      className={cls}
      src={src}
      srcSet={`https://flagcdn.com/w80/${iso}.png 2x`}
      alt=""
      title={title}
      width={size}
      height={Math.round(size * 0.75)}
      loading="lazy"
      decoding="async"
      draggable={false}
      aria-hidden
    />
  );
}
