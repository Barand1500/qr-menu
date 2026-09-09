export type CupsShuffleSpeed = 'slow' | 'normal' | 'fast';

export type WelcomeCupsConfig = {
  shuffleSpeed: CupsShuffleSpeed;
  shuffleCount: number;
  skipEnabled: boolean;
  skipDelaySeconds: number;
  soundEnabled: boolean;
};

export const DEFAULT_WELCOME_CUPS_CONFIG: WelcomeCupsConfig = {
  shuffleSpeed: 'normal',
  shuffleCount: 6,
  skipEnabled: true,
  skipDelaySeconds: 6,
  soundEnabled: true,
};

export function parseWelcomeCupsConfig(
  raw?: string | null | Partial<WelcomeCupsConfig>
): WelcomeCupsConfig {
  let data: Partial<WelcomeCupsConfig> = {};
  try {
    data =
      typeof raw === 'string'
        ? (JSON.parse(raw) as Partial<WelcomeCupsConfig>)
        : raw || {};
  } catch {
    data = {};
  }

  const shuffleCount = Math.round(Number(data.shuffleCount));
  const skipDelaySeconds = Math.round(Number(data.skipDelaySeconds));
  const shuffleSpeed: CupsShuffleSpeed =
    data.shuffleSpeed === 'slow' || data.shuffleSpeed === 'fast'
      ? data.shuffleSpeed
      : 'normal';

  return {
    shuffleSpeed,
    shuffleCount:
      Number.isFinite(shuffleCount) && shuffleCount >= 3 && shuffleCount <= 12
        ? shuffleCount
        : DEFAULT_WELCOME_CUPS_CONFIG.shuffleCount,
    skipEnabled: data.skipEnabled !== false,
    skipDelaySeconds:
      Number.isFinite(skipDelaySeconds) && skipDelaySeconds >= 0 && skipDelaySeconds <= 20
        ? skipDelaySeconds
        : DEFAULT_WELCOME_CUPS_CONFIG.skipDelaySeconds,
    soundEnabled: data.soundEnabled !== false,
  };
}
