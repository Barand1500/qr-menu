import { Gamepad2, Menu, ShoppingBag } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSiparisCart } from '@/hooks/useSiparisCart';
export default function SofraBottomBar({
  lang,
  onMenu,
  onGames,
  service,
}: {
  lang: string;
  onMenu: () => void;
  onGames?: () => void;
  service?: ReactNode;
}) {
  const { count, setSheetOpen } = useSiparisCart();
  const en = lang.split('-')[0] === 'en';
  return (
    <nav className="sofra-bottom" aria-label={en ? 'Menu tools' : 'Menü araçları'}>
      <button type="button" onClick={onMenu}>
        <Menu size={18} />
        {en ? 'More' : 'Diğer'}
      </button>
      {onGames && (
        <button type="button" onClick={onGames}>
          <Gamepad2 size={18} />
          {en ? 'Games' : 'Oyunlar'}
        </button>
      )}
      {service}
      <button type="button" onClick={() => setSheetOpen(true)} data-siparis-cart-target>
        <ShoppingBag size={18} />
        {en ? 'Cart' : 'Sepet'}
        {count > 0 && <strong>({count})</strong>}
      </button>
    </nav>
  );
}
