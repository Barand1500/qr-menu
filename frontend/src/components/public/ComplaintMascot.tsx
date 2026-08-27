import { useEffect, useState } from 'react';
import MenuMascot, { type MenuMascotMood } from '@/components/public/MenuMascot';

const SAD_LINES = [
  <>Bu konuda sizi üzdüysek <strong>çok özür dileriz</strong>…</>,
  <>Anlat bana, her kelimesini <strong>dinliyorum</strong>.</>,
  <>Canın sıkkın, anlıyorum… <strong>Buradayım</strong>, yalnız değilsin.</>,
  <>Bize yazman çok değerli. <strong>Seni dinlemeye hazırım</strong>.</>,
  <>Kötü hissettirdiysek üzgünüm… <strong>Hemen ilgileneceğiz</strong>.</>,
];

const HAPPY_LINES = [
  <>Tamamdır! <strong>Senin için bunu çözeceğim.</strong></>,
  <>Ekibimize ilettim — <strong>en kısa sürede dönüş yapacağız</strong>.</>,
  <>Merak etme, <strong>bu işi halledeceğiz!</strong> 💛</>,
  <>Mesajın bize ulaştı. <strong>Şimdi sıra bizde!</strong></>,
];

const SENDING_LINE = <>Bir saniye… <strong>mesajını güvenle iletiyorum</strong>.</>;

export function ComplaintMascotBubble({
  mood,
  lineIndex,
}: {
  mood: 'sad' | 'sending' | 'happy';
  lineIndex: number;
}) {
  const lines = mood === 'happy' ? HAPPY_LINES : mood === 'sending' ? [SENDING_LINE] : SAD_LINES;
  const line = lines[lineIndex % lines.length];

  return (
    <div key={`${mood}-${lineIndex}`} className={`complaint-bubble complaint-bubble--${mood}`}>
      {line}
    </div>
  );
}

export function useComplaintBubbleLines(mood: 'sad' | 'sending' | 'happy', active: boolean) {
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    if (!active || mood === 'sending') return;
    const ms = mood === 'happy' ? 3200 : 4200;
    const id = window.setInterval(() => setLineIndex((i) => i + 1), ms);
    return () => window.clearInterval(id);
  }, [mood, active]);

  useEffect(() => {
    setLineIndex(0);
  }, [mood]);

  return lineIndex;
}

function toMascotMood(mood: 'sad' | 'sending' | 'happy'): MenuMascotMood {
  if (mood === 'happy') return 'excited';
  if (mood === 'sending') return 'sending';
  return 'sad';
}

export default function ComplaintMascot({ mood }: { mood: 'sad' | 'sending' | 'happy' }) {
  return (
    <div
      className={`complaint-mascot ${
        mood === 'happy' ? 'complaint-mascot--happy' : 'complaint-mascot--sad'
      } ${mood === 'sending' ? 'complaint-mascot--sending' : ''}`}
      aria-hidden
    >
      <MenuMascot mood={toMascotMood(mood)} className="complaint-mascot__inner" />
    </div>
  );
}
