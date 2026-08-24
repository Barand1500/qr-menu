import type { ReactNode } from 'react';

type PanelTone = 'light' | 'warm' | 'warn' | 'accent';

interface BrushPanelProps {
  children: ReactNode;
  className?: string;
  tone?: PanelTone;
}

export default function BrushPanel({ children, className = '', tone = 'light' }: BrushPanelProps) {
  return (
    <div className={`brush-panel brush-panel--${tone} ${className}`.trim()}>
      <div className="brush-panel__inner">{children}</div>
    </div>
  );
}
