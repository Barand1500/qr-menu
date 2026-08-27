import { useMemo } from 'react';

/** Ortak menü karakteri — öneri, şikayet ve asistan aynı yüzü kullanır */
export type MenuMascotMood =
  | 'neutral'
  | 'sad'
  | 'happy'
  | 'excited'
  | 'thinking'
  | 'sending';

interface MenuMascotProps {
  mood?: MenuMascotMood;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function MenuMascot({
  mood = 'neutral',
  className = '',
  size = 'md',
}: MenuMascotProps) {
  const cls = useMemo(
    () =>
      [
        'menu-mascot',
        `menu-mascot--${mood}`,
        `menu-mascot--${size}`,
        className,
      ]
        .filter(Boolean)
        .join(' '),
    [mood, size, className]
  );

  const sad = mood === 'sad';
  const happy = mood === 'happy' || mood === 'excited';
  const excited = mood === 'excited';
  const thinking = mood === 'thinking' || mood === 'sending';

  return (
    <div className={cls} aria-hidden>
      <div className="menu-mascot__shadow" />
      <svg viewBox="0 0 200 200" className="menu-mascot__svg">
        <ellipse
          className="menu-mascot__tail"
          cx="148"
          cy="138"
          rx="18"
          ry="28"
          fill="#e8a87c"
          transform="rotate(24 148 138)"
        />
        <ellipse cx="100" cy="138" rx="52" ry="44" fill="#f5cba7" />
        <ellipse cx="100" cy="145" rx="40" ry="30" fill="#ffe8d6" />
        <g className="menu-mascot__ears">
          <ellipse cx="52" cy="58" rx="20" ry="28" fill="#e8a87c" transform="rotate(-22 52 58)" />
          <ellipse cx="148" cy="58" rx="20" ry="28" fill="#e8a87c" transform="rotate(22 148 58)" />
          <ellipse cx="54" cy="62" rx="11" ry="16" fill="#ffb4a2" transform="rotate(-22 54 62)" />
          <ellipse cx="146" cy="62" rx="11" ry="16" fill="#ffb4a2" transform="rotate(22 146 62)" />
        </g>
        <circle cx="100" cy="88" r="50" fill="#f5cba7" />
        <ellipse cx="100" cy="98" rx="34" ry="28" fill="#ffe8d6" />

        <g className="menu-mascot__blink">
          {sad ? (
            <>
              <ellipse cx="78" cy="82" rx="10" ry="11" fill="#fff" />
              <ellipse cx="122" cy="82" rx="10" ry="11" fill="#fff" />
              <circle cx="80" cy="84" r="4" fill="#3d2c21" />
              <circle cx="124" cy="84" r="4" fill="#3d2c21" />
            </>
          ) : happy ? (
            <>
              <path
                d="M68 80 Q78 70 88 80"
                fill="none"
                stroke="#3d2c21"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <path
                d="M112 80 Q122 70 132 80"
                fill="none"
                stroke="#3d2c21"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            </>
          ) : thinking ? (
            <>
              <ellipse cx="78" cy="82" rx="10" ry="12" fill="#fff" />
              <ellipse cx="122" cy="82" rx="10" ry="12" fill="#fff" />
              <circle cx="82" cy="86" r="4.5" fill="#3d2c21" />
              <circle cx="126" cy="82" r="4.5" fill="#3d2c21" />
              <circle cx="83.5" cy="84.5" r="1.5" fill="#fff" />
              <circle cx="127.5" cy="80.5" r="1.5" fill="#fff" />
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

        {sad ? (
          <path
            d="M74 108 Q100 100 126 108"
            fill="none"
            stroke="#c97b63"
            strokeWidth="3"
            strokeLinecap="round"
          />
        ) : happy ? (
          <path
            d="M68 102 Q100 128 132 102"
            fill="none"
            stroke="#c97b63"
            strokeWidth="4"
            strokeLinecap="round"
          />
        ) : thinking ? (
          <path
            d="M78 108 Q100 112 122 104"
            fill="none"
            stroke="#c97b63"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        ) : (
          <path
            d="M72 106 Q100 114 128 106"
            fill="none"
            stroke="#c97b63"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        )}

        <ellipse cx="66" cy="98" rx="10" ry="6" fill="#ffb4a2" opacity="0.55" />
        <ellipse cx="134" cy="98" rx="10" ry="6" fill="#ffb4a2" opacity="0.55" />
        <ellipse cx="100" cy="92" rx="6" ry="4" fill="#ffb4a2" opacity="0.65" />

        {sad && (
          <>
            <circle className="menu-mascot__tear menu-mascot__tear--l" cx="84" cy="94" r="3.5" fill="#7dd3fc" />
            <circle className="menu-mascot__tear menu-mascot__tear--r" cx="118" cy="94" r="3.5" fill="#7dd3fc" />
          </>
        )}

        <g className="menu-mascot__paw">
          <ellipse cx="44" cy="148" rx="14" ry="10" fill="#e8a87c" />
          <circle cx="38" cy="144" r="3" fill="#ffe8d6" />
          <circle cx="44" cy="142" r="3" fill="#ffe8d6" />
          <circle cx="50" cy="144" r="3" fill="#ffe8d6" />
        </g>

        {happy && (
          <>
            <text className="menu-mascot__heart menu-mascot__heart--1" x="24" y="44" fontSize="15">
              ♥
            </text>
            <text className="menu-mascot__heart menu-mascot__heart--2" x="160" y="40" fontSize="12">
              ♥
            </text>
            {excited && (
              <>
                <text className="menu-mascot__spark" x="30" y="118" fontSize="14">
                  ✦
                </text>
                <text className="menu-mascot__spark menu-mascot__spark--2" x="168" y="112" fontSize="13">
                  ★
                </text>
                <text className="menu-mascot__spark menu-mascot__spark--3" x="148" y="158" fontSize="11">
                  ✦
                </text>
              </>
            )}
          </>
        )}
      </svg>
    </div>
  );
}
