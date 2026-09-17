import { useEffect, useState } from 'react';
import StandartChatRow, {
  type StandartChatProduct,
} from '@/components/public/standart/StandartChatRow';
import { useSiparisCart } from '@/hooks/useSiparisCart';

export type StandartListProduct = {
  id: number;
  name: string;
  description?: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
  calories?: number | null;
  soldOut?: boolean;
};

export type StandartSubgroup = {
  id: number;
  name: string;
  imageUrl?: string | null;
  products: StandartListProduct[];
};

export default function StandartProductList({
  products,
  subgroups = [],
  groupName,
}: {
  products: StandartListProduct[];
  subgroups?: StandartSubgroup[];
  groupName?: string;
}) {
  const { enabled: cartOn } = useSiparisCart();
  const [activeSub, setActiveSub] = useState<number | 'all'>('all');
  const hasSubs = subgroups.length > 0;

  useEffect(() => {
    setActiveSub('all');
  }, [groupName]);

  const visibleSubs =
    activeSub === 'all' ? subgroups : subgroups.filter((s) => s.id === activeSub);
  const showParent = activeSub === 'all' && products.length > 0;

  const flat: StandartChatProduct[] = [
    ...(showParent
      ? products.map((p) => ({
          productId: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          currency: p.currency,
          imageUrl: p.imageUrl,
          calories: p.calories ?? null,
          soldOut: Boolean(p.soldOut),
        }))
      : []),
    ...visibleSubs.flatMap((s) =>
      s.products.map((p) => ({
        productId: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        imageUrl: p.imageUrl,
        calories: p.calories ?? null,
        soldOut: Boolean(p.soldOut),
      }))
    ),
  ];

  return (
    <section className="std-list" aria-label={groupName || 'Ürünler'}>
      {hasSubs ? (
        <div className="std-list__subs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeSub === 'all'}
            className={`std-cats__chip${activeSub === 'all' ? ' is-active' : ''}`}
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
              className={`std-cats__chip${activeSub === s.id ? ' is-active' : ''}`}
              onClick={() => setActiveSub(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}

      <ul className="std-chat__list">
        {flat.map((p) => (
          <li key={p.productId}>
            <StandartChatRow product={p} swipeEnabled={cartOn} />
          </li>
        ))}
      </ul>
    </section>
  );
}
