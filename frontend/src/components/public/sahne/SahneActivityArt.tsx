/** Small, code-native illustrations for the two public activity dialogs. */
export default function SahneActivityArt({ kind }: { kind: string }) {
  return (
    <svg
      className="sh-activity-art"
      viewBox="0 0 300 240"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <ellipse cx="150" cy="206" rx="112" ry="12" opacity=".14" />
      {kind === "memory" ? (
        <>
          <g transform="rotate(-15 120 120)" opacity=".35">
            <rect x="55" y="40" width="108" height="145" rx="12" />
            <rect x="64" y="49" width="90" height="127" rx="7" />
            <path d="m82 77 53 75m-53-50 53 50m-53-75 53 50" />
          </g>
          <g transform="rotate(12 180 120)">
            <rect
              x="131"
              y="44"
              width="108"
              height="145"
              rx="12"
              fill="#18130f"
            />
            <rect x="140" y="53" width="90" height="127" rx="7" opacity=".3" />
            <path
              d="M169 89v26m-7-26v15q0 11 7 11t7-11V89m-7 26v34m26-60q-13 20 0 30v30m0-60v30"
              strokeWidth="2.5"
            />
            <circle cx="150" cy="64" r="2" fill="currentColor" stroke="none" />
            <circle cx="220" cy="168" r="2" fill="currentColor" stroke="none" />
          </g>
        </>
      ) : kind === "xox" ? (
        <g transform="rotate(-8 150 115)">
          <path d="M116 42v146m68-146v146M48 90h204M48 141h204" opacity=".35" />
          <path
            d="m66 55 26 26m0-26L66 81m69 25 26 26m0-26-26 26m69 25 26 26m0-26-26 26"
            strokeWidth="4"
          />
          <circle cx="216" cy="65" r="15" />
          <circle cx="80" cy="116" r="15" />
          <circle cx="148" cy="167" r="15" />
          <path
            d="m57 43 188 143"
            strokeWidth="2"
            strokeDasharray="3 7"
            opacity=".55"
          />
        </g>
      ) : kind === "detective" ? (
        <>
          <path
            d="M63 180h115M70 172V62l10-10h92l10 10v53M88 77h65M88 92h48M88 108h31M88 143h27"
            opacity=".35"
          />
          <circle cx="183" cy="128" r="45" />
          <circle cx="183" cy="128" r="34" opacity=".25" />
          <path d="m215 161 32 33q7 9 14 2t-2-14l-32-33" />
          <path
            d="M176 115q2-10 11-8t8 11q-1 5-10 10v7m0 9v1"
            strokeWidth="2.5"
          />
        </>
      ) : kind === "blitz" ? (
        <>
          <path d="M63 47h103v148l-9-6-9 6-9-6-9 6-9-6-9 6-9-6-9 6-9-6-10 6-12-6V47Z" />
          <path
            d="M82 72h65M82 85h38M82 116h48M82 130h42M82 161h60"
            opacity=".35"
          />
          <circle cx="207" cy="123" r="43" fill="#18130f" />
          <path
            d="M207 80V67m-9 0h18m19 20 7-9m-35 20v27l17 10"
            strokeWidth="2.5"
          />
          <path d="M47 103H30m17 18H20m27 18H35" opacity=".5" />
        </>
      ) : kind === "valet" ? (
        <>
          <g transform="rotate(-9 150 115)">
            <rect x="47" y="62" width="206" height="113" rx="13" />
            <path d="M92 62v113" strokeDasharray="3 6" opacity=".4" />
            <circle cx="70" cy="86" r="5" />
            <path
              d="M64 124h13m-13 9h13m43-8v-17l11-24h70l12 24v17m-93-17h93m-85 17v9m77-9v9m-66-18h9m46 0h9M131 150h68"
              strokeWidth="2"
            />
          </g>
        </>
      ) : (
        <>
          <path
            d="M61 168h178m-158 0v-10q0-49 69-49t69 49v10M72 179h156M142 108v-9a8 8 0 0 1 16 0v9"
            strokeWidth="2"
          />
          <path
            d="M100 144q8-17 31-20M119 69l-8-15m39 9V43m30 26 9-15"
            opacity=".4"
          />
          <path d="M94 195h112" opacity=".25" />
        </>
      )}
    </svg>
  );
}
