import { useEffect, useMemo, useState } from 'react';

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

export default function ComplaintMascot({ mood }: { mood: 'sad' | 'sending' | 'happy' }) {
  const cls = useMemo(
    () =>
      [
        'complaint-mascot',
        mood === 'happy' ? 'complaint-mascot--happy' : 'complaint-mascot--sad',
        mood === 'sending' ? 'complaint-mascot--sending' : '',
      ]
        .filter(Boolean)
        .join(' '),
    [mood]
  );

  const happy = mood === 'happy';

  return (
    <div className={cls} aria-hidden>
      <div className="complaint-mascot__shadow" />
      <svg viewBox="0 0 200 200" className="complaint-mascot__svg">
        <ellipse
          className="complaint-mascot__tail"
          cx="148"
          cy="138"
          rx="18"
          ry="28"
          fill="#e8a87c"
          transform="rotate(24 148 138)"
        />
        <ellipse cx="100" cy="138" rx="52" ry="44" fill="#f5cba7" />
        <ellipse cx="100" cy="145" rx="40" ry="30" fill="#ffe8d6" />
        <g className="complaint-mascot__ears">
          <ellipse cx="52" cy="58" rx="20" ry="28" fill="#e8a87c" transform="rotate(-22 52 58)" />
          <ellipse cx="148" cy="58" rx="20" ry="28" fill="#e8a87c" transform="rotate(22 148 58)" />
          <ellipse cx="54" cy="62" rx="11" ry="16" fill="#ffb4a2" transform="rotate(-22 54 62)" />
          <ellipse cx="146" cy="62" rx="11" ry="16" fill="#ffb4a2" transform="rotate(22 146 62)" />
        </g>
        <circle cx="100" cy="88" r="50" fill="#f5cba7" />
        <ellipse cx="100" cy="98" rx="34" ry="28" fill="#ffe8d6" />
        <g className="complaint-mascot__blink">
          {!happy ? (
            <>
              <ellipse cx="78" cy="82" rx="10" ry="12" fill="#fff" />
              <ellipse cx="122" cy="82" rx="10" ry="12" fill="#fff" />
              <circle cx="80" cy="84" r="4.5" fill="#3d2c21" />
              <circle cx="124" cy="84" r="4.5" fill="#3d2c21" />
              <circle cx="81.5" cy="82.5" r="1.5" fill="#fff" />
              <circle cx="125.5" cy="82.5" r="1.5" fill="#fff" />
            </>
          ) : (
            <>
              <path d="M70 82 Q78 74 86 82" fill="none" stroke="#3d2c21" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M114 82 Q122 74 130 82" fill="none" stroke="#3d2c21" strokeWidth="3.5" strokeLinecap="round" />
            </>
          )}
        </g>
        {!happy ? (
          <>
            <path d="M72 108 Q100 96 128 108" fill="none" stroke="#c97b63" strokeWidth="3.5" strokeLinecap="round" />
            <circle className="complaint-mascot__tear complaint-mascot__tear--l" cx="84" cy="94" r="3.5" fill="#7dd3fc" />
            <circle className="complaint-mascot__tear complaint-mascot__tear--r" cx="118" cy="94" r="3.5" fill="#7dd3fc" />
          </>
        ) : (
          <path d="M72 104 Q100 124 128 104" fill="none" stroke="#c97b63" strokeWidth="4" strokeLinecap="round" />
        )}
        <ellipse cx="66" cy="98" rx="10" ry="6" fill="#ffb4a2" opacity="0.55" />
        <ellipse cx="134" cy="98" rx="10" ry="6" fill="#ffb4a2" opacity="0.55" />
        <ellipse cx="100" cy="92" rx="6" ry="4" fill="#ffb4a2" opacity="0.65" />
        <g className="complaint-mascot__paw">
          <ellipse cx="44" cy="148" rx="14" ry="10" fill="#e8a87c" />
          <circle cx="38" cy="144" r="3" fill="#ffe8d6" />
          <circle cx="44" cy="142" r="3" fill="#ffe8d6" />
          <circle cx="50" cy="144" r="3" fill="#ffe8d6" />
        </g>
        {happy && (
          <>
            <text className="complaint-mascot__heart complaint-mascot__heart--1" x="28" y="48" fontSize="16">♥</text>
            <text className="complaint-mascot__heart complaint-mascot__heart--2" x="158" y="44" fontSize="13">♥</text>
            <text className="complaint-mascot__heart complaint-mascot__heart--3" x="148" y="156" fontSize="11">♥</text>
            <text className="complaint-mascot__spark" x="36" y="120" fontSize="14">✦</text>
            <text className="complaint-mascot__spark complaint-mascot__spark--2" x="162" y="108" fontSize="12">✦</text>
          </>
        )}
      </svg>
    </div>
  );
}
