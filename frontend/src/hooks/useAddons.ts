import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ADDON_CATALOG, type AddonProduct } from '@/addons';
import {
  parseMenuAssistantStyle,
  type MenuAssistantStyle,
} from '@/lib/menuAssistantStyle';

interface AddonsResponse {
  owned: string[];
  disabled?: string[];
  menuAssistantStyle?: string;
  products: AddonProduct[];
}

export function useAddons() {
  const [owned, setOwned] = useState<string[]>([]);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [menuAssistantStyle, setMenuAssistantStyle] = useState<MenuAssistantStyle>('sunset');
  const [products, setProducts] = useState<AddonProduct[]>(ADDON_CATALOG);
  const [loading, setLoading] = useState(true);

  const mergeProducts = useCallback((res: AddonsResponse) => {
    const ownedIds = res.owned || [];
    const disabledIds = res.disabled || [];
    setOwned(ownedIds);
    setDisabled(disabledIds);
    setMenuAssistantStyle(parseMenuAssistantStyle(res.menuAssistantStyle));
    setProducts(
      ADDON_CATALOG.map((p) => {
        const fromApi = res.products.find((x) => x.id === p.id);
        const isOwned = ownedIds.includes(p.id);
        return {
          ...p,
          ...fromApi,
          owned: isOwned,
          enabled: isOwned && !disabledIds.includes(p.id),
          toggleable: fromApi?.toggleable ?? p.toggleable,
        };
      })
    );
  }, []);

  const reload = useCallback(async () => {
    const res = await api<AddonsResponse>('/api/admin/addons');
    mergeProducts(res);
  }, [mergeProducts]);

  useEffect(() => {
    reload()
      .catch(() => {
        setOwned([]);
        setDisabled([]);
        setProducts(ADDON_CATALOG.map((p) => ({ ...p, owned: false, enabled: false })));
      })
      .finally(() => setLoading(false));
  }, [reload]);

  function isOwned(id: string) {
    return owned.includes(id);
  }

  function isEnabled(id: string) {
    return owned.includes(id) && !disabled.includes(id);
  }

  async function unlock(productId: string, code: string) {
    const res = await api<{ owned: string[]; disabled?: string[]; message: string }>(
      '/api/admin/addons/unlock',
      {
        method: 'POST',
        body: JSON.stringify({ productId, code }),
      }
    );
    setOwned(res.owned);
    setDisabled(res.disabled || []);
    setProducts((prev) =>
      prev.map((p) => ({
        ...p,
        owned: res.owned.includes(p.id),
        enabled: res.owned.includes(p.id) && !(res.disabled || []).includes(p.id),
      }))
    );
    return res;
  }

  async function setEnabled(productId: string, enabled: boolean) {
    const res = await api<{ enabled: boolean; disabled: string[] }>(
      `/api/admin/addons/${productId}/enabled`,
      {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      }
    );
    setDisabled(res.disabled);
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, enabled: res.enabled } : { ...p, enabled: p.owned && !res.disabled.includes(p.id) }
      )
    );
    return res;
  }

  async function setAssistantStyle(style: MenuAssistantStyle) {
    const res = await api<{ style: MenuAssistantStyle }>('/api/admin/addons/menu-assistant/style', {
      method: 'PATCH',
      body: JSON.stringify({ style }),
    });
    setMenuAssistantStyle(res.style);
    return res;
  }

  return {
    owned,
    disabled,
    products,
    menuAssistantStyle,
    loading,
    reload,
    isOwned,
    isEnabled,
    unlock,
    setEnabled,
    setAssistantStyle,
  };
}
