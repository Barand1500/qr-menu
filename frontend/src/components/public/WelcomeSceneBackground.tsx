/** Karşılama ekranı canlı arka plan katmanları */

interface WelcomeSceneBackgroundProps {
  theme?: string;
}

export default function WelcomeSceneBackground({
  theme = 'vibrant',
}: WelcomeSceneBackgroundProps) {
  const isCinema = theme === 'cinema';
  const isNeon = theme === 'neon';
  const isKitty = theme === 'kitty';

  const bokehCount = isKitty ? 0 : isCinema ? 6 : isNeon ? 12 : 10;
  const sparkleCount = isKitty ? 0 : isCinema ? 14 : isNeon ? 36 : 28;

  return (
    <>
      <div className="welcome-scene__bg" aria-hidden>
        <div className="welcome-scene__gradient" />
        {!isKitty ? (
          <>
            <div className="welcome-scene__aurora welcome-scene__aurora--1" />
            <div className="welcome-scene__aurora welcome-scene__aurora--2" />
            <div className="welcome-scene__aurora welcome-scene__aurora--3" />
            <div className="welcome-scene__mesh" />
            <span className="welcome-scene__orb welcome-scene__orb--1" />
            <span className="welcome-scene__orb welcome-scene__orb--2" />
            <span className="welcome-scene__orb welcome-scene__orb--3" />
            <span className="welcome-scene__orb welcome-scene__orb--4" />
            <span className="welcome-scene__orb welcome-scene__orb--5" />
            <span className="welcome-scene__orb welcome-scene__orb--6" />
            <div className="welcome-scene__bokeh">
              {Array.from({ length: bokehCount }).map((_, i) => (
                <span
                  key={i}
                  className={`welcome-scene__bokeh-dot welcome-scene__bokeh-dot--${(i % 5) + 1}`}
                  style={{ animationDelay: `${i * 0.7}s` }}
                />
              ))}
            </div>
            <div className="welcome-scene__sparkles">
              {Array.from({ length: sparkleCount }).map((_, i) => (
                <span
                  key={i}
                  className={`welcome-scene__sparkle welcome-scene__sparkle--${(i % 4) + 1}`}
                  style={{
                    animationDelay: `${i * 0.22}s`,
                    animationDuration: `${isNeon ? 1.8 + (i % 4) * 0.35 : 3 + (i % 5)}s`,
                  }}
                />
              ))}
            </div>
            <div className="welcome-scene__shimmer" />
            <div className="welcome-scene__rays" />
          </>
        ) : null}

        {isCinema && (
          <>
            <div className="welcome-scene__cinema-spotlight" />
            <div className="welcome-scene__cinema-vignette" />
            <div className="welcome-scene__cinema-grain" />
            <div className="welcome-scene__cinema-letterbox welcome-scene__cinema-letterbox--top" />
            <div className="welcome-scene__cinema-letterbox welcome-scene__cinema-letterbox--bottom" />
          </>
        )}

        {isNeon && (
          <>
            <div className="welcome-scene__neon-grid" />
            <div className="welcome-scene__neon-beam welcome-scene__neon-beam--1" />
            <div className="welcome-scene__neon-beam welcome-scene__neon-beam--2" />
            <div className="welcome-scene__neon-beam welcome-scene__neon-beam--3" />
            <div className="welcome-scene__neon-ring welcome-scene__neon-ring--1" />
            <div className="welcome-scene__neon-ring welcome-scene__neon-ring--2" />
            <div className="welcome-scene__neon-pulse" />
          </>
        )}

        {isKitty && (
          <div className="welcome-scene__kitty">
            <div className="welcome-scene__kitty-sky" />
            <div className="welcome-scene__kitty-floor" />
            <div className="welcome-scene__kitty-mascot">
              <img
                src="/welcome/kitty-peek.png"
                alt=""
                className="welcome-scene__kitty-photo"
                draggable={false}
              />
            </div>
          </div>
        )}
      </div>
      <div className="welcome-scene__glow" aria-hidden />
    </>
  );
}
