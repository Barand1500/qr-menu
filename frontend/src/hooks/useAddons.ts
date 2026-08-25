import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ADDON_CATALOG, type AddonProduct } from '@/lib/addons';

interface AddonsResponse {
  owned: string[];
  products: AddonProduct[];
}

export function useAddons() {
  const [owned, setOwned] = useState<string[]>([]);
  const [products, setProducts] = useState<AddonProduct[]>(ADDON_CATALOG);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const res = await api<AddonsResponse>('/api/admin/addons');
    setOwned(res.owned);
    setProducts(
      ADDON_CATALOG.map((p) => ({
        ...p,
        owned: res.owned.includes(p.id),
        ...(res.products.find((x) => x.id === p.id) || {}),
      }))
    );
  }, []);

  useEffect(() => {
    reload()
      .catch(() => {
        setOwned([]);
        setProducts(ADDON_CATALOG.map((p) => ({ ...p, owned: false })));
      })
      .finally(() => setLoading(false));
  }, [reload]);

  function isOwned(id: string) {
    return owned.includes(id);
  }

  async function unlock(productId: string, code: string) {
    const res = await api<{ owned: string[]; message: string }>('/api/admin/addons/unlock', {
      method: 'POST',
      body: JSON.stringify({ productId, code }),
    });
    setOwned(res.owned);
    setProducts((prev) =>
      prev.map((p) => ({ ...p, owned: res.owned.includes(p.id) }))
    );
    return res;
  }

  return { owned, products, loading, reload, isOwned, unlock };
}
