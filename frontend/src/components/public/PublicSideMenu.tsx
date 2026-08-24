import { X, Home, Info, Globe } from 'lucide-react';

export type PublicTab = 'home' | 'about' | 'settings';

interface Language {
  code: string;
  name: string;
}

interface PublicSideMenuProps {
  open: boolean;
  tab: PublicTab;
  restaurantName: string;
  languages: Language[];
  activeLang: string;
  onClose: () => void;
  onTab: (tab: PublicTab) => void;
  onLangChange: (code: string) => void;
}

export default function PublicSideMenu({
  open,
  tab,
  restaurantName,
  languages,
  activeLang,
  onClose,
  onTab,
  onLangChange,
}: PublicSideMenuProps) {
  function selectTab(next: PublicTab) {
    onTab(next);
    onClose();
  }

  return (
    <>
      <div
        className={`public-side-menu__backdrop ${open ? 'is-open' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={`public-side-menu ${open ? 'is-open' : ''}`}
        aria-hidden={!open}
        aria-label="Menü"
      >
        <div className="public-side-menu__header">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-white/60">Menü</p>
            <p className="font-semibold text-white truncate">{restaurantName}</p>
          </div>
          <button type="button" onClick={onClose} className="public-side-menu__close" aria-label="Kapat">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="public-side-menu__nav">
          <button
            type="button"
            onClick={() => selectTab('home')}
            className={`public-side-menu__link ${tab === 'home' ? 'is-active' : ''}`}
          >
            <Home className="w-5 h-5" />
            Anasayfa
          </button>
          <button
            type="button"
            onClick={() => selectTab('about')}
            className={`public-side-menu__link ${tab === 'about' ? 'is-active' : ''}`}
          >
            <Info className="w-5 h-5" />
            Hakkımızda
          </button>
        </nav>

        <div className="public-side-menu__section">
          <p className="public-side-menu__section-title">
            <Globe className="w-4 h-4" />
            Dil Seçimi
          </p>
          <div className="space-y-1.5">
            {languages.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  onLangChange(l.code);
                  onClose();
                }}
                className={`public-side-menu__lang ${activeLang === l.code ? 'is-active' : ''}`}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
