import type { ReactNode } from 'react';

type BrushSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type BrushTone = 'dark' | 'warm' | 'accent';

interface BrushCaptionProps {
  children: ReactNode;
  className?: string;
  size?: BrushSize;
  tone?: BrushTone;
}

export function BrushCaption({
  children,
  className = '',
  size = 'md',
  tone = 'dark',
}: BrushCaptionProps) {
  return (
    <span
      className={`brush-caption brush-caption--${size} brush-caption--${tone} ${className}`.trim()}
    >
      <span className="brush-caption__text">{children}</span>
    </span>
  );
}

export function BrushCaptionBlock({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`brush-caption-block ${className}`.trim()}>{children}</div>;
}
