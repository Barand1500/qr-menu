import { Home, Menu, Moon, Search, ShoppingBag, Sun, UserRound } from 'lucide-react';
import type { MenuColorMode } from '@/lib/menuColorMode';

export type PublicTab = 'home' | 'about' | 'settings';

interface PublicMobileNavProps {
  tab: PublicTab;
  onTab: (tab: PublicTab) => void;
  onSearchOpen: () => void;
  onMenuOpen: () => void;
  /** Sipariş teması: orta FAB sepet olur */
  cartMode?: boolean;
  cartCount?: number;
  onCartOpen?: () => void;
  /** Sol: ana sayfa yanında gece/gündüz */
  colorMode?: MenuColorMode;
  onColorModeToggle?: () => void;
  /** Sağ: menü yanında profil */
  showProfile?: boolean;
  profileActive?: boolean;
  onProfileOpen?: () => void;
}

export default function PublicMobileNav({
  tab,
  onTab,
  onSearchOpen,
  onMenuOpen,
  cartMode = false,
  cartCount = 0,
  onCartOpen,
  colorMode,
  onColorModeToggle,
  showProfile = false,
  profileActive = false,
  onProfileOpen,
}: PublicMobileNavProps) {
  const showColor = Boolean(colorMode && onColorModeToggle);
  const isNight = colorMode === 'night';

  return (
    <nav className="public-mobile-nav md:hidden" aria-label="Ana menü">
      <div className="public-mobile-nav__inner">
        <svg
          className="public-mobile-nav__shape"
          viewBox="0 0 400 72"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0 16 C0 7.163 7.163 0 16 0 H154 C170 0 178 20 200 20 C222 20 230 0 246 0 H384 C392.837 0 400 7.163 400 16 V72 H0 Z"
            fill="currentColor"
          />
        </svg>

        <div className="public-mobile-nav__actions">
          <div className="public-mobile-nav__side public-mobile-nav__side--left">
            <button
              type="button"
              onClick={() => onTab('home')}
              className={`public-mobile-nav__side-btn ${tab === 'home' ? 'is-active' : ''}`}
              aria-label="Anasayfa"
            >
              <Home className="w-5 h-5" strokeWidth={1.85} />
            </button>
            {showColor ? (
              <button
                type="button"
                onClick={onColorModeToggle}
                className="public-mobile-nav__side-btn"
                aria-label={isNight ? 'Gündüz moduna geç' : 'Gece moduna geç'}
                title={isNight ? 'Gündüz moduna geç' : 'Gece moduna geç'}
              >
                {isNight ? (
                  <Sun className="w-[1.15rem] h-[1.15rem]" strokeWidth={1.85} />
                ) : (
                  <Moon className="w-[1.15rem] h-[1.15rem]" strokeWidth={1.85} />
                )}
              </button>
            ) : null}
          </div>

          <div className="public-mobile-nav__side public-mobile-nav__side--right">
            {showProfile && onProfileOpen ? (
              <button
                type="button"
                onClick={onProfileOpen}
                className={`public-mobile-nav__side-btn${profileActive ? ' is-active' : ''}`}
                aria-label={profileActive ? 'Profil' : 'Giriş / Kayıt'}
                title={profileActive ? 'Profil' : 'Giriş / Kayıt'}
              >
                <UserRound className="w-[1.15rem] h-[1.15rem]" strokeWidth={1.85} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onMenuOpen}
              className="public-mobile-nav__side-btn"
              aria-label="Menü"
            >
              <Menu className="w-5 h-5" strokeWidth={1.85} />
            </button>
          </div>
        </div>

        {cartMode ? (
          <button
            type="button"
            onClick={onCartOpen}
            data-siparis-cart-target
            className="public-mobile-nav__fab siparis-nav-cart"
            aria-label="Sepet"
          >
            <ShoppingBag className="w-5 h-5" strokeWidth={2.15} />
            {cartCount > 0 ? (
              <span className="siparis-nav-cart__badge">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            ) : null}
          </button>
        ) : (
          <button
            type="button"
            onClick={onSearchOpen}
            className="public-mobile-nav__fab"
            aria-label="Ara"
          >
            <Search className="w-5 h-5" strokeWidth={2.15} />
          </button>
        )}
      </div>
    </nav>
  );
}
