import { useEffect, useState } from 'react';
import { Layers3, Settings2, ShoppingBag, X } from 'lucide-react';
import { Button } from '@/components/ui';
import {
  DEFAULT_ANIMASYON_CONFIG,
  type AnimasyonThemeConfig,
} from '@/lib/menuAnimasyonConfig';

export default function AnimasyonThemeSettingsModal({
  open,
  initial,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: AnimasyonThemeConfig;
  saving?: boolean;
  onClose: () => void;
  onSave: (config: AnimasyonThemeConfig) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<AnimasyonThemeConfig>(initial);

  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  if (!open) return null;

  return (
    <div
      className="linear-settings"
      role="dialog"
      aria-modal="true"
      aria-labelledby="animasyon-settings-title"
    >
      <button type="button" className="linear-settings__scrim" aria-label="Kapat" onClick={onClose} />
      <div className="linear-settings__panel">
        <header className="linear-settings__head linear-settings__head--animasyon">
          <div>
            <p className="linear-settings__eyebrow">
              <Settings2 className="w-3.5 h-3.5" /> Animasyonlu
            </p>
            <h2 id="animasyon-settings-title">Tema ayarları</h2>
            <p>Varyantları ve sepeti buradan açıp kapatabilirsin.</p>
          </div>
          <button type="button" className="linear-settings__close" onClick={onClose} aria-label="Kapat">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="linear-settings__body animasyon-settings__body">
          <button
            type="button"
            className="addon-toggle"
            onClick={() => setDraft((d) => ({ ...d, variantsEnabled: !d.variantsEnabled }))}
            aria-pressed={draft.variantsEnabled}
          >
            <span className="inline-flex items-center gap-2">
              <Layers3 className="w-4 h-4 opacity-70" />
              {draft.variantsEnabled ? 'Varyantlar açık' : 'Varyantlar kapalı'}
            </span>
            <span
              className={`addon-toggle__switch${draft.variantsEnabled ? ' is-on' : ''}`}
              aria-hidden
            >
              <span className="addon-toggle__knob" />
            </span>
          </button>
          <p className="animasyon-settings__hint">
            Kapalıysa ürün detayında boy / ekstra / istek seçenekleri gizlenir. Varsayılan:{' '}
            {DEFAULT_ANIMASYON_CONFIG.variantsEnabled ? 'açık' : 'kapalı'}.
          </p>

          <button
            type="button"
            className="addon-toggle"
            onClick={() => setDraft((d) => ({ ...d, cartEnabled: !d.cartEnabled }))}
            aria-pressed={draft.cartEnabled}
          >
            <span className="inline-flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 opacity-70" />
              {draft.cartEnabled ? 'Sepet açık' : 'Sepet kapalı'}
            </span>
            <span className={`addon-toggle__switch${draft.cartEnabled ? ' is-on' : ''}`} aria-hidden>
              <span className="addon-toggle__knob" />
            </span>
          </button>
          <p className="animasyon-settings__hint">
            Varsayılan: {DEFAULT_ANIMASYON_CONFIG.cartEnabled ? 'açık' : 'kapalı'}. Sepet kapalıysa
            ürünler yine kaydırılır; sepete ekleme ve sepet ikonu gizlenir.
          </p>
        </div>

        <footer className="linear-settings__foot">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Vazgeç
          </Button>
          <Button type="button" onClick={() => void onSave(draft)} disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </footer>
      </div>
    </div>
  );
}
