import { ShoppingBag } from 'lucide-react';
import { useSiparisCart } from '@/hooks/useSiparisCart';

/** PC header sepet — mobilde CSS ile gizlenir (Tailwind hidden, icon-btn display:flex yüzünden eziliyordu) */
export default function SiparisCartButton({
  className = '',
  alwaysShow = false,
}: {
  className?: string;
  alwaysShow?: boolean;
}) {
  const { enabled, count, setSheetOpen } = useSiparisCart();
  if (!enabled) return null;

  return (
    <button
      type="button"
      onClick={() => setSheetOpen(true)}
      data-siparis-cart-target
      className={`public-menu-header__icon-btn siparis-header-cart${alwaysShow ? ' siparis-header-cart--always' : ''} ${className}`.trim()}
      aria-label="Sepet"
    >
      <ShoppingBag className="w-5 h-5" />
      {count > 0 ? (
        <span className="siparis-header-cart__badge">{count > 99 ? '99+' : count}</span>
      ) : null}
    </button>
  );
}
