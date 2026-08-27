import { UtensilsCrossed, LayoutGrid } from 'lucide-react';

type PlaceholderKind = 'product' | 'group';
type PlaceholderSize = 'sm' | 'md' | 'lg' | 'hero' | 'fill';

const VARIANTS = ['sky', 'ocean', 'amber', 'violet', 'mint'] as const;
type Variant = (typeof VARIANTS)[number];

interface MenuMediaPlaceholderProps {
  kind?: PlaceholderKind;
  size?: PlaceholderSize;
  label?: string;
  className?: string;
  /** true: isim baş harflerini gösterir */
  showInitials?: boolean;
}

function variantFromLabel(label?: string): Variant {
  if (!label) return 'sky';
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash + label.charCodeAt(i) * (i + 3)) % 997;
  }
  return VARIANTS[hash % VARIANTS.length];
}

function initialsFromLabel(label?: string) {
  if (!label?.trim()) return '';
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function MenuMediaPlaceholder({
  kind = 'product',
  size = 'md',
  label,
  className = '',
  showInitials = true,
}: MenuMediaPlaceholderProps) {
  const variant = variantFromLabel(label);
  const initials = showInitials ? initialsFromLabel(label) : '';
  const Icon = kind === 'group' ? LayoutGrid : UtensilsCrossed;

  return (
    <div
      className={`menu-media-ph menu-media-ph--${size} menu-media-ph--${variant} ${className}`.trim()}
      aria-hidden
    >
      <span className="menu-media-ph__blob menu-media-ph__blob--1" />
      <span className="menu-media-ph__blob menu-media-ph__blob--2" />
      <span className="menu-media-ph__pattern" />
      <div className="menu-media-ph__content">
        <span className="menu-media-ph__icon-wrap">
          <Icon className="menu-media-ph__icon" />
        </span>
        {initials ? <span className="menu-media-ph__initials">{initials}</span> : null}
      </div>
    </div>
  );
}
