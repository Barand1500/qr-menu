import { useRef } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import LanguageFlag from '@/components/LanguageFlag';

export default function AtelierLanguage({
  lang,
  languages,
  onChange,
}: {
  lang: string;
  languages: { code: string; name: string }[];
  onChange?: (code: string) => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <div className="atelier-language">
      <label className="atelier-language__native">
        <LanguageFlag code={lang} />
        <select
          aria-label="Dil / Language"
          value={lang}
          onChange={(e) => onChange?.(e.target.value)}
        >
          {languages.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <details
        ref={ref}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            ref.current?.removeAttribute('open');
            ref.current?.querySelector('summary')?.focus();
          }
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) ref.current?.removeAttribute('open');
        }}
      >
        <summary aria-label="Dil / Language">
          <LanguageFlag code={lang} />
          <span>{languages.find((l) => l.code === lang)?.name || lang}</span>
          <ChevronDown size={14} />
        </summary>
        <div className="atelier-language__options">
          {languages.map((l) => (
            <button
              type="button"
              key={l.code}
              aria-pressed={lang === l.code}
              onClick={() => {
                onChange?.(l.code);
                ref.current?.removeAttribute('open');
              }}
            >
              <LanguageFlag code={l.code} />
              <span>{l.name}</span>
              {lang === l.code && <Check size={15} />}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
