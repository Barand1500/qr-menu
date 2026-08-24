/** Karşılama ekranı canlı arka plan katmanları */
export default function WelcomeSceneBackground() {
  return (
    <>
      <div className="welcome-scene__bg" aria-hidden>
        <div className="welcome-scene__gradient" />
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
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className={`welcome-scene__bokeh-dot welcome-scene__bokeh-dot--${(i % 5) + 1}`}
              style={{ animationDelay: `${i * 0.7}s` }}
            />
          ))}
        </div>
        <div className="welcome-scene__sparkles">
          {Array.from({ length: 28 }).map((_, i) => (
            <span
              key={i}
              className={`welcome-scene__sparkle welcome-scene__sparkle--${(i % 4) + 1}`}
              style={{ animationDelay: `${i * 0.28}s`, animationDuration: `${3 + (i % 5)}s` }}
            />
          ))}
        </div>
        <div className="welcome-scene__shimmer" />
        <div className="welcome-scene__rays" />
      </div>
      <div className="welcome-scene__glow" aria-hidden />
    </>
  );
}
