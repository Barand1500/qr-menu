import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowUpRight, MoveUpRight } from 'lucide-react';
import type { AboutPageConfig } from '@/lib/aboutPage';
import { Photo, isRtl } from './shared';
import './sahne-about.css';

type Props = {
  config: AboutPageConfig;
  restaurantName: string;
  logoUrl?: string | null;
  photos: string[];
  lang: string;
  social?: ReactNode;
  onBack: () => void;
};

const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** One fixed public story layout; the old admin template selector doesn't control this page. */
export default function SahneAboutPage({
  config,
  restaurantName,
  logoUrl,
  photos,
  lang,
  social,
  onBack,
}: Props) {
  const root = useRef<HTMLElement>(null);
  const story = useRef<HTMLElement>(null);
  const en = !lang.startsWith('tr');
  const title =
    config.headline.trim() ||
    (en ? 'A story that starts at the table.' : 'Masada başlayan bir hikâye.');
  const titleWords = title.split(/\s+/);
  const cut = Math.max(0, titleWords.length - 2);
  const body =
    config.body.trim() ||
    (en
      ? 'Welcome to our table. Take your time, discover the menu and make yourself at home.'
      : 'Soframıza hoş geldiniz. Kendinize biraz zaman ayırın, menümüzü keşfedin ve keyfinize bakın.');
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const highlights = config.highlights.map((p) => p.trim()).filter(Boolean);
  const images = [
    ...new Set(
      [...photos, config.coverUrl].filter((src): src is string => !!src),
    ),
  ].slice(0, 4);
  const gallery = images.slice(1, 3);
  const photoKey = images.join('|');

  useEffect(() => {
    const host = root.current;
    const view = host?.ownerDocument.defaultView;
    if (!host || !view) return;
    const previousY = view.scrollY;
    const path = view.location.pathname;
    view.scrollTo({ top: 0, behavior: 'instant' });
    return () => {
      view.requestAnimationFrame(() => {
        if (
          view.location.pathname === path &&
          !host.ownerDocument.contains(host) &&
          !host.ownerDocument.querySelector('.sh-about')
        ) {
          view.scrollTo({ top: previousY, behavior: 'instant' });
        }
      });
    };
  }, []);

  useEffect(() => {
    const host = root.current;
    const view = host?.ownerDocument.defaultView;
    if (!host || !view) return;
    const media = view.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const revealNodes = Array.from(
      host.querySelectorAll<HTMLElement>('[data-about-reveal]'),
    );
    const readNodes = Array.from(
      host.querySelectorAll<HTMLElement>('[data-about-read]'),
    );
    const photos = Array.from(
      host.querySelectorAll<HTMLElement>('[data-about-photo]'),
    );
    const hero = host.querySelector<HTMLElement>('.sh-about__aperture');
    const ribbon = host.querySelector<HTMLElement>('.sh-about__ribbon');
    const paint = () => {
      frame = 0;
      const h = view.innerHeight;
      const start = host.getBoundingClientRect().top + view.scrollY;
      const distance = Math.max(1, host.scrollHeight - h);
      const progress = clamp((view.scrollY - start) / distance);
      if (media.matches) {
        host.style.setProperty('--about-progress', String(progress));
        return;
      }
      const heroBox = hero?.getBoundingClientRect();
      const open = heroBox ? clamp((h - heroBox.top) / (h * 0.85)) : 1;
      // Read all positions before applying transforms; no React state updates while scrolling.
      const reads = readNodes.map((node) => {
        const box = node.getBoundingClientRect();
        return clamp((h * 0.88 - box.top) / Math.max(1, box.height + h * 0.12));
      });
      const offsets = photos.map((node) => {
        const box = node.getBoundingClientRect();
        return Math.max(
          -1,
          Math.min(1, (h / 2 - box.top - box.height / 2) / h),
        );
      });
      host.style.setProperty('--about-progress', String(progress));
      hero?.style.setProperty('--open', open.toFixed(4));
      readNodes.forEach((node, i) =>
        node.style.setProperty('--read', String(reads[i])),
      );
      photos.forEach((node, i) =>
        node.style.setProperty('--drift', `${offsets[i] * 22}px`),
      );
      if (ribbon)
        ribbon.style.setProperty('--travel', `${(progress - 0.5) * -14}%`);
    };
    const schedule = () => {
      if (!frame) frame = view.requestAnimationFrame(paint);
    };
    const resetMotion = () => {
      host.dataset.motion = media.matches ? 'off' : 'on';
      if (media.matches)
        revealNodes.forEach((node) => node.classList.add('is-seen'));
      schedule();
    };
    const Observer = view.IntersectionObserver;
    const observer = Observer
      ? new Observer(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add('is-seen');
                observer?.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.08 },
        )
      : null;
    revealNodes.forEach((node) =>
      observer ? observer.observe(node) : node.classList.add('is-seen'),
    );
    resetMotion();
    view.addEventListener('scroll', schedule, { passive: true });
    view.addEventListener('resize', schedule);
    media.addEventListener('change', resetMotion);
    const resize = view.ResizeObserver
      ? new view.ResizeObserver(schedule)
      : null;
    resize?.observe(host);
    paint();
    return () => {
      observer?.disconnect();
      resize?.disconnect();
      view.cancelAnimationFrame(frame);
      view.removeEventListener('scroll', schedule);
      view.removeEventListener('resize', schedule);
      media.removeEventListener('change', resetMotion);
    };
  }, [photoKey, body, config.highlights.join('|')]);

  return (
    <article
      ref={root}
      className="sahne sh-about"
      dir={isRtl(lang) ? 'rtl' : 'ltr'}
    >
      <header className="sh-about__nav">
        <div className="sh-about__brand">
          {logoUrl && <Photo src={logoUrl} alt={restaurantName} eager />}
          <span>{restaurantName}</span>
        </div>
        <button type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>{en ? 'Back to menu' : 'Menüye dön'}</span>
        </button>
        <span className="sh-about__progress" aria-hidden="true" />
      </header>

      <section className="sh-about__opening">
        <p className="sh-about__eyebrow">
          {en ? 'ABOUT US' : 'BİZE DAİR'}
          <span />
          {restaurantName}
        </p>
        <h1>
          {titleWords.slice(0, cut).join(' ')}
          {cut > 0 && ' '}
          <i>{titleWords.slice(cut).join(' ')}</i>
        </h1>
        <div className="sh-about__opening-foot">
          <span>
            {en
              ? 'A place at our table, just for you.'
              : 'Bu sofrada sizin de yeriniz var.'}
          </span>
          <button
            type="button"
            onClick={() =>
              story.current?.scrollIntoView({
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
                  .matches
                  ? 'auto'
                  : 'smooth',
                block: 'start',
              })
            }
          >
            {en ? 'Our story' : 'Hikâyemize doğru'}
            <ArrowDown size={19} />
          </button>
        </div>
      </section>

      <figure
        className={`sh-about__aperture${!images.length ? ' sh-about__aperture--empty' : ''}`}
      >
        {images[0] ? (
          <Photo
            src={images[0]}
            alt={
              en
                ? `${restaurantName}, from our table`
                : `${restaurantName}, soframızdan`
            }
            eager
          />
        ) : (
          <div className="sh-about__wordmark">
            {logoUrl && <Photo src={logoUrl} alt="" />}
            <span>{restaurantName}</span>
          </div>
        )}
        <figcaption>
          <span>{restaurantName}</span>
          <span>{en ? 'Take a moment.' : 'Biraz yavaşlayın.'}</span>
        </figcaption>
      </figure>

      <section
        ref={story}
        className="sh-about__story"
        aria-labelledby="sh-about-story-title"
      >
        <div className="sh-about__chapter">
          <span>01 — {en ? 'OUR STORY' : 'HİKÂYEMİZ'}</span>
          <h2 id="sh-about-story-title">
            {en ? 'Behind every' : 'Her sofranın'}
            <br />
            <i>{en ? 'table.' : 'bir hikâyesi var.'}</i>
          </h2>
          {logoUrl && <Photo src={logoUrl} alt={restaurantName} />}
        </div>
        <div className="sh-about__narrative">
          {paragraphs.map((paragraph, i) => {
            const words = paragraph.split(/(\s+)/);
            let wordIndex = 0;
            return (
              <p
                key={i}
                data-about-read
                style={
                  {
                    '--words': words.filter((word) => word.trim()).length,
                  } as CSSProperties
                }
              >
                <span className="sr-only">{paragraph}</span>
                <span aria-hidden="true">
                  {words.map((word, w) =>
                    word.trim() ? (
                      <span
                        className="sh-about__read-word"
                        style={{ '--word': wordIndex++ } as CSSProperties}
                        key={w}
                      >
                        {word}
                      </span>
                    ) : (
                      word
                    ),
                  )}
                </span>
              </p>
            );
          })}
        </div>
      </section>

      <div className="sh-about__ribbon" aria-hidden="true">
        <div>
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i}>
              {restaurantName}
              <i> / </i>
            </span>
          ))}
        </div>
      </div>

      {(gallery.length > 0 || highlights.length > 0) && (
        <section
          className="sh-about__details"
          aria-labelledby="sh-about-details-title"
        >
          <header data-about-reveal>
            <span className="sh-about__eyebrow">
              02 — {en ? 'A CLOSER LOOK' : 'BİRAZ YAKINDAN'}
            </span>
            <h2 id="sh-about-details-title">
              {en ? 'The little' : 'Küçük'}{' '}
              <i>{en ? 'details.' : 'dokunuşlar.'}</i>
            </h2>
          </header>
          <div
            className={`sh-about__spread ${gallery.length === 1 ? 'sh-about__spread--single' : ''}`}
          >
            {gallery.map((src, i) => (
              <figure
                data-about-reveal
                key={src}
                className={`sh-about__folio sh-about__folio--${i}`}
              >
                <div data-about-photo>
                  <Photo
                    src={src}
                    alt={
                      en
                        ? `${restaurantName}, a closer look ${i + 1}`
                        : `${restaurantName}, yakından ${i + 1}`
                    }
                  />
                </div>
                <figcaption>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  {restaurantName}
                  <MoveUpRight size={15} aria-hidden="true" />
                </figcaption>
              </figure>
            ))}
          </div>
          {highlights.length > 0 && (
            <ol className="sh-about__values">
              {highlights.map((line, i) => (
                <li key={i} data-about-reveal>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  <h3>{line}</h3>
                  <ArrowUpRight size={26} aria-hidden="true" />
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <footer className="sh-about__closing">
        <div data-about-reveal className="sh-about__invitation">
          {logoUrl && <Photo src={logoUrl} alt={restaurantName} />}
          <p className="sh-about__eyebrow">
            {en ? 'THE REST OF THE STORY' : 'HİKÂYENİN DEVAMI'}
          </p>
          <h2>
            {en ? 'Meet us' : 'Sofrada'}
            <br />
            <i>{en ? 'at the table.' : 'buluşalım.'}</i>
          </h2>
          <button type="button" onClick={onBack}>
            <span>{en ? 'Explore the menu' : 'Menüyü keşfet'}</span>
            <b>
              <ArrowUpRight size={23} />
            </b>
          </button>
        </div>
        <div className="sh-about__colophon">
          <span>{restaurantName}</span>
          {social}
          <span>{en ? 'Glad you’re here.' : 'İyi ki geldiniz.'}</span>
        </div>
      </footer>
    </article>
  );
}
