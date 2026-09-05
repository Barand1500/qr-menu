import PublicMobileNav, { type PublicTab } from '@/components/public/PublicMobileNav';
import { useSiparisCart } from '@/hooks/useSiparisCart';

/** Sipariş teması: alt nav orta FAB = sepet */
export default function SiparisMobileNav({
  tab,
  onTab,
  onSearchOpen,
  onMenuOpen,
}: {
  tab: PublicTab;
  onTab: (tab: PublicTab) => void;
  onSearchOpen: () => void;
  onMenuOpen: () => void;
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
    />
  );
}
