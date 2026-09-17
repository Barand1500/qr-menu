import { useCallback, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useMenuSlug } from '@/hooks/useMenuSlug';
import { useSiparisCart } from '@/hooks/useSiparisCart';
import type { StandartChatProduct } from '@/components/public/standart/StandartChatRow';
import type { StandartModalProduct } from '@/components/public/standart/StandartOptionsModal';
import type { ProductOptionGroup } from '@/lib/productOptions';

const HINT_KEY = 'std-swipe-hint-seen';

export function useStandartSwipeHint(listKey: string) {
  const [hintId, setHintId] = useState<number | null>(null);
  const ran = useRef<string | null>(null);

  const maybeHint = useCallback(
    (firstProductId: number | null) => {
      if (firstProductId == null) return;
      if (typeof window === 'undefined') return;
      if (window.matchMedia('(min-width: 900px)').matches) return;
      if (sessionStorage.getItem(HINT_KEY)) return;
      if (ran.current === listKey) return;
      ran.current = listKey;
      setHintId(firstProductId);
      sessionStorage.setItem(HINT_KEY, '1');
      window.setTimeout(() => setHintId(null), 1800);
    },
    [listKey]
  );

  return { hintId, maybeHint };
}

export function useStandartSwipeAdd(lang: string, campaignSlug?: string) {
  const { slug } = useMenuSlug();
  const { addItem } = useSiparisCart();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalProduct, setModalProduct] = useState<StandartModalProduct | null>(null);

  const onSwipeAdd = useCallback(
    async (product: StandartChatProduct, fromEl: HTMLElement | null) => {
      if (!product.hasOptions) {
        addItem(
          {
            productId: product.productId,
            name: product.name,
            price: product.price,
            currency: product.currency,
            imageUrl: product.imageUrl,
            calories: product.calories,
          },
          { fromEl }
        );
        return;
      }

      setModalProduct({
        id: product.productId,
        name: product.name,
        description: product.description,
        price: product.price,
        currency: product.currency,
        imageUrl: product.imageUrl,
        calories: product.calories,
        optionGroups: [],
      });
      setModalOpen(true);
      setModalLoading(true);

      if (!slug) {
        setModalLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams({ lang });
        if (campaignSlug) params.set('kampanya', campaignSlug);
        const full = await api<{
          id: number;
          name: string;
          description?: string;
          price: number;
          currency?: { code?: string; symbol?: string } | null;
          imageUrl?: string | null;
          calories?: number | null;
          optionGroups?: ProductOptionGroup[];
        }>(`/api/menu/${slug}/products/${product.productId}?${params}`);

        if (!full.optionGroups?.length) {
          setModalOpen(false);
          addItem(
            {
              productId: full.id,
              name: full.name,
              price: full.price,
              currency: full.currency,
              imageUrl: full.imageUrl,
              calories: full.calories,
            },
            { fromEl }
          );
          return;
        }

        setModalProduct({
          id: full.id,
          name: full.name,
          description: full.description,
          price: full.price,
          currency: full.currency,
          imageUrl: full.imageUrl,
          calories: full.calories,
          optionGroups: full.optionGroups,
        });
      } catch {
        setModalOpen(false);
        addItem(
          {
            productId: product.productId,
            name: product.name,
            price: product.price,
            currency: product.currency,
            imageUrl: product.imageUrl,
            calories: product.calories,
          },
          { fromEl }
        );
      } finally {
        setModalLoading(false);
      }
    },
    [addItem, campaignSlug, lang, slug]
  );

  return {
    onSwipeAdd,
    modalOpen,
    modalLoading,
    modalProduct,
    closeModal: () => setModalOpen(false),
  };
}
