import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney, imageUrl } from '@/lib/api';
import { menuProductPath } from '@/lib/menuPaths';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsapSetup';

export type SadeListProduct = {
  id: number;
  name: string;
  description?: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
};

export type SadeSubgroup = {
  id: number;
  name: string;
  imageUrl?: string | null;
  products: SadeListProduct[];
};

/** Sıkışmış 🤩 — daireye zor sığmış gibi */
function MotifEmoji({ rotate = 0 }: { rotate?: number }) {
  return (
    <span
      className="sade-list__motif sade-list__motif--emoji"
      style={{ ['--motif-rot' as string]: `${rotate}deg` }}
      aria-hidden
    >
      🤩
    </span>
  );
}

const PLACEHOLDERS: ReactNode[] = [
  <MotifEmoji key="a" rotate={-8} />,
  <MotifEmoji key="b" rotate={6} />,
  <MotifEmoji key="c" rotate={-4} />,
];

function ProductRows({ products }: { products: SadeListProduct[] }) {
  return (
    <ul className="sade-list__items">
      {products.map((p) => (
        <li key={p.id}>
          <Link to={menuProductPath(p.id)} className="sade-list__row">
            <span className="sade-list__name">{p.name}</span>
            <span className="sade-list__dots" aria-hidden />
            <span className="sade-list__price">{formatMoney(p.price, p.currency)}</span>
          </Link>
          {p.description ? <p className="sade-list__desc">{p.description}</p> : null}
        </li>
      ))}
    </ul>
  );
}

/** Tipografi odaklı isim + fiyat listesi (mobil + PC) */
export default function SadeProductList({
  products,
  subgroups = [],
  groupName,
}: {
  products: SadeListProduct[];
  subgroups?: SadeSubgroup[];
  groupName?: string;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const [activeSub, setActiveSub] = useState<number | 'all'>('all');

  const bubbleImages = [...products, ...subgroups.flatMap((s) => s.products)]
    .map((p) => p.imageUrl)
    .filter((src): src is string => Boolean(src && String(src).trim()))
    .slice(0, 3);

  const hasSubs = subgroups.length > 0;
  const visibleSubs =
    activeSub === 'all' ? subgroups : subgroups.filter((s) => s.id === activeSub);
  const showParent = activeSub === 'all' && products.length > 0;

  useEffect(() => {
    setActiveSub('all');
  }, [groupName]);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from('.sade-list__row, .sade-list__subhead', {
        opacity: 0,
        x: -10,
        duration: 0.4,
        stagger: 0.035,
        ease: 'power2.out',
        clearProps: 'transform',
      });
      gsap.from('.sade-list__blob', {
        opacity: 0,
        scale: 0.82,
        duration: 0.65,
        stagger: 0.1,
        ease: 'power2.out',
        clearProps: 'transform',
      });
    },
    {
      scope: rootRef,
      dependencies: [products.length, subgroups.length, activeSub, bubbleImages.join('|')],
    }
  );

  return (
    <section className="sade-list" ref={rootRef}>
      {groupName ? (
        <header className="sade-list__head">
          <h1>{groupName}</h1>
          <span className="sade-list__rule" aria-hidden />
        </header>
      ) : null}

      {hasSubs ? (
        <div className="sade-list__subnav" role="tablist" aria-label="Alt kategoriler">
          <button
            type="button"
            role="tab"
            aria-selected={activeSub === 'all'}
            className={`sade-list__subpill${activeSub === 'all' ? ' is-active' : ''}`}
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
              className={`sade-list__subpill${activeSub === s.id ? ' is-active' : ''}`}
              onClick={() => setActiveSub(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="sade-list__body">
        <div className="sade-list__cols">
          {showParent ? <ProductRows products={products} /> : null}

          {visibleSubs.map((sub) => (
            <div key={sub.id} className="sade-list__section" id={`sade-sub-${sub.id}`}>
              <div className="sade-list__subhead">
                <span className="sade-list__subline" aria-hidden />
                <h2>{sub.name}</h2>
                <span className="sade-list__subline" aria-hidden />
              </div>
              <ProductRows products={sub.products} />
            </div>
          ))}

          {!showParent && visibleSubs.length === 0 && products.length > 0 ? (
            <ProductRows products={products} />
          ) : null}
        </div>

        <div className="sade-list__art" aria-hidden>
          {[0, 1, 2].map((i) => {
            const src = bubbleImages[i];
            return (
              <span
                key={i}
                className={`sade-list__blob sade-list__blob--${i + 1}${
                  src ? ' sade-list__blob--photo' : ' sade-list__blob--motif'
                }`}
              >
                {src ? <img src={imageUrl(src)} alt="" /> : PLACEHOLDERS[i]}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
