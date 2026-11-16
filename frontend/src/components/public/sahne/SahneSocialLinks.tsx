import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight } from 'lucide-react';
import { SocialDisplayIcon } from '@/components/SocialDisplayIcon';
import type { PublicSocialLink } from '@/lib/socialCatalog';
import './sahne-social.css';

const NOTES: Record<string, [string, string, string, string]> = {
  instagram: [
    'Önce bir fotoğraf.',
    'Sonra afiyet olsun. Soframızı Instagram’da da takip edin.',
    'One photo first.',
    'Then dig in. Join our table on Instagram, too.',
  ],
  x: [
    'Muhabbet burada da sürüyor.',
    'Tabaklar burada, kısa sohbetler X’te. Bir selam verin.',
    'Keep the conversation going.',
    'The food is here. The little conversations are on X.',
  ],
  youtube: [
    'Bir de hareketli izleyin.',
    'Sofra muhabbeti bu kez ekranda. Kanalımıza da bekleriz.',
    'Take a seat on screen.',
    'A little table talk, this time on YouTube. Come say hello.',
  ],
  whatsapp: [
    'Bir mesaj kadar yakınız.',
    'Aklınıza takılanı yazın. Sohbete buradan devam edelim.',
    'Just a message away.',
    'Have a question? Send a message and keep the conversation going.',
  ],
  tiktok: [
    'Bir lokmalık mola.',
    'Küçük bir kaydırma, küçük bir iştah. TikTok’ta görüşürüz.',
    'A bite-sized break.',
    'A little scrolling, a little appetite. See you on TikTok.',
  ],
  facebook: [
    'Bir sandalye de burada.',
    'Soframıza Facebook’ta da yer ayırın.',
    'A seat over here, too.',
    'Save a little space for our table on Facebook.',
  ],
  threads: [
    'Konuyu sofraya getirelim.',
    'Muhabbetin devamı için Threads’te de buluşalım.',
    'Bring it to the table.',
    'Meet us on Threads and keep the conversation going.',
  ],
};

/** Hover/focus adds a note, never an extra step before opening the actual social link. */
export default function SahneSocialLinks({
  links,
  lang,
}: {
  links: PublicSocialLink[];
  lang: string;
}) {
  const en = !lang.startsWith('tr');
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const anchors = useRef<(HTMLAnchorElement | null)[]>([]);
  const popup = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const clearClose = () => window.clearTimeout(timer.current);
  const open = (index: number) => {
    clearClose();
    setShown(index);
    setActive(index);
  };
  const leave = () => {
    clearClose();
    timer.current = window.setTimeout(() => {
      if (
        !anchors.current.includes(document.activeElement as HTMLAnchorElement)
      )
        setActive(null);
    }, 140);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (active !== null) return;
    const timeout = window.setTimeout(() => setShown(null), 200);
    return () => window.clearTimeout(timeout);
  }, [active]);
  useEffect(() => {
    if (active === null) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearClose();
        setActive(null);
      }
    };
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, [active]);
  useLayoutEffect(() => {
    if (shown === null) return;
    let frame = 0;
    const place = () => {
      frame = 0;
      const anchor = anchors.current[shown];
      const node = popup.current;
      if (!anchor || !node) return;
      const rect = anchor.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight) {
        setActive(null);
        return;
      }
      const width = Math.min(280, innerWidth - 32);
      node.style.width = `${width}px`;
      const height = node.offsetHeight;
      const above = rect.top - height >= 12;
      node.style.left = `${Math.max(16, Math.min(rect.left + rect.width / 2 - width / 2, innerWidth - width - 16))}px`;
      node.style.top = `${Math.max(12, Math.min(above ? rect.top - height : rect.bottom, innerHeight - height - 12))}px`;
      node.dataset.side = above ? 'above' : 'below';
      node.dataset.ready = 'true';
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    place();
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [shown]);

  if (!links.length) return null;
  const link = shown === null ? null : links[shown];
  const note = link ? NOTES[link.id] : null;
  const title = note
    ? note[en ? 2 : 0]
    : en
      ? 'A little hello, elsewhere.'
      : 'Bir selam da buradan.';
  const body = note
    ? note[en ? 3 : 1]
    : en
      ? 'The conversation doesn’t have to end here. Come visit us.'
      : 'Sohbet burada bitmesin. Bizi burada da ziyaret edin.';
  return (
    <>
      <div
        className="sh-about-social"
        role="list"
        aria-label={en ? 'Follow us' : 'Bizi takip edin'}
      >
        {links.map((item, index) => (
          <span role="listitem" key={item.id}>
            <a
              ref={(node) => {
                anchors.current[index] = node;
              }}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={item.label}
              aria-describedby={active === index ? `${id}-note` : undefined}
              onPointerEnter={(e) => {
                if (e.pointerType !== 'touch') open(index);
              }}
              onPointerLeave={leave}
              onFocus={() => open(index)}
              onBlur={() => {
                clearClose();
                setActive(null);
              }}
            >
              <SocialDisplayIcon
                id={item.id}
                iconKey={item.iconKey}
                iconUrl={item.iconUrl}
                className="w-4 h-4"
              />
            </a>
          </span>
        ))}
      </div>
      {link &&
        createPortal(
          <div
            ref={popup}
            id={`${id}-note`}
            role="tooltip"
            aria-hidden={active === null}
            className={`sh-social-window ${active !== null ? 'is-open' : ''}`}
            onPointerEnter={() => {
              clearClose();
              if (shown !== null) setActive(shown);
            }}
            onPointerLeave={leave}
          >
            <div className="sh-social-window__paper">
              <div className="sh-social-window__head">
                <span>{link.label}</span>
                <ArrowUpRight size={17} aria-hidden="true" />
              </div>
              <strong>{title}</strong>
              <p>{body}</p>
              <span className="sh-social-window__sign">
                {en ? 'See you there.' : 'Orada da görüşürüz.'}
              </span>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
