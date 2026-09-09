import { useEffect, useState } from 'react';
import { AudioLines, BadgeCheck, CircleGauge, Image, Settings2, SkipForward, X } from 'lucide-react';
import { Button } from '@/components/ui';
import {
  type BasketballBallStyle,
  type WelcomeBasketballConfig,
} from '@/lib/welcomeBasketballConfig';

const BALL_OPTIONS: { id: BasketballBallStyle; label: string; detail: string }[] = [
  { id: 'auto', label: 'Otomatik', detail: 'Logo varsa logo, yoksa basketbol topu' },
  { id: 'logo', label: 'Restoran logosu', detail: 'Logo yoksa basketbol topuna döner' },
  { id: 'basketball', label: 'Basketbol topu', detail: 'Her zaman klasik top görünümü' },
];

function ToggleRow({
  icon,
  label,
  hint,
  value,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" className="addon-toggle basket-settings__toggle" onClick={onToggle} aria-pressed={value}>
      <span className="basket-settings__toggle-copy">
        <span className="basket-settings__toggle-title">{icon}{label}</span>
        <small>{hint}</small>
      </span>
      <span className={`addon-toggle__switch${value ? ' is-on' : ''}`} aria-hidden>
        <span className="addon-toggle__knob" />
      </span>
    </button>
  );
}

export default function BasketballThemeSettingsModal({
  open,
  initial,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: WelcomeBasketballConfig;
  saving?: boolean;
  onClose: () => void;
  onSave: (config: WelcomeBasketballConfig) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState(initial);

  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  if (!open) return null;

  return (
    <div className="linear-settings basket-settings" role="dialog" aria-modal="true" aria-labelledby="basket-settings-title">
      <button type="button" className="linear-settings__scrim" aria-label="Kapat" onClick={onClose} />
      <div className="linear-settings__panel basket-settings__panel">
        <header className="linear-settings__head basket-settings__head">
          <div>
            <p className="linear-settings__eyebrow"><Settings2 className="w-3.5 h-3.5" /> Basketbol Menü</p>
            <h2 id="basket-settings-title">Oyun ayarları</h2>
            <p>Atış sayısını, zorluğu, topu ve oyunu atlama davranışını belirle.</p>
          </div>
          <button type="button" className="linear-settings__close" onClick={onClose} aria-label="Kapat">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="linear-settings__body basket-settings__body">
          <section className="basket-settings__section">
            <div className="basket-settings__label"><BadgeCheck className="w-4 h-4" /> Gerekli basket</div>
            <div className="basket-settings__segmented">
              {[1, 2, 3].map((count) => (
                <button
                  key={count}
                  type="button"
                  className={draft.requiredScores === count ? 'is-active' : ''}
                  onClick={() => setDraft((d) => ({ ...d, requiredScores: count }))}
                >
                  {count}
                </button>
              ))}
            </div>
          </section>

          <ToggleRow
            icon={<SkipForward className="w-4 h-4" />}
            label="Atla seçeneği"
            hint="Süre dolunca müşteri oyunu oynamadan menüye geçebilir."
            value={draft.skipEnabled}
            onToggle={() => setDraft((d) => ({ ...d, skipEnabled: !d.skipEnabled }))}
          />

          {draft.skipEnabled && (
            <section className="basket-settings__section">
              <label className="basket-settings__label" htmlFor="basket-skip-delay">
                Atla butonu {draft.skipDelaySeconds === 0 ? 'hemen' : `${draft.skipDelaySeconds} saniye sonra`}
              </label>
              <input
                id="basket-skip-delay"
                type="range"
                min="0"
                max="15"
                step="1"
                value={draft.skipDelaySeconds}
                onChange={(e) => setDraft((d) => ({ ...d, skipDelaySeconds: Number(e.target.value) }))}
              />
            </section>
          )}

          <ToggleRow
            icon={<CircleGauge className="w-4 h-4" />}
            label="Hareketli pota"
            hint="Pota yavaşça sağa-sola hareket eder; oyun zorlaşır."
            value={draft.movingHoop}
            onToggle={() => setDraft((d) => ({ ...d, movingHoop: !d.movingHoop }))}
          />

          <ToggleRow
            icon={<AudioLines className="w-4 h-4" />}
            label="Oyun sesleri"
            hint="Top, file ve başarı efektlerini açar."
            value={draft.soundEnabled}
            onToggle={() => setDraft((d) => ({ ...d, soundEnabled: !d.soundEnabled }))}
          />

          <section className="basket-settings__section">
            <div className="basket-settings__label"><Image className="w-4 h-4" /> Top görünümü</div>
            <div className="basket-settings__ball-options">
              {BALL_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={draft.ballStyle === option.id ? 'is-active' : ''}
                  onClick={() => setDraft((d) => ({ ...d, ballStyle: option.id }))}
                >
                  <strong>{option.label}</strong>
                  <span>{option.detail}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <footer className="linear-settings__foot">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Vazgeç</Button>
          <Button type="button" onClick={() => void onSave(draft)} disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </footer>
      </div>
    </div>
  );
}
