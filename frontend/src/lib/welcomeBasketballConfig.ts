export type BasketballBallStyle = 'auto' | 'logo' | 'basketball';

export type WelcomeBasketballConfig = {
  requiredScores: number;
  skipEnabled: boolean;
  skipDelaySeconds: number;
  movingHoop: boolean;
  ballStyle: BasketballBallStyle;
  soundEnabled: boolean;
};

export const DEFAULT_WELCOME_BASKETBALL_CONFIG: WelcomeBasketballConfig = {
  requiredScores: 1,
  skipEnabled: true,
  skipDelaySeconds: 6,
  movingHoop: false,
  ballStyle: 'auto',
  soundEnabled: true,
};

export function parseWelcomeBasketballConfig(
  raw?: string | null | Partial<WelcomeBasketballConfig>
): WelcomeBasketballConfig {
  let data: Partial<WelcomeBasketballConfig> = {};
  try {
    data =
      typeof raw === 'string'
        ? (JSON.parse(raw) as Partial<WelcomeBasketballConfig>)
        : raw || {};
  } catch {
    data = {};
  }

  const requiredScores = Math.round(Number(data.requiredScores));
  const skipDelaySeconds = Math.round(Number(data.skipDelaySeconds));
  const ballStyle: BasketballBallStyle =
    data.ballStyle === 'logo' || data.ballStyle === 'basketball'
      ? data.ballStyle
      : 'auto';

  return {
    requiredScores:
      Number.isFinite(requiredScores) && requiredScores >= 1 && requiredScores <= 3
        ? requiredScores
        : DEFAULT_WELCOME_BASKETBALL_CONFIG.requiredScores,
    skipEnabled: data.skipEnabled !== false,
    skipDelaySeconds:
      Number.isFinite(skipDelaySeconds) && skipDelaySeconds >= 0 && skipDelaySeconds <= 20
        ? skipDelaySeconds
        : DEFAULT_WELCOME_BASKETBALL_CONFIG.skipDelaySeconds,
    movingHoop: data.movingHoop === true,
    ballStyle,
    soundEnabled: data.soundEnabled !== false,
  };
}
