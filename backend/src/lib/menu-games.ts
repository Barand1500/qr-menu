export const MENU_GAMES_CONFIG_KEY = 'menu_games_config';
/** Eski anahtar — geriye dönük */
export const MENU_GAMES_KEY = 'menu_games_enabled';

export type MemoryPairCount = 4 | 6 | 8;

export type MemoryPair = {
  id: string;
  imageA: string;
  imageB: string;
};

export type MenuGamesConfig = {
  enabled: boolean;
  memory: {
    enabled: boolean;
    pairCount: MemoryPairCount;
    /** Eşleştirilecek çiftler (özel görseller) */
    pairs: MemoryPair[];
    /** Henüz eşlenmemiş yüklenen görseller */
    pool: string[];
  };
  xox: {
    enabled: boolean;
  };
};

export const DEFAULT_MENU_GAMES_CONFIG: MenuGamesConfig = {
  enabled: true,
  memory: {
    enabled: true,
    pairCount: 6,
    pairs: [],
    pool: [],
  },
  xox: {
    enabled: true,
  },
};

function asPairCount(n: unknown): MemoryPairCount {
  const v = Number(n);
  if (v === 4 || v === 6 || v === 8) return v;
  return 6;
}

export function parseMenuGamesConfig(
  raw?: string | null,
  legacyEnabledRaw?: string | null
): MenuGamesConfig {
  const base: MenuGamesConfig = structuredClone(DEFAULT_MENU_GAMES_CONFIG);

  if (legacyEnabledRaw === 'false' || legacyEnabledRaw === '0') {
    base.enabled = false;
  }

  if (!raw || !raw.trim()) return base;

  try {
    const j = JSON.parse(raw) as Partial<MenuGamesConfig>;
    if (typeof j.enabled === 'boolean') base.enabled = j.enabled;
    if (j.memory && typeof j.memory === 'object') {
      if (typeof j.memory.enabled === 'boolean') base.memory.enabled = j.memory.enabled;
      base.memory.pairCount = asPairCount(j.memory.pairCount);
      if (Array.isArray(j.memory.pairs)) {
        base.memory.pairs = j.memory.pairs
          .filter(
            (p) =>
              p &&
              typeof p === 'object' &&
              typeof (p as MemoryPair).imageA === 'string' &&
              typeof (p as MemoryPair).imageB === 'string'
          )
          .map((p) => ({
            id: String((p as MemoryPair).id || `p-${Math.random().toString(36).slice(2, 8)}`),
            imageA: String((p as MemoryPair).imageA),
            imageB: String((p as MemoryPair).imageB),
          }))
          .slice(0, 24);
      }
      if (Array.isArray(j.memory.pool)) {
        base.memory.pool = j.memory.pool
          .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
          .map((u) => u.trim())
          .slice(0, 48);
      }
    }
    if (j.xox && typeof j.xox === 'object' && typeof j.xox.enabled === 'boolean') {
      base.xox.enabled = j.xox.enabled;
    }
  } catch {
    /* keep defaults */
  }

  return base;
}

export function isMenuGamesEnabled(config: MenuGamesConfig): boolean {
  return config.enabled === true;
}

/** Müşteriye gidecek güvenli özet */
export function publicMenuGamesPayload(config: MenuGamesConfig) {
  const on = isMenuGamesEnabled(config);
  return {
    enabled: on,
    memory: {
      enabled: on && config.memory.enabled,
      pairCount: config.memory.pairCount,
      pairs: on && config.memory.enabled ? config.memory.pairs.slice(0, config.memory.pairCount) : [],
    },
    xox: {
      enabled: on && config.xox.enabled,
    },
  };
}
