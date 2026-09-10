import PublicMobileNav, { type PublicTab } from '@/components/public/PublicMobileNav';
import { useSiparisCart } from '@/hooks/useSiparisCart';
import type { MenuColorMode } from '@/lib/menuColorMode';

/** Sipariş teması: alt nav orta FAB = sepet */
export default function SiparisMobileNav({
  tab,
  onTab,
  onSearchOpen,
  onMenuOpen,
  colorMode,
  onColorModeToggle,
  showProfile,
  profileActive,
  onProfileOpen,
}: {
  tab: PublicTab;
  onTab: (tab: PublicTab) => void;
  onSearchOpen: () => void;
  onMenuOpen: () => void;
  colorMode?: MenuColorMode;
  onColorModeToggle?: () => void;
  showProfile?: boolean;
  profileActive?: boolean;
  onProfileOpen?: () => void;
}) {
  const { count, setSheetOpen } = useSiparisCart();
  return (
    <PublicMobileNav
      tab={tab}
      onTab={onTab}
      onSearchOpen={onSearchOpen}
      onMenuOpen={onMenuOpen}
      cartMode
      cartCount={count}
      onCartOpen={() => setSheetOpen(true)}
      colorMode={colorMode}
      onColorModeToggle={onColorModeToggle}
      showProfile={showProfile}
      profileActive={profileActive}
      onProfileOpen={onProfileOpen}
    />
  );
}
