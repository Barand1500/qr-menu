export type MemoryPairCount = 4 | 6 | 8;

export type MemoryPair = {
  id: string;
  imageA: string;
  imageB: string;
};

export type DetectiveAdminQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
};

export type MenuGamesConfig = {
  enabled: boolean;
  memory: {
    enabled: boolean;
    pairCount: MemoryPairCount;
    pairs: MemoryPair[];
    pool: string[];
  };
  xox: {
    enabled: boolean;
  };
  detective: {
    enabled: boolean;
    questions: DetectiveAdminQuestion[];
  };
  blitz: {
    enabled: boolean;
  };
};

export type PublicMenuGames = {
  enabled: boolean;
  memory: {
    enabled: boolean;
    pairCount: MemoryPairCount;
    pairs: MemoryPair[];
  };
  xox: {
    enabled: boolean;
  };
  detective: {
    enabled: boolean;
    questions: DetectiveAdminQuestion[];
  };
  blitz: {
    enabled: boolean;
  };
};

export const DEFAULT_MENU_GAMES_CONFIG: MenuGamesConfig = {
  enabled: true,
  memory: { enabled: true, pairCount: 6, pairs: [], pool: [] },
  xox: { enabled: true },
  detective: { enabled: true, questions: [] },
  blitz: { enabled: true },
};

export function isPublicGamesOn(g?: PublicMenuGames | boolean | null): boolean {
  if (g == null) return true;
  if (typeof g === 'boolean') return g;
  return g.enabled !== false;
}
