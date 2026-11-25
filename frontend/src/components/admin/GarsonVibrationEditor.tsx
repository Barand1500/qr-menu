import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CarFront, HandHelping, Play, ReceiptText, ShoppingBag, VibrateOff } from 'lucide-react';
import HookahIcon from '@/components/public/HookahIcon';
import {
  VIBRATION_IDS,
  VIBRATION_LABEL,
  VIBRATION_PATTERNS,
  VIBRATION_SERVICES,
  vibrate,
  type VibrationId,
  type VibrationMap,
  type VibrationService,
} from '@/lib/garsonVibration';

const ICONS: Record<VibrationService, typeof HandHelping> = {
  waiter: HandHelping,
  bill: ReceiptText,
  hookah: HookahIcon as unknown as typeof HandHelping,
  valet: CarFront,
  order: ShoppingBag,
};
// Garson panelindeki servis renkleriyle aynı
const COLORS: Record<VibrationService, string> = {
  waiter: '#f97316',
  bill: '#22c55e',
  hookah: '#a855f7',
  valet: '#3b82f6',
  order: '#eab308',
};
const SCALE = 11; // ms → px

/** Desenin küçük çizimi: dolu çubuk = titreme, boşluk = ara. Çalarken çubuklar sırayla yanar. */
function Pulse({ id, play }: { id: VibrationId; play: number }) {
  const pattern = VIBRATION_PATTERNS[id];
  if (!pattern.length) return <VibrateOff size={20} strokeWidth={1.6} aria-hidden="true" />;
  let at = 0;
  return (
    <span className="ast-vib-wave" key={play} aria-hidden="true">
      {pattern.map((ms, i) => {
        const start = at;
        at += ms;
        const w = Math.max(5, Math.round(ms / SCALE));
        return i % 2 === 0 ? (
          <i key={i} className={play ? 'is-play' : ''} style={{ width: w, ['--start' as string]: `${start}ms`, ['--dur' as string]: `${ms}ms` } as CSSProperties} />
        ) : (
          <b key={i} style={{ width: w }} />
        );
      })}
    </span>
  );
}

/**
 * Garson panelinde yeni çağrı gelince telefonun titreşimi: her servis için ayrı desen.
 * Desenler çizimle gösterilir; "Dene" hem bu cihazda titretir hem çizimi canlandırır.
 */
export default function GarsonVibrationEditor({
  value,
  onChange,
}: {
  value: VibrationMap;
  onChange: (next: VibrationMap) => void;
}) {
  const [playing, setPlaying] = useState<{ service: VibrationService; n: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function test(service: VibrationService, id: VibrationId = value[service]) {
    vibrate(id);
    const total = VIBRATION_PATTERNS[id].reduce((a, b) => a + b, 0);
    setPlaying({ service, n: Date.now() });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPlaying(null), total + 400);
  }

  return (
    <div className="ast-vib">
      <ul className="ast-vib-list">
        {VIBRATION_SERVICES.map(({ id, label }) => {
          const Icon = ICONS[id];
          const current = value[id];
          const isPlaying = playing?.service === id;
          return (
            <li key={id} className="ast-vib-row" style={{ ['--vc' as string]: COLORS[id] } as CSSProperties}>
              <div className="ast-vib-head">
                <span className="ast-vib-icon">
                  <Icon size={20} strokeWidth={1.8} />
                </span>
                <span className="ast-vib-name">
                  <strong>{label}</strong>
                  <small>{current === 'off' ? 'Titreşim yok' : `${VIBRATION_LABEL[current]} titreşim`}</small>
                </span>
                <button type="button" className={`ast-vib-try${isPlaying ? ' is-on' : ''}`} onClick={() => test(id)} aria-label={`${label} titreşimini dene`}>
                  <Play size={14} fill="currentColor" aria-hidden="true" /> Dene
                </button>
              </div>
              <div className="ast-vib-pick" role="radiogroup" aria-label={`${label} titreşimi`}>
                {VIBRATION_IDS.map((pattern) => (
                  <button
                    key={pattern}
                    type="button"
                    role="radio"
                    aria-checked={current === pattern}
                    className={current === pattern ? 'is-on' : ''}
                    onClick={() => onChange({ ...value, [id]: pattern })}
                  >
                    <span className="ast-vib-draw">
                      <Pulse id={pattern} play={isPlaying && current === pattern ? playing!.n : 0} />
                    </span>
                    <em>{VIBRATION_LABEL[pattern]}</em>
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="ast-vib-foot">
        Telefona bakmadan hangi servis olduğu anlaşılsın diye her servise ayrı desen verin. “Dene” bu cihazı titretir (telefonda); masaüstünde yalnızca çizim canlanır.
      </p>
    </div>
  );
}
