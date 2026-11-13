import { useBookNavigation } from '../atelier/BookNavigation';
import { Gamepad2, Menu, ShoppingBag, LayoutGrid } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSiparisCart } from '@/hooks/useSiparisCart';
export default function SofraBottomBar({
  lang,
  onMenu,
  onGames,
  onCategories,
  service,
}: {
  lang: string;
  onMenu: () => void;
  onGames?: () => void;
  onCategories?: () => void;
  service?: ReactNode;
}) {
  const { count, setSheetOpen } = useSiparisCart();
  const navigation = useBookNavigation();
  const en = lang.split('-')[0] === 'en';
  return (
    <>
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
      <nav className="book-dock" aria-label={en ? 'Mobile menu tools' : 'Mobil menü araçları'}>
        <div className="book-dock__service">
          {service}
          <button type="button" onClick={() => setSheetOpen(true)} data-siparis-cart-target>
            <ShoppingBag size={24} />
            <span>
              {en ? 'Cart' : 'Sepet'}
              {count > 0 && <strong> {count}</strong>}
            </span>
          </button>
        </div>
        <button
          type="button"
          className="book-dock__categories"
          aria-expanded={navigation?.open || false}
          aria-label={en ? 'Choose a category' : 'Kategori seç'}
          onClick={() => {
            navigation?.setOpen(true);
            onCategories?.();
          }}
        >
          <span>
            <LayoutGrid size={27} />
          </span>
          <strong>{en ? 'Categories' : 'Kategoriler'}</strong>
        </button>
        <button type="button" className="book-dock__more" onClick={onMenu}>
          <Menu size={27} />
          <span>{en ? 'More' : 'Diğer'}</span>
        </button>
      </nav>
    </>
  );
}
