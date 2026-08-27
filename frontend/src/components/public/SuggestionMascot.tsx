import { useEffect, useState } from 'react';
import MenuMascot, { type MenuMascotMood } from '@/components/public/MenuMascot';

export type SuggestionMood = 'listen' | 'low' | 'mid' | 'high' | 'ecstatic' | 'sending' | 'done';

export const STAR_COLORS = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#38bdf8'];

const LISTEN_LINES = [
  <>Önerilerinizi <strong>can kulağıyla dinliyorum!</strong> ✨</>,
  <>Bana bir şey söyle… <strong>fikirlerin çok değerli!</strong></>,
  <>Deneyimini puanla, <strong>seni duyuyoruz!</strong></>,
  <>Harika fikirlerin mi var? <strong>Paylaş!</strong></>,
];

const LOW_LINES = [
  <>Anlıyorum… <strong>Daha iyi olmak için buradayız.</strong></>,
  <>Teşekkürler, <strong>gelişmemize yardım ediyorsun.</strong></>,
];

const MID_LINES = [
  <>Güzel! <strong>Devam edelim birlikte.</strong> 😊</>,
  <>Fena değil — <strong>daha da iyisini yapacağız!</strong></>,
];

const HIGH_LINES = [
  <>Harika! <strong>Mutlu oldum!</strong> 🎉</>,
  <>Süper puan! <strong>Ekibimiz de sevinecek.</strong></>,
];

const ECSTATIC_LINES = [
  <>Vay be! <strong>5 yıldız!</strong> Uçuyorum! 🚀</>,
  <>Muhteşemsin! <strong>Bayıldım!</strong> 💛</>,
];

const DONE_LINES = [
  <>Teşekkürler! <strong>Önerin kaydedildi.</strong></>,
  <>Harika! <strong>Ekibimize ilettik.</strong> Sen rocksın!</>,
];

const SENDING_LINE = <>Bir saniye… <strong>önerini yıldızlarla paketliyorum</strong> ⭐</>;

export function ratingToMood(rating: number, phase: 'form' | 'sending' | 'done'): SuggestionMood {
  if (phase === 'done') return 'done';
  if (phase === 'sending') return 'sending';
  if (rating === 0) return 'listen';
  if (rating <= 2) return 'low';
  if (rating === 3) return 'mid';
  if (rating === 4) return 'high';
  return 'ecstatic';
}

function linesForMood(mood: SuggestionMood) {
  switch (mood) {
    case 'done':
      return DONE_LINES;
    case 'sending':
      return [SENDING_LINE];
    case 'low':
      return LOW_LINES;
    case 'mid':
      return MID_LINES;
    case 'high':
      return HIGH_LINES;
    case 'ecstatic':
      return ECSTATIC_LINES;
    default:
      return LISTEN_LINES;
  }
}

function toMascotMood(mood: SuggestionMood): MenuMascotMood {
  if (mood === 'low') return 'sad';
  if (mood === 'high') return 'happy';
  if (mood === 'ecstatic' || mood === 'done') return 'excited';
  if (mood === 'sending') return 'sending';
  if (mood === 'mid') return 'happy';
  return 'neutral';
}

export function SuggestionMascotBubble({
  mood,
  lineIndex,
}: {
  mood: SuggestionMood;
  lineIndex: number;
}) {
  const lines = linesForMood(mood);
  const line = lines[lineIndex % lines.length];

  return (
    <div key={`${mood}-${lineIndex}`} className={`suggestion-bubble suggestion-bubble--${mood}`}>
      {line}
    </div>
  );
}

export function useSuggestionBubbleLines(mood: SuggestionMood, active: boolean) {
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    if (!active || mood === 'sending') return;
    const ms = mood === 'ecstatic' || mood === 'done' ? 2800 : 3800;
    const id = window.setInterval(() => setLineIndex((i) => i + 1), ms);
    return () => window.clearInterval(id);
  }, [mood, active]);

  useEffect(() => {
    setLineIndex(0);
  }, [mood]);

  return lineIndex;
}

export default function SuggestionMascot({ mood }: { mood: SuggestionMood }) {
  return (
    <div className={`suggestion-mascot suggestion-mascot--${mood}`} aria-hidden>
      <MenuMascot mood={toMascotMood(mood)} className="suggestion-mascot__inner" />
    </div>
  );
}
