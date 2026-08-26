import type { CSSProperties } from 'react';
import { SocialDisplayIcon } from '@/components/SocialDisplayIcon';
import { isCustomSocialId, socialPlatformById, type PublicSocialLink } from '@/lib/socialCatalog';

interface PublicSocialLinksProps {
  links: PublicSocialLink[];
  className?: string;
  size?: 'sm' | 'md';
}

export default function PublicSocialLinks({
  links,
  className = '',
  size = 'md',
}: PublicSocialLinksProps) {
  if (!links.length) return null;

  const btn =
    size === 'sm'
      ? 'public-social__btn public-social__btn--sm'
      : 'public-social__btn';

  return (
    <div className={`public-social ${className}`} role="list">
      {links.map((link) => {
        const platformColor = socialPlatformById(link.id)?.color || link.color || '#475569';
        const bg =
          link.id === 'instagram'
            ? 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)'
            : isCustomSocialId(link.id)
              ? link.color || '#475569'
              : platformColor;
        return (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={btn}
            style={
              {
                '--social-color': bg,
                background: bg,
              } as CSSProperties
            }
            aria-label={link.label}
            title={link.label}
            role="listitem"
          >
            <SocialDisplayIcon
              id={link.id}
              iconKey={link.iconKey}
              iconUrl={link.iconUrl}
              className={size === 'sm' ? 'w-3.5 h-3.5 text-white' : 'w-4 h-4 text-white'}
            />
          </a>
        );
      })}
    </div>
  );
}
