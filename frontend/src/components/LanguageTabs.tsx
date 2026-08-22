interface Language {
  id: number;
  code: string;
  name: string;
}

interface LanguageTabsProps {
  languages: Language[];
  activeCode: string;
  onChange: (code: string) => void;
  variant?: 'pill' | 'underline';
}

export default function LanguageTabs({
  languages,
  activeCode,
  onChange,
  variant = 'pill',
}: LanguageTabsProps) {
  if (languages.length <= 1) return null;

  if (variant === 'underline') {
    return (
      <div
        className="flex gap-6 border-b"
        style={{ borderColor: 'var(--admin-card-border)' }}
      >
        {languages.map((lang) => {
          const active = lang.code === activeCode;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => onChange(lang.code)}
              className="pb-3 text-sm font-semibold transition-all relative -mb-px"
              style={{
                color: active ? 'var(--admin-text)' : 'var(--admin-accent)',
              }}
            >
              {lang.name}
              {active && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ background: 'var(--admin-accent)' }}
                />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--admin-input-bg)' }}>
      {languages.map((lang) => {
        const active = lang.code === activeCode;
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => onChange(lang.code)}
            className="flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: active ? 'var(--admin-accent)' : 'transparent',
              color: active ? 'var(--admin-btn-primary-text)' : 'var(--admin-text-muted)',
            }}
          >
            {lang.name}
          </button>
        );
      })}
    </div>
  );
}

export type { Language };
