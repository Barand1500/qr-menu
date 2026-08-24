import { useEffect, useMemo, useState } from 'react';

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
  const cls = useMemo(
    () =>
      [
        'suggestion-mascot',
        `suggestion-mascot--${mood}`,
      ].join(' '),
    [mood]
  );

  const ecstatic = mood === 'ecstatic' || mood === 'done';
  const happy = mood === 'high' || ecstatic || mood === 'mid';
  const low = mood === 'low';

  return (
    <div className={cls} aria-hidden>
      <div className="suggestion-mascot__shadow" />
      <svg viewBox="0 0 200 200" className="suggestion-mascot__svg">
        <ellipse
          className="suggestion-mascot__tail"
          cx="148"
          cy="138"
          rx="18"
          ry="28"
          fill="#e8a87c"
          transform="rotate(24 148 138)"
        />
        <ellipse cx="100" cy="138" rx="52" ry="44" fill="#f5cba7" />
        <ellipse cx="100" cy="145" rx="40" ry="30" fill="#ffe8d6" />
        <g className="suggestion-mascot__ears">
          <ellipse cx="52" cy="58" rx="20" ry="28" fill="#e8a87c" transform="rotate(-22 52 58)" />
          <ellipse cx="148" cy="58" rx="20" ry="28" fill="#e8a87c" transform="rotate(22 148 58)" />
          <ellipse cx="54" cy="62" rx="11" ry="16" fill="#ffb4a2" transform="rotate(-22 54 62)" />
          <ellipse cx="146" cy="62" rx="11" ry="16" fill="#ffb4a2" transform="rotate(22 146 62)" />
        </g>
        <circle cx="100" cy="88" r="50" fill="#f5cba7" />
        <ellipse cx="100" cy="98" rx="34" ry="28" fill="#ffe8d6" />

        <g className="suggestion-mascot__blink">
          {low ? (
            <>
              <ellipse cx="78" cy="82" rx="10" ry="11" fill="#fff" />
              <ellipse cx="122" cy="82" rx="10" ry="11" fill="#fff" />
              <circle cx="80" cy="84" r="4" fill="#3d2c21" />
              <circle cx="124" cy="84" r="4" fill="#3d2c21" />
            </>
          ) : happy || ecstatic ? (
            <>
              <path d="M68 80 Q78 70 88 80" fill="none" stroke="#3d2c21" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M112 80 Q122 70 132 80" fill="none" stroke="#3d2c21" strokeWidth="3.5" strokeLinecap="round" />
            </>
          ) : (
            <>
              <ellipse cx="78" cy="82" rx="10" ry="12" fill="#fff" />
              <ellipse cx="122" cy="82" rx="10" ry="12" fill="#fff" />
              <circle cx="80" cy="84" r="4.5" fill="#3d2c21" />
              <circle cx="124" cy="84" r="4.5" fill="#3d2c21" />
              <circle cx="81.5" cy="82.5" r="1.5" fill="#fff" />
              <circle cx="125.5" cy="82.5" r="1.5" fill="#fff" />
            </>
          )}
        </g>

        {low ? (
          <path d="M74 108 Q100 100 126 108" fill="none" stroke="#c97b63" strokeWidth="3" strokeLinecap="round" />
        ) : happy || ecstatic ? (
          <path d="M68 102 Q100 128 132 102" fill="none" stroke="#c97b63" strokeWidth="4" strokeLinecap="round" />
        ) : (
          <path d="M72 106 Q100 114 128 106" fill="none" stroke="#c97b63" strokeWidth="3.5" strokeLinecap="round" />
        )}

        <ellipse cx="66" cy="98" rx="10" ry="6" fill="#ffb4a2" opacity="0.55" />
        <ellipse cx="134" cy="98" rx="10" ry="6" fill="#ffb4a2" opacity="0.55" />
        <ellipse cx="100" cy="92" rx="6" ry="4" fill="#ffb4a2" opacity="0.65" />

        <g className="suggestion-mascot__paw">
          <ellipse cx="44" cy="148" rx="14" ry="10" fill="#e8a87c" />
          <circle cx="38" cy="144" r="3" fill="#ffe8d6" />
          <circle cx="44" cy="142" r="3" fill="#ffe8d6" />
          <circle cx="50" cy="144" r="3" fill="#ffe8d6" />
        </g>

        {(happy || ecstatic) && (
          <>
            <text className="suggestion-mascot__heart suggestion-mascot__heart--1" x="24" y="44" fontSize="15">♥</text>
            <text className="suggestion-mascot__heart suggestion-mascot__heart--2" x="160" y="40" fontSize="12">♥</text>
            {ecstatic && (
              <>
                <text className="suggestion-mascot__spark" x="30" y="118" fontSize="14">✦</text>
                <text className="suggestion-mascot__spark suggestion-mascot__spark--2" x="168" y="112" fontSize="13">★</text>
                <text className="suggestion-mascot__spark suggestion-mascot__spark--3" x="148" y="158" fontSize="11">✦</text>
              </>
            )}
          </>
        )}
      </svg>
    </div>
  );
}
