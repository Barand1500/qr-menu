import { ArrowLeft, Menu, Search } from 'lucide-react';
import { imageUrl } from '@/lib/api';

interface PublicMenuHeaderProps {
  restaurant: { name: string; logoUrl?: string | null };
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  onMenuOpen: () => void;
  searchOpen?: boolean;
  onSearchToggle?: () => void;
  searchSlot?: React.ReactNode;
}

export default function PublicMenuHeader({
  restaurant,
  title,
  showBack,
  onBack,
  onMenuOpen,
  searchOpen = false,
  onSearchToggle,
  searchSlot,
}: PublicMenuHeaderProps) {
  return (
    <header className="public-menu-header sticky top-0 z-40">
      <div className="public-menu-header__inner">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {showBack ? (
            <button type="button" onClick={onBack} className="public-menu-header__icon-btn" aria-label="Geri">
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <>
              {restaurant.logoUrl ? (
                <img
                  src={imageUrl(restaurant.logoUrl)}
                  alt=""
                  className="w-10 h-10 rounded-xl object-contain bg-white/10 shrink-0"
                />
              ) : (
                <div className="public-menu-header__logo-fallback shrink-0">
                  {restaurant.name.charAt(0)}
                </div>
              )}
            </>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="public-menu-header__title truncate">
              {title || restaurant.name}
            </h1>
            {title && (
              <p className="text-xs text-white/70 truncate">{restaurant.name}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onSearchToggle && (
            <button
              type="button"
              onClick={onSearchToggle}
              className={`public-menu-header__icon-btn hidden md:flex ${searchOpen ? 'is-active' : ''}`}
              aria-label={searchOpen ? 'Aramayı kapat' : 'Ara'}
            >
              <Search className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={onMenuOpen}
            className="public-menu-header__icon-btn hidden md:flex"
            aria-label="Menüyü aç"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {searchOpen && searchSlot && (
        <div className="public-menu-header__search hidden md:block">{searchSlot}</div>
      )}
    </header>
  );
}
