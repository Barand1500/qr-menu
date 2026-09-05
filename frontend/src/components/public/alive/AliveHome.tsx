import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { formatMoney, imageUrl } from '@/lib/api';
import { menuGroupPath, menuProductPath } from '@/lib/menuPaths';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';
import MobileStoriesStrip, { type MenuStory } from '@/components/public/MobileStoriesStrip';
import PublicSocialLinks from '@/components/public/PublicSocialLinks';
import type { PublicSocialLink } from '@/lib/socialCatalog';
import type { PopularProduct } from '@/components/public/PopularSearchProducts';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsapSetup';
import { useRef } from 'react';

type MenuGroup = {
  id: number;
  name: string;
  imageUrl?: string | null;
  productCount?: number;
  children?: { id: number; name: string; imageUrl?: string | null }[];
};

type MenuData = {
  restaurant: { name: string; logoUrl?: string | null };
  welcomeMessage: string;
  groups: MenuGroup[];
  socialLinks?: PublicSocialLink[];
  campaign?: { name: string } | null;
};

function greetingWish(cafeName: string) {
  const h = new Date().getHours();
  if (h < 12) return `${cafeName} size mutlu sabahlar diler`;
  if (h < 17) return `${cafeName} size iyi öğlenler diler`;
  if (h < 21) return `${cafeName} size iyi akşamlar diler`;
  return `${cafeName} size iyi geceler diler`;
}

export default function AliveHome({
  menu,
  displayStories,
  popularProducts,
  allergyBanner,
}: {
  menu: MenuData;
  displayStories?: MenuStory[] | null;
  popularProducts: PopularProduct[];
  allergyBanner?: ReactNode;
  displayShowcase?: unknown;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const wish = greetingWish(menu.restaurant.name);
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from('.alive-greet, .alive-pop__card, .alive-home-cat, .alive-home__social', {
        opacity: 0,
        y: 18,
        duration: 0.5,
        stagger: 0.05,
        ease: 'power2.out',
        clearProps: 'transform',
      });
    },
    { scope: rootRef, dependencies: [menu.groups.length, popularProducts.length] }
  );

  return (
    <div className="alive-shell" ref={rootRef}>
      {allergyBanner}

      <section className="alive-greet" aria-label="Karşılama">
        <div className="alive-greet__blobs" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <div className="alive-greet__top">
          {menu.restaurant.logoUrl ? (
            <img
              src={imageUrl(menu.restaurant.logoUrl)}
              alt=""
              className="alive-greet__logo"
            />
          ) : (
            <span className="alive-greet__logo-fallback" aria-hidden>
              {menu.restaurant.name.charAt(0)}
            </span>
          )}
        </div>
        <h1>{wish}</h1>
        <p>
          {menu.welcomeMessage ||
            (menu.campaign?.name
              ? menu.campaign.name
              : 'Dijital menümüze hoş geldiniz. Afiyet olsun!')}
        </p>
      </section>

      {displayStories && displayStories.length > 0 ? (
        <div className="alive-home__stories">
          <MobileStoriesStrip stories={displayStories} />
        </div>
      ) : null}

      {popularProducts.length > 0 ? (
        <section className="alive-pop" aria-label="Önerilenler">
          <div className="alive-pop__head">
            <h2>Önerilenler</h2>
          </div>
          <div className="alive-pop__track">
            {popularProducts.slice(0, 10).map((p) => (
              <Link key={p.id} to={menuProductPath(p.id)} className="alive-pop__card">
                <div className="alive-pop__media">
                  {p.imageUrl ? (
                    <img src={imageUrl(p.imageUrl)} alt="" />
                  ) : (
                    <MenuMediaPlaceholder kind="product" size="md" label={p.name} />
                  )}
                </div>
                <strong>{p.name}</strong>
                <span>{formatMoney(p.price, p.currency)}</span>
                <span className="alive-pop__plus" aria-hidden>
                  <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="alive-home-cats" aria-label="Kategoriler">
        <div className="alive-pop__head">
          <h2>Kategoriler</h2>
        </div>
        <div className="alive-home-cats__grid">
          {menu.groups.map((g) => (
            <Link key={g.id} to={menuGroupPath(g.id)} className="alive-home-cat">
              <div className="alive-home-cat__media">
                {g.imageUrl ? (
                  <img src={imageUrl(g.imageUrl)} alt="" />
                ) : (
                  <MenuMediaPlaceholder kind="group" size="md" label={g.name} />
                )}
              </div>
              <div className="alive-home-cat__copy">
                <h3>{g.name}</h3>
                {g.productCount != null ? <p>{g.productCount} ürün</p> : null}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {menu.socialLinks && menu.socialLinks.length > 0 ? (
        <footer className="alive-home__social">
          <p>Takip et</p>
          <PublicSocialLinks links={menu.socialLinks} />
        </footer>
      ) : null}
    </div>
  );
}
