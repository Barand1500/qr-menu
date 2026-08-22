import { type ReactNode, useEffect } from 'react';
import { X, Minus } from 'lucide-react';

interface BottomSheetProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onMinimize?: () => void;
  minimized?: boolean;
  tabs?: { id: string; label: string }[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  children: ReactNode;
}

export default function BottomSheet({
  open,
  title,
  subtitle,
  onClose,
  onMinimize,
  minimized = false,
  tabs,
  activeTab,
  onTabChange,
  children,
}: BottomSheetProps) {
  useEffect(() => {
    if (open && !minimized) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open, minimized]);

  if (!open) return null;

  if (minimized) {
    return (
      <div
        className="fixed bottom-0 inset-x-0 z-[200] px-4 pb-4 pointer-events-none"
      >
        <button
          onClick={onMinimize}
          className="pointer-events-auto mx-auto flex items-center gap-3 px-6 py-3 rounded-full shadow-lg text-sm font-semibold transition hover:scale-[1.02]"
          style={{
            background: 'var(--admin-accent)',
            color: '#fff',
          }}
        >
          <Minus className="w-4 h-4" />
          {title} — Genişlet
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[199] bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 inset-x-0 z-[200] flex flex-col animate-slide-up"
        style={{
          maxHeight: 'min(72vh, 680px)',
          background: 'var(--admin-card)',
          borderTop: '1px solid var(--admin-card-border)',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: 'var(--admin-text-subtle)' }}
          />
        </div>

        {/* Header */}
        <div className="px-5 sm:px-6 pb-3 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[var(--admin-text)]">{title}</h2>
              {subtitle && (
                <p className="text-xs admin-text-muted mt-0.5">{subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {onMinimize && (
                <button
                  onClick={onMinimize}
                  className="p-2 rounded-xl hover:bg-[var(--admin-accent-soft)] transition"
                  title="Küçült"
                >
                  <Minus className="w-4 h-4 admin-text-muted" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-[var(--admin-accent-soft)] transition"
                title="Kapat"
              >
                <X className="w-4 h-4 admin-text-muted" />
              </button>
            </div>
          </div>

          {tabs && tabs.length > 0 && (
            <div className="flex gap-2 mt-4 overflow-x-auto pb-1 admin-scroll">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange?.(tab.id)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition shrink-0 ${
                    activeTab === tab.id ? 'shadow-sm' : ''
                  }`}
                  style={
                    activeTab === tab.id
                      ? {
                          background: 'var(--admin-accent)',
                          color: '#ffffff',
                        }
                      : {
                          background: 'var(--admin-input-bg)',
                          color: 'var(--admin-text-muted)',
                        }
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto admin-scroll px-5 sm:px-6 pb-6">
          {children}
        </div>
      </div>
    </>
  );
}
