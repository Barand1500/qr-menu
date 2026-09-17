import PublicMobileNav, { type PublicTab } from '@/components/public/PublicMobileNav';
import TableServiceButtons from '@/components/public/TableServiceButtons';
import { useSiparisCart } from '@/hooks/useSiparisCart';
import type { MenuColorMode } from '@/lib/menuColorMode';

/** Standart: arama ortada; solunda garson, sağında sepet */
export default function StandartMobileNav({
  tab,
  onTab,
  onSearchOpen,
  onMenuOpen,
  lang,
  slug,
  tableServiceEnabled = true,
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
  lang: string;
  slug: string | null;
  tableServiceEnabled?: boolean;
  colorMode?: MenuColorMode;
  onColorModeToggle?: () => void;
  showProfile?: boolean;
  profileActive?: boolean;
  onProfileOpen?: () => void;
}) {
  const { count, setSheetOpen, enabled } = useSiparisCart();

  return (
    <PublicMobileNav
      tab={tab}
      onTab={onTab}
      onSearchOpen={onSearchOpen}
      onMenuOpen={onMenuOpen}
      colorMode={colorMode}
      onColorModeToggle={onColorModeToggle}
      showProfile={showProfile}
      profileActive={profileActive}
      onProfileOpen={onProfileOpen}
      centerExtras={{
        left: (
          <TableServiceButtons lang={lang} slug={slug} enabled={tableServiceEnabled} />
        ),
        cartCount: enabled ? count : 0,
        onCartOpen: enabled ? () => setSheetOpen(true) : undefined,
      }}
    />
  );
}
