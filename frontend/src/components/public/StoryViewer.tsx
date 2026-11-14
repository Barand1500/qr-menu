import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronUp, Pause, Play, X } from 'lucide-react';
import { imageUrl } from '@/lib/api';
import { menuProductPath } from '@/lib/menuPaths';
import { BrushCaption } from '@/components/public/BrushCaption';
import { useSheetFocus } from './sofra/SofraSheet';
import type { MenuStory } from './MobileStoriesStrip';
import { storySeenKey } from '@/lib/storyHistory';
import './sahne/sahne-entertainment.css';

interface StoryViewerProps {
  stories: MenuStory[];
  initialIndex: number;
  onClose: () => void;
  onViewed?: (story: MenuStory) => void;
  sahne?: boolean;
}

export default function StoryViewer({
  stories,
  initialIndex,
  onClose,
  onViewed,
  sahne = false,
}: StoryViewerProps) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(() =>
    Math.max(0, Math.min(initialIndex, stories.length - 1)),
  );
  const [progress, setProgress] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [loaded, setLoaded] = useState('');
  const [failed, setFailed] = useState('');
  const elapsed = useRef(0);
  const pressStart = useRef(0);
  const pressPoint = useRef({ x: 0, y: 0 });
  const suppressClick = useRef(false);
  const story = stories[index];
  const key = story ? storySeenKey(story) : '';
  const ready = loaded === key || failed === key;
  const paused = userPaused || held || hidden;
  const seconds = Number(story?.durationSeconds ?? 5);
  const duration =
    (Number.isFinite(seconds) ? Math.min(60, Math.max(1, seconds)) : 5) * 1000;
  const panelRef = useSheetFocus(Boolean(story), onClose);

  const reset = useCallback(() => {
    elapsed.current = 0;
    setProgress(0);
    setHeld(false);
  }, []);
  const next = useCallback(() => {
    if (index >= stories.length - 1) {
      onClose();
      return;
    }
    reset();
    setIndex(index + 1);
  }, [index, stories.length, onClose, reset]);
  const previous = useCallback(() => {
    reset();
    setIndex(Math.max(0, index - 1));
  }, [index, reset]);
  const goToProduct = useCallback(() => {
    if (!story) return;
    onClose();
    navigate(menuProductPath(story.productId));
  }, [story, onClose, navigate]);

  useEffect(() => {
    reset();
    setIndex(Math.max(0, Math.min(initialIndex, stories.length - 1)));
  }, [initialIndex, reset, stories.length]);
  useEffect(() => {
    if (story && loaded === key) onViewed?.(story);
  }, [story, loaded, key, onViewed]);
  useEffect(() => {
    const change = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  useEffect(() => {
    if (!story || !ready || paused) return;
    let frame = 0,
      last = performance.now();
    const tick = (now: number) => {
      elapsed.current += now - last;
      last = now;
      const value = Math.min(elapsed.current / duration, 1);
      setProgress(value);
      if (value >= 1) next();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [key, story, ready, paused, duration, next]);
  useEffect(() => {
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        previous();
      }
      if (
        e.code === 'Space' &&
        (e.target === panelRef.current ||
          (e.target as HTMLElement).closest('.story-viewer__content'))
      ) {
        e.preventDefault();
        setUserPaused((v) => !v);
      }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [next, previous, panelRef]);

  if (!story) return null;
  return createPortal(
    <div
      className={`story-viewer${sahne ? ' sh-story-viewer' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={story.name}
    >
      <div className="story-viewer__backdrop" onClick={onClose}>
        {sahne && (
          <img src={imageUrl(story.imageUrl)} alt="" aria-hidden="true" />
        )}
      </div>
      <section ref={panelRef} tabIndex={-1} className="story-viewer__frame">
        <div className="story-viewer__progress-row" aria-hidden="true">
          {stories.map((s, i) => (
            <div key={s.id} className="story-viewer__progress-track">
              <div
                className="story-viewer__progress-fill"
                style={{
                  width:
                    i < index
                      ? '100%'
                      : i === index
                        ? `${progress * 100}%`
                        : '0%',
                }}
              />
            </div>
          ))}
        </div>
        <header className="story-viewer__header">
          <div className="story-viewer__meta">
            <img
              src={imageUrl(story.imageUrl)}
              alt=""
              className="story-viewer__meta-avatar"
            />
            {sahne ? (
              <div className="sh-story-viewer__heading">
                <small>
                  SOFRADAN HİKÂYELER · {index + 1}/{stories.length}
                </small>
                <strong>{story.name}</strong>
              </div>
            ) : (
              <BrushCaption size="sm" className="story-viewer__meta-brush">
                {story.name}
              </BrushCaption>
            )}
          </div>
          {sahne && (
            <button
              type="button"
              className="sh-story-viewer__pause"
              onClick={() => setUserPaused((v) => !v)}
              aria-label={userPaused ? 'Devam et' : 'Duraklat'}
              aria-pressed={userPaused}
            >
              {userPaused ? <Play size={19} /> : <Pause size={19} />}
            </button>
          )}
          <button
            type="button"
            className="story-viewer__close"
            onClick={onClose}
            aria-label="Kapat"
          >
            <X size={24} />
          </button>
        </header>
        <div
          className="story-viewer__content"
          onClick={(e) => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            const box = e.currentTarget.getBoundingClientRect(),
              ratio = (e.clientX - box.left) / box.width;
            if (ratio < 0.28) previous();
            else if (ratio > 0.72) next();
            else goToProduct();
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            pressStart.current = performance.now();
            pressPoint.current = { x: e.clientX, y: e.clientY };
            suppressClick.current = false;
            e.currentTarget.setPointerCapture(e.pointerId);
            setHeld(true);
          }}
          onPointerUp={(e) => {
            const dx = e.clientX - pressPoint.current.x;
            const dy = e.clientY - pressPoint.current.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
              suppressClick.current = true;
              setHeld(false);
              if (dx < 0) next();
              else previous();
              return;
            }
            suppressClick.current =
              performance.now() - pressStart.current > 220;
            setHeld(false);
          }}
          onPointerCancel={() => {
            suppressClick.current = true;
            setHeld(false);
          }}
        >
          {sahne && (
            <img
              className="sh-story-viewer__ambient"
              src={imageUrl(story.imageUrl)}
              alt=""
              aria-hidden="true"
            />
          )}
          <img
            key={key}
            src={imageUrl(story.imageUrl)}
            alt={story.name}
            className="story-viewer__image"
            draggable={false}
            hidden={failed === key}
            onLoad={() => setLoaded(key)}
            onError={() => setFailed(key)}
          />
          {failed === key && (
            <p className="sh-story-viewer__error">
              Görsel yüklenemedi. Diğer hikâyeye geçebilirsin.
            </p>
          )}
          <div className="story-viewer__gradient" />
        </div>
        <button
          type="button"
          className="story-viewer__cta"
          onClick={goToProduct}
        >
          {sahne ? (
            <>
              <span>
                <small>MENÜDE KEŞFET</small>
                <strong>{story.productName || story.name}</strong>
              </span>
              <ArrowRight size={22} />
            </>
          ) : (
            <>
              <ChevronUp className="w-5 h-5 rotate-90 shrink-0" />
              <span>{story.productName || 'Ürüne git'}</span>
            </>
          )}
        </button>
        {sahne ? (
          <div className="sh-story-viewer__navigation">
            <button
              type="button"
              onClick={previous}
              disabled={index === 0}
              aria-label="Önceki hikâye"
            >
              <ArrowLeft size={20} />
            </button>
            <span>{paused ? 'Duraklatıldı' : 'Basılı tut · anı yakala'}</span>
            <button
              type="button"
              onClick={next}
              aria-label={
                index === stories.length - 1
                  ? 'Hikâyeleri kapat'
                  : 'Sonraki hikâye'
              }
            >
              <ArrowRight size={20} />
            </button>
          </div>
        ) : (
          <div className="story-viewer__hint">
            Sol/sağ: geç · Orta: ürüne git · Basılı tut: duraklat
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}
