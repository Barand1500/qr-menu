import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, ChevronUp } from 'lucide-react';
import { imageUrl } from '@/lib/api';
import { menuProductPath } from '@/lib/menuPaths';
import { BrushCaption } from '@/components/public/BrushCaption';
import type { MenuStory } from './MobileStoriesStrip';

interface StoryViewerProps {
  stories: MenuStory[];
  initialIndex: number;
  onClose: () => void;
}

export default function StoryViewer({ stories, initialIndex, onClose }: StoryViewerProps) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const startRef = useRef(Date.now());
  const elapsedRef = useRef(0);
  const rafRef = useRef<number>(0);

  const story = stories[index];
  const durationMs = (story?.durationSeconds ?? 5) * 1000;

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i >= stories.length - 1) {
        onClose();
        return i;
      }
      return i + 1;
    });
    setProgress(0);
    elapsedRef.current = 0;
    startRef.current = Date.now();
  }, [stories.length, onClose]);

  const goPrev = useCallback(() => {
    setIndex((i) => {
      if (i <= 0) {
        setProgress(0);
        elapsedRef.current = 0;
        startRef.current = Date.now();
        return 0;
      }
      return i - 1;
    });
    setProgress(0);
    elapsedRef.current = 0;
    startRef.current = Date.now();
  }, []);

  const goToProduct = useCallback(() => {
    if (!story) return;
    onClose();
    navigate(menuProductPath(story.productId));
  }, [story, navigate, onClose]);

  useEffect(() => {
    setIndex(initialIndex);
    setProgress(0);
    elapsedRef.current = 0;
    startRef.current = Date.now();
  }, [initialIndex]);

  useEffect(() => {
    if (!story || paused) return;

    startRef.current = Date.now();

    function tick() {
      const elapsed = elapsedRef.current + (Date.now() - startRef.current);
      const p = Math.min(elapsed / durationMs, 1);
      setProgress(p);
      if (p >= 1) {
        goNext();
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [index, paused, durationMs, story, goNext]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goNext, goPrev]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  function handlePointerDown() {
    setPaused(true);
    elapsedRef.current += Date.now() - startRef.current;
  }

  function handlePointerUp() {
    setPaused(false);
    startRef.current = Date.now();
  }

  function handleTap(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    if (ratio < 0.28) goPrev();
    else if (ratio > 0.72) goNext();
    else goToProduct();
  }

  if (!story) return null;

  return createPortal(
    <div className="story-viewer" role="dialog" aria-modal="true">
      <div className="story-viewer__backdrop" onClick={onClose} />

      <div className="story-viewer__frame">
        <div className="story-viewer__progress-row">
          {stories.map((s, i) => (
            <div key={s.id} className="story-viewer__progress-track">
              <div
                className="story-viewer__progress-fill"
                style={{
                  width:
                    i < index ? '100%' : i === index ? `${progress * 100}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        <div className="story-viewer__header">
          <div className="story-viewer__meta">
            <img
              src={imageUrl(story.imageUrl)}
              alt=""
              className="story-viewer__meta-avatar"
            />
            <BrushCaption size="sm" className="story-viewer__meta-brush">
              {story.name}
            </BrushCaption>
          </div>
          <button type="button" className="story-viewer__close" onClick={onClose} aria-label="Kapat">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div
          className="story-viewer__content"
          onClick={handleTap}
          onMouseDown={handlePointerDown}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchEnd={handlePointerUp}
        >
          <img
            src={imageUrl(story.imageUrl)}
            alt={story.name}
            className="story-viewer__image"
            draggable={false}
          />
          <div className="story-viewer__gradient" />
        </div>

        <button type="button" className="story-viewer__cta" onClick={goToProduct}>
          <ChevronUp className="w-5 h-5 rotate-90 shrink-0" />
          <span>{story.productName || 'Ürüne git'}</span>
        </button>

        <div className="story-viewer__hint">
          Sol/sağ: geç · Orta: ürüne git · Basılı tut: duraklat
        </div>
      </div>
    </div>,
    document.body
  );
}
