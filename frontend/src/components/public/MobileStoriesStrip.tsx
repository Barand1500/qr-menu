import { useCallback, useEffect, useState } from 'react';
import StoryViewer from './StoryViewer';
import { imageUrl } from '@/lib/api';
import { readSeenStories, storySeenKey } from '@/lib/storyHistory';
import './sahne/sahne-entertainment.css';

export interface MenuStory {
  id: number;
  name: string;
  imageUrl: string;
  productId: number;
  groupId: number;
  durationSeconds?: number;
  productName?: string | null;
}

interface MobileStoriesStripProps {
  stories: MenuStory[];
  sahne?: boolean;
  seenScope?: string;
}

export default function MobileStoriesStrip({
  stories,
  sahne = false,
  seenScope = 'menu',
}: MobileStoriesStripProps) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const storageKey = `menu-stories-seen:v1:${seenScope}`;
  const [seen, setSeen] = useState(() => readSeenStories(storageKey));
  useEffect(() => {
    setSeen(readSeenStories(storageKey));
    setViewerIndex(null);
  }, [storageKey]);
  const close = useCallback(() => setViewerIndex(null), []);
  const markSeen = useCallback(
    (story: MenuStory) => {
      setSeen((prev) => {
        const fingerprint = storySeenKey(story);
        if (prev.includes(fingerprint)) return prev;
        const next = [...prev, fingerprint]
          .filter((key) => stories.some((s) => storySeenKey(s) === key))
          .slice(-500);
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* Private browsing: keep the in-memory state. */
        }
        return next;
      });
    },
    [storageKey, stories],
  );

  if (stories.length === 0) return null;

  return (
    <>
      <div className={`public-stories md:hidden${sahne ? ' sh-stories' : ''}`}>
        <div className="public-stories__scroll">
          {stories.map((story, index) => (
            <button
              key={story.id}
              type="button"
              onClick={() => setViewerIndex(index)}
              className={`public-stories__item${seen.includes(storySeenKey(story)) ? ' is-viewed' : ''}`}
              aria-label={`${story.name}${seen.includes(storySeenKey(story)) ? ' · İzlendi' : ''}`}
            >
              <span className="public-stories__ring">
                <img
                  src={imageUrl(story.imageUrl)}
                  alt={story.name}
                  className="public-stories__avatar"
                  loading="lazy"
                />
              </span>
              <span className="public-stories__label">{story.name}</span>
            </button>
          ))}
        </div>
      </div>

      {viewerIndex !== null && (
        <StoryViewer
          stories={stories}
          initialIndex={viewerIndex}
          onClose={close}
          onViewed={markSeen}
          sahne={sahne}
        />
      )}
    </>
  );
}
