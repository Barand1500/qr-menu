import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ADDON_CATALOG, type AddonProduct } from '@/addons';
import {
  parseMenuAssistantStyle,
  type MenuAssistantStyle,
} from '@/lib/menuAssistantStyle';
import {
  DEFAULT_LINEAR_CONFIG,
  type LinearThemeConfig,
} from '@/lib/menuLinearConfig';
import {
  DEFAULT_ANIMASYON_CONFIG,
  type AnimasyonThemeConfig,
} from '@/lib/menuAnimasyonConfig';
import {
  DEFAULT_WELCOME_BASKETBALL_CONFIG,
  parseWelcomeBasketballConfig,
  type WelcomeBasketballConfig,
} from '@/lib/welcomeBasketballConfig';

interface AddonsResponse {
  owned: string[];
  disabled?: string[];
  menuAssistantStyle?: string;
  linearConfig?: LinearThemeConfig;
  animasyonConfig?: AnimasyonThemeConfig;
  basketballConfig?: WelcomeBasketballConfig;
  products: AddonProduct[];
}

export function useAddons() {
  const [owned, setOwned] = useState<string[]>([]);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [menuAssistantStyle, setMenuAssistantStyle] = useState<MenuAssistantStyle>('sunset');
  const [linearConfig, setLinearConfig] = useState<LinearThemeConfig>(DEFAULT_LINEAR_CONFIG);
  const [animasyonConfig, setAnimasyonConfig] =
    useState<AnimasyonThemeConfig>(DEFAULT_ANIMASYON_CONFIG);
  const [basketballConfig, setBasketballConfig] = useState<WelcomeBasketballConfig>(
    DEFAULT_WELCOME_BASKETBALL_CONFIG
  );
  const [products, setProducts] = useState<AddonProduct[]>(ADDON_CATALOG);
  const [loading, setLoading] = useState(true);

  const mergeProducts = useCallback((res: AddonsResponse) => {
    const ownedIds = res.owned || [];
    const disabledIds = res.disabled || [];
    setOwned(ownedIds);
    setDisabled(disabledIds);
    setMenuAssistantStyle(parseMenuAssistantStyle(res.menuAssistantStyle));
    if (res.linearConfig) setLinearConfig(res.linearConfig);
    if (res.animasyonConfig) setAnimasyonConfig(res.animasyonConfig);
    if (res.basketballConfig) {
      setBasketballConfig(parseWelcomeBasketballConfig(res.basketballConfig));
    }
    setProducts(
      ADDON_CATALOG.map((p) => {
        const fromApi = res.products.find((x) => x.id === p.id);
        const isOwned = Boolean(p.free) || Boolean(fromApi?.free) || ownedIds.includes(p.id);
        return {
          ...p,
          ...fromApi,
          free: Boolean(p.free || fromApi?.free),
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
        setProducts(
          ADDON_CATALOG.map((p) => ({
            ...p,
            owned: Boolean(p.free),
            enabled: Boolean(p.free),
          }))
        );
      })
      .finally(() => setLoading(false));
  }, [reload]);

  function isOwned(id: string) {
    const product = ADDON_CATALOG.find((p) => p.id === id);
    if (product?.free) return true;
    return owned.includes(id);
  }

  function isEnabled(id: string) {
    const product = ADDON_CATALOG.find((p) => p.id === id);
    if (product?.free) return !disabled.includes(id);
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
      prev.map((p) => {
        const isOwnedNow = Boolean(p.free) || res.owned.includes(p.id);
        return {
          ...p,
          owned: isOwnedNow,
          enabled: isOwnedNow && !(res.disabled || []).includes(p.id),
        };
      })
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
        p.id === productId
          ? { ...p, enabled: res.enabled }
          : { ...p, enabled: p.owned && !res.disabled.includes(p.id) }
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

  async function setLinearThemeConfig(config: LinearThemeConfig) {
    const res = await api<{ config: LinearThemeConfig }>('/api/admin/addons/menu-linear/config', {
      method: 'PATCH',
      body: JSON.stringify(config),
    });
    setLinearConfig(res.config);
    return res;
  }

  async function setAnimasyonThemeConfig(config: AnimasyonThemeConfig) {
    const res = await api<{ config: AnimasyonThemeConfig }>(
      '/api/admin/addons/menu-animasyon/config',
      {
        method: 'PATCH',
        body: JSON.stringify(config),
      }
    );
    setAnimasyonConfig(res.config);
    return res;
  }

  async function setBasketballThemeConfig(config: WelcomeBasketballConfig) {
    const res = await api<{ config: WelcomeBasketballConfig }>(
      '/api/admin/addons/welcome-basketball/config',
      {
        method: 'PATCH',
        body: JSON.stringify(config),
      }
    );
    setBasketballConfig(parseWelcomeBasketballConfig(res.config));
    return res;
  }

  return {
    owned,
    disabled,
    products,
    menuAssistantStyle,
    linearConfig,
    animasyonConfig,
    basketballConfig,
    loading,
    reload,
    isOwned,
    isEnabled,
    unlock,
    setEnabled,
    setAssistantStyle,
    setLinearThemeConfig,
    setAnimasyonThemeConfig,
    setBasketballThemeConfig,
  };
}
