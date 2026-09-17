import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatMoney, imageUrl } from '@/lib/api';
import { useMenuSlug } from '@/hooks/useMenuSlug';
import { menuProductPath } from '@/lib/menuPaths';

type MenuGroup = {
  id: number;
  name: string;
  imageUrl?: string | null;
};

type GroupProduct = {
  id: number;
  name: string;
  description?: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
  soldOut?: boolean;
};

type PanelData = {
  group: MenuGroup;
  products: GroupProduct[];
};

/** PC bento board — koyu paneller, tipografi listesi, yuvarlak foto */
export default function StandartPcBoard({
  groups,
  lang,
  campaignSlug,
}: {
  groups: MenuGroup[];
  lang: string;
  campaignSlug?: string;
}) {
  const { slug } = useMenuSlug();
  const [panels, setPanels] = useState<PanelData[]>([]);
  const [loading, setLoading] = useState(true);

  // groups array identity — id listesi değişince yenile
  const groupKey = groups.map((g) => g.id).join(',');

  useEffect(() => {
    if (!slug || groups.length === 0) {
      setPanels([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ lang });
    if (campaignSlug) params.set('kampanya', campaignSlug);

    Promise.all(
      groups.map((g) =>
        api<{ products: GroupProduct[] }>(
          `/api/menu/${slug}/groups/${g.id}/products?${params}`
        )
          .then((data) => ({ group: g, products: data.products || [] }))
          .catch(() => ({ group: g, products: [] as GroupProduct[] }))
      )
    ).then((rows) => {
      if (!cancelled) {
        setPanels(rows);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- groupKey özeti
  }, [slug, lang, campaignSlug, groupKey]);

  if (loading) {
    return (
      <div className="std-board std-board--loading" aria-busy>
        <p>Yükleniyor…</p>
      </div>
    );
  }

  if (panels.length === 0) {
    return (
      <div className="std-board">
        <p className="std-board__empty">Kategori yok</p>
      </div>
    );
  }

  return (
    <div className="std-board" aria-label="Menü">
      {panels.map((panel, index) => {
        const items = panel.products.slice(0, 8);
        const photos = [
          panel.group.imageUrl,
          ...panel.products.map((p) => p.imageUrl),
        ].filter((src): src is string => Boolean(src && String(src).trim()));
        const uniquePhotos = [...new Set(photos)].slice(0, 2);
        const variant = index % 5;

        return (
          <section
            key={panel.group.id}
            className={`std-panel std-panel--v${variant}`}
          >
            <h2 className="std-panel__title">{panel.group.name}</h2>

            <div className="std-panel__body">
              <ul className="std-panel__items">
                {items.length === 0 ? (
                  <li className="std-panel__empty">Ürün yok</li>
                ) : (
                  items.map((p) => (
                    <li key={p.id} data-sold-out={p.soldOut ? 'true' : undefined}>
                      <Link to={menuProductPath(p.id)} className="std-panel__item">
                        <span className="std-panel__item-row">
                          <span className="std-panel__item-name">{p.name}</span>
                          <span className="std-panel__dots" aria-hidden />
                          <span className="std-panel__item-price">
                            {formatMoney(p.price, p.currency)}
                          </span>
                        </span>
                        {p.description ? (
                          <span className="std-panel__item-desc">{p.description}</span>
                        ) : null}
                      </Link>
                    </li>
                  ))
                )}
              </ul>

              {uniquePhotos.length > 0 ? (
                <div className="std-panel__photos" aria-hidden>
                  {uniquePhotos.map((src, i) => (
                    <span key={`${src}-${i}`} className={`std-panel__photo std-panel__photo--${i}`}>
                      <img src={imageUrl(src)} alt="" />
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
