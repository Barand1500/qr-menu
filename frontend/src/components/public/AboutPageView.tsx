import { imageUrl } from '@/lib/api';
import type { AboutPageConfig } from '@/lib/aboutPage';
import '@/about-page.css';

export default function AboutPageView({
  config,
  restaurantName,
  social,
  preview,
}: {
  config: AboutPageConfig;
  restaurantName: string;
  social?: React.ReactNode;
  preview?: boolean;
}) {
  const title = config.headline.trim() || restaurantName;
  const body =
    config.body.trim() ||
    (preview ? 'Metin buraya gelecek…' : 'Dijital menümüze hoş geldiniz.');
  const cover = config.coverUrl ? imageUrl(config.coverUrl) : null;
  const tpl = config.template;

  return (
    <article className={`about-page about-page--${tpl}${preview ? ' about-page--preview' : ''}`}>
      {tpl === 'story' ? (
        <>
          <div className="about-page__hero">
            {cover ? <img src={cover} alt="" /> : <div className="about-page__hero-fallback" />}
            <div className="about-page__hero-copy">
              <h2>{title}</h2>
            </div>
          </div>
          <div className="about-page__body">
            <p>{body}</p>
            {social}
          </div>
        </>
      ) : tpl === 'editorial' ? (
        <div className="about-page__editorial">
          <div className="about-page__editorial-media">
            {cover ? <img src={cover} alt="" /> : <div className="about-page__hero-fallback" />}
          </div>
          <div className="about-page__editorial-copy">
            <h2>{title}</h2>
            <p>{body}</p>
            {social}
          </div>
        </div>
      ) : (
        <>
          {cover ? (
            <div className="about-page__cover">
              <img src={cover} alt="" />
            </div>
          ) : null}
          <div className="about-page__body">
            <h2>{title}</h2>
            <p>{body}</p>
            {tpl === 'highlights' && config.highlights.some((h) => h.trim()) ? (
              <ul className="about-page__highlights">
                {config.highlights
                  .filter((h) => h.trim())
                  .map((h) => (
                    <li key={h}>{h}</li>
                  ))}
              </ul>
            ) : null}
            {social}
          </div>
        </>
      )}
    </article>
  );
}
