import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AliveProductCard, {
  type AliveProductCardItem,
} from '@/components/public/alive/AliveProductCard';
import { menuGroupPath } from '@/lib/menuPaths';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsapSetup';

export type AliveSubgroup = {
  id: number;
  name: string;
  products: AliveProductCardItem[];
};

export type AliveNavGroup = {
  id: number;
  name: string;
};

export default function AliveProductList({
  products,
  subgroups = [],
  groupName: _groupName,
  groupId,
  navGroups,
}: {
  products: AliveProductCardItem[];
  subgroups?: AliveSubgroup[];
  groupName: string;
  groupId: number;
  navGroups: AliveNavGroup[];
}) {
  const rootRef = useRef<HTMLElement>(null);
  const [activeSub, setActiveSub] = useState<number | 'all'>('all');
  const hasSubs = subgroups.length > 0;
  const visibleSubs =
    activeSub === 'all' ? subgroups : subgroups.filter((s) => s.id === activeSub);
  const showParent = activeSub === 'all' && products.length > 0;

  useEffect(() => {
    setActiveSub('all');
  }, [groupId]);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from('.alive-card, .alive-list__subhead', {
        opacity: 0,
        y: 14,
        duration: 0.4,
        stagger: 0.04,
        ease: 'power2.out',
        clearProps: 'transform',
      });
    },
    { scope: rootRef, dependencies: [groupId, activeSub, products.length, subgroups.length] }
  );

  return (
    <section className="alive-browse" ref={rootRef}>
      <aside className="alive-vrail" aria-label="Kategoriler">
        <div className="alive-vrail__stack">
          {navGroups.map((g) => {
            const active = g.id === groupId;
            return (
              <Link
                key={g.id}
                to={menuGroupPath(g.id)}
                className={`alive-vrail__item${active ? ' is-active' : ''}`}
              >
                <span className="alive-vrail__label">{g.name}</span>
                {active ? <span className="alive-vrail__dot" aria-hidden /> : null}
              </Link>
            );
          })}
        </div>
      </aside>

      <div className="alive-browse__main">
        {hasSubs ? (
          <div className="alive-subs" role="tablist" aria-label="Alt kategoriler">
            <button
              type="button"
              role="tab"
              aria-selected={activeSub === 'all'}
              className={`alive-subs__pill${activeSub === 'all' ? ' is-active' : ''}`}
              onClick={() => setActiveSub('all')}
            >
              Tümü
            </button>
            {subgroups.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={activeSub === s.id}
                className={`alive-subs__pill${activeSub === s.id ? ' is-active' : ''}`}
                onClick={() => setActiveSub(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
        ) : null}

        <div className="alive-browse__list">
          {showParent
            ? products.map((p) => <AliveProductCard key={p.id} product={p} />)
            : null}

          {visibleSubs.map((sub) => (
            <div key={sub.id} className="alive-list__section">
              <div className="alive-list__subhead">
                <span className="alive-list__subline" aria-hidden />
                <h2>{sub.name}</h2>
                <span className="alive-list__subline" aria-hidden />
              </div>
              {sub.products.map((p) => (
                <AliveProductCard key={p.id} product={p} />
              ))}
            </div>
          ))}

          {!showParent && visibleSubs.length === 0 && products.length > 0
            ? products.map((p) => <AliveProductCard key={p.id} product={p} />)
            : null}
        </div>
      </div>
    </section>
  );
}
