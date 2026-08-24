import { useState } from 'react';
import StoryViewer from './StoryViewer';
import { imageUrl } from '@/lib/api';

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
}

export default function MobileStoriesStrip({ stories }: MobileStoriesStripProps) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (stories.length === 0) return null;

  return (
    <>
      <div className="public-stories md:hidden">
        <div className="public-stories__scroll">
          {stories.map((story, index) => (
            <button
              key={story.id}
              type="button"
              onClick={() => setViewerIndex(index)}
              className="public-stories__item"
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
          onClose={() => setViewerIndex(null)}
        />
      )}
    </>
  );
}
