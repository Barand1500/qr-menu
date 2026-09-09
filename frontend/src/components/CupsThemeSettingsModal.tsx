import { useEffect, useState } from 'react';
import { AudioLines, Gauge, Settings2, SkipForward, Shuffle, X } from 'lucide-react';
import { Button } from '@/components/ui';
import {
  type CupsShuffleSpeed,
  type WelcomeCupsConfig,
} from '@/lib/welcomeCupsConfig';
import '@/cups-welcome.css';

const SPEED_OPTIONS: { id: CupsShuffleSpeed; label: string; detail: string }[] = [
  { id: 'slow', label: 'Yavaş', detail: 'Rahat takip, kolay tur' },
  { id: 'normal', label: 'Normal', detail: 'Dengeli zorluk' },
  { id: 'fast', label: 'Hızlı', detail: 'Gözünü dört aç' },
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

export default function CupsThemeSettingsModal({
  open,
  initial,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: WelcomeCupsConfig;
  saving?: boolean;
  onClose: () => void;
  onSave: (config: WelcomeCupsConfig) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState(initial);

  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  if (!open) return null;

  return (
    <div className="linear-settings basket-settings cups-settings" role="dialog" aria-modal="true" aria-labelledby="cups-settings-title">
      <button type="button" className="linear-settings__scrim" aria-label="Kapat" onClick={onClose} />
      <div className="linear-settings__panel basket-settings__panel">
        <header className="linear-settings__head basket-settings__head">
          <div>
            <p className="linear-settings__eyebrow"><Settings2 className="w-3.5 h-3.5" /> Üç Bardak</p>
            <h2 id="cups-settings-title">Oyun ayarları</h2>
            <p>Karıştırma hızı, tur sayısı ve atla seçeneğini ayarla.</p>
          </div>
          <button type="button" className="linear-settings__close" onClick={onClose} aria-label="Kapat">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="linear-settings__body basket-settings__body">
          <section className="basket-settings__section">
            <div className="basket-settings__label"><Gauge className="w-4 h-4" /> Karıştırma hızı</div>
            <div className="basket-settings__ball-options">
              {SPEED_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={draft.shuffleSpeed === option.id ? 'is-active' : ''}
                  onClick={() => setDraft((d) => ({ ...d, shuffleSpeed: option.id }))}
                >
                  <strong>{option.label}</strong>
                  <span>{option.detail}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="basket-settings__section">
            <div className="basket-settings__label">
              <Shuffle className="w-4 h-4" /> Karıştırma sayısı · {draft.shuffleCount}
            </div>
            <input
              type="range"
              min="3"
              max="12"
              step="1"
              value={draft.shuffleCount}
              onChange={(e) => setDraft((d) => ({ ...d, shuffleCount: Number(e.target.value) }))}
            />
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
              <label className="basket-settings__label" htmlFor="cups-skip-delay">
                Atla butonu {draft.skipDelaySeconds === 0 ? 'hemen' : `${draft.skipDelaySeconds} saniye sonra`}
              </label>
              <input
                id="cups-skip-delay"
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
            icon={<AudioLines className="w-4 h-4" />}
            label="Oyun sesleri"
            hint="Düşme, karıştırma ve kilit açılma efektlerini açar."
            value={draft.soundEnabled}
            onToggle={() => setDraft((d) => ({ ...d, soundEnabled: !d.soundEnabled }))}
          />
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
