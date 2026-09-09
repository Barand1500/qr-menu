import { useRef, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { isThemeFlipRunning, playThemeFlip } from '@/lib/themeTransition';

export default function ThemeToggleButton() {
  const { theme, setTheme } = useTheme();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy || isThemeFlipRunning()) return;
    const next = theme === 'light' ? 'dark' : 'light';
    const el = btnRef.current;
    if (!el) {
      setTheme(next);
      return;
    }

    setBusy(true);
    try {
      await playThemeFlip({
        from: theme,
        to: next,
        originEl: el,
        onCommit: () => setTheme(next),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={() => void handleClick()}
      disabled={busy}
      data-tour="header-theme"
      className="p-2 rounded-lg hover:bg-[var(--admin-accent-soft)] transition disabled:opacity-70"
      title={theme === 'light' ? 'Gece modu' : 'Gündüz modu'}
      aria-label={theme === 'light' ? 'Gece moduna geç' : 'Gündüz moduna geç'}
    >
      {theme === 'light' ? (
        <Moon className="w-[18px] h-[18px]" style={{ color: 'var(--admin-accent)' }} />
      ) : (
        <Sun className="w-[18px] h-[18px]" style={{ color: 'var(--admin-accent)' }} />
      )}
    </button>
  );
}
