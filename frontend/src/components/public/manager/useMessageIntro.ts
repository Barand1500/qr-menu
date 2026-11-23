import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

/** Visual-only introduction: never enters the draft or the submission payload. */
export function useMessageIntro(
  input: RefObject<HTMLTextAreaElement | null>,
  text: string,
) {
  const [preview, setPreview] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const stopped = useRef(false);
  const stop = useCallback(() => {
    stopped.current = true;
    window.clearTimeout(timer.current);
    setPreview((current) => current === null ? null : '');
    setPlaying(false);
  }, []);
  useEffect(() => {
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    stopped.current = false;
    const later = (fn: () => void, delay: number) => {
      timer.current = window.setTimeout(() => {
        if (!stopped.current) fn();
      }, delay);
    };
    let count = 0;
    const erase = () => {
      count -= 1;
      setPreview(text.slice(0, count));
      if (count > 0) later(erase, 22);
      else setPlaying(false);
    };
    const write = () => {
      count += 1;
      setPreview(text.slice(0, count));
      if (count < text.length) later(write, 38);
      else later(erase, 800);
    };
    later(() => {
      // Do not pull focus away from somebody already using another control.
      const active = document.activeElement;
      if (
        active &&
        active !== document.body &&
        active !== input.current &&
        !active.matches('.sh-interlude__body, [role="dialog"]')
      )
        return;
      input.current?.focus({ preventScroll: true });
      if (motion.matches) return;
      setPlaying(true);
      later(write, 180);
    }, 440);
    motion.addEventListener('change', stop);
    return () => {
      stopped.current = true;
      window.clearTimeout(timer.current);
      motion.removeEventListener('change', stop);
    };
  }, [input, text, stop]);
  return { preview, playing, started: preview !== null, stop };
}
