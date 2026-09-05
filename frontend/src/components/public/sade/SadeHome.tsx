import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import MobileStoriesStrip, { type MenuStory } from '@/components/public/MobileStoriesStrip';
import PublicSocialLinks from '@/components/public/PublicSocialLinks';
import type { PublicSocialLink } from '@/lib/socialCatalog';
import { imageUrl } from '@/lib/api';
import { menuGroupPath } from '@/lib/menuPaths';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsapSetup';
import { useRef } from 'react';

type MenuData = {
  restaurant: { name: string; logoUrl?: string | null };
  groups: { id: number; name: string; imageUrl?: string | null; productCount?: number }[];
  socialLinks?: PublicSocialLink[];
  campaign?: { name: string } | null;
};

export default function SadeHome({
  menu,
  displayStories,
  allergyBanner,
}: {
  menu: MenuData;
  displayStories?: MenuStory[] | null;
  allergyBanner?: ReactNode;
  /** unused — kept for call-site compat */
  displayShowcase?: unknown;
  popularProducts?: unknown;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hasStories = Boolean(displayStories && displayStories.length > 0);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      // Kategorileri tek blok animate et — satır içi y stagger butonları
      // farklı yükseklikte bırakıp simetriyi bozuyordu.
      gsap.from('.sade-home__brand, .sade-home__cats, .sade-home__social', {
        opacity: 0,
        y: 16,
        duration: 0.55,
        stagger: 0.08,
        ease: 'power2.out',
        clearProps: 'transform',
      });
    },
    { scope: rootRef, dependencies: [menu.groups.length] }
  );

  return (
    <div className="sade-home" ref={rootRef}>
      {allergyBanner}

      <header className="sade-home__brand">
        {menu.restaurant.logoUrl ? (
          <img
            src={imageUrl(menu.restaurant.logoUrl)}
            alt=""
            className="sade-home__logo"
          />
        ) : (
          <div className="sade-home__logo-fallback" aria-hidden>
            {menu.restaurant.name.charAt(0)}
          </div>
        )}
        <p className="sade-home__brand-name">{menu.restaurant.name}</p>
        {menu.campaign?.name ? (
          <p className="sade-home__campaign">{menu.campaign.name}</p>
        ) : null}
      </header>

      {hasStories && (
        <div className="sade-home__stories">
          <MobileStoriesStrip stories={displayStories!} />
        </div>
      )}

      <nav className="sade-home__cats" aria-label="Kategoriler">
        {menu.groups.map((group) => (
          <Link
            key={group.id}
            to={menuGroupPath(group.id)}
            className="sade-home__cat"
          >
            {group.name}
          </Link>
        ))}
      </nav>

      {menu.socialLinks && menu.socialLinks.length > 0 && (
        <footer className="sade-home__social">
          <p className="sade-home__follow">Takip et</p>
          <PublicSocialLinks links={menu.socialLinks} />
        </footer>
      )}
    </div>
  );
}
