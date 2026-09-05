import { Moon, Sun } from 'lucide-react';
import type { MenuColorMode } from '@/lib/menuColorMode';

interface MenuColorModeToggleProps {
  colorMode: MenuColorMode;
  onToggle: () => void;
  className?: string;
  /** Ürün detay hero üst barı */
  variant?: 'header' | 'hero';
}

export default function MenuColorModeToggle({
  colorMode,
  onToggle,
  className = '',
  variant = 'header',
}: MenuColorModeToggleProps) {
  const isNight = colorMode === 'night';
  const label = isNight ? 'Gündüz moduna geç' : 'Gece moduna geç';

  const baseClass =
    variant === 'hero'
      ? 'public-product-hero__mode-btn'
      : 'public-menu-header__icon-btn';

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`${baseClass} ${className}`.trim()}
      aria-label={label}
      title={label}
    >
      {isNight ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
