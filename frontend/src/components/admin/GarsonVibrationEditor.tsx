import { CarFront, HandHelping, ReceiptText, ShoppingBag, Vibrate } from 'lucide-react';
import HookahIcon from '@/components/public/HookahIcon';
import {
  VIBRATION_IDS,
  VIBRATION_LABEL,
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

/** Garson panelinde yeni çağrı gelince telefonun titreşimi: her servis için ayrı desen. "Dene" bu cihazda titretir. */
export default function GarsonVibrationEditor({
  value,
  onChange,
}: {
  value: VibrationMap;
  onChange: (next: VibrationMap) => void;
}) {
  return (
    <div className="ast-vib">
      <p className="ast-vib-note">
        <Vibrate size={15} aria-hidden="true" /> Garson telefonu çağrıyı titreşimle de haber verir. Telefona bakmadan hangi servis olduğu anlaşılsın diye her servise ayrı desen verebilirsiniz.
      </p>
      <ul className="ast-vib-list">
        {VIBRATION_SERVICES.map(({ id, label }) => {
          const Icon = ICONS[id];
          return (
            <li key={id} className="ast-vib-row">
              <span className="ast-vib-name">
                <span className="ast-vib-icon">
                  <Icon size={18} strokeWidth={1.8} />
                </span>
                {label}
              </span>
              <div className="ast-vib-pick" role="radiogroup" aria-label={`${label} titreşimi`}>
                {VIBRATION_IDS.map((pattern: VibrationId) => (
                  <button
                    key={pattern}
                    type="button"
                    role="radio"
                    aria-checked={value[id] === pattern}
                    className={value[id] === pattern ? 'is-on' : ''}
                    onClick={() => {
                      onChange({ ...value, [id]: pattern });
                      vibrate(pattern); // seçince telefonda hemen hissedilir
                    }}
                  >
                    {VIBRATION_LABEL[pattern]}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <small className="ast-vib-foot">Seçince bu cihaz bir kez titreyerek örnek verir (masaüstünde titreşim olmaz).</small>
    </div>
  );
}
