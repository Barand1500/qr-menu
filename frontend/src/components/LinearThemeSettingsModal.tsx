import { useEffect, useState } from 'react';
import {
  Cake,
  Cherry,
  Coffee,
  Heart,
  Layers3,
  Leaf,
  Settings2,
  ShoppingBag,
  Sparkles,
  UserRound,
  Star,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui';
import {
  DEFAULT_LINEAR_CONFIG,
  LINEAR_FEATURE_ICONS,
  type LinearFeatureIcon,
  type LinearThemeConfig,
} from '@/lib/menuLinearConfig';

const ICON_MAP: Record<LinearFeatureIcon, LucideIcon> = {
  leaf: Leaf,
  heart: Heart,
  cake: Cake,
  strawberry: Cherry,
  sparkles: Sparkles,
  coffee: Coffee,
  star: Star,
  utensils: UtensilsCrossed,
};

const ICON_LABEL: Record<LinearFeatureIcon, string> = {
  leaf: 'Yaprak',
  heart: 'Kalp',
  cake: 'Tatlı',
  strawberry: 'Meyve',
  sparkles: 'Parıltı',
  coffee: 'Kahve',
  star: 'Yıldız',
  utensils: 'Servis',
};

export default function LinearThemeSettingsModal({
  open,
  initial,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: LinearThemeConfig;
  saving?: boolean;
  onClose: () => void;
  onSave: (config: LinearThemeConfig) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<LinearThemeConfig>(initial);

  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  if (!open) return null;

  function updateFeature(index: number, patch: Partial<LinearThemeConfig['features'][number]>) {
    setDraft((prev) => ({
      ...prev,
      features: prev.features.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    }));
  }

  return (
    <div className="linear-settings" role="dialog" aria-modal="true" aria-labelledby="linear-settings-title">
      <button type="button" className="linear-settings__scrim" aria-label="Kapat" onClick={onClose} />
      <div className="linear-settings__panel">
        <header className="linear-settings__head">
          <div>
            <p className="linear-settings__eyebrow">
              <Settings2 className="w-3.5 h-3.5" /> Linear
            </p>
            <h2 id="linear-settings-title">Tema ayarları</h2>
            <p>Varyant, sepet, profil, sol panel metni ve özellik satırlarını buradan düzenle.</p>
          </div>
          <button type="button" className="linear-settings__close" onClick={onClose} aria-label="Kapat">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="linear-settings__body">
          <div className="linear-settings__toggles">
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
              <span className={`addon-toggle__switch${draft.variantsEnabled ? ' is-on' : ''}`} aria-hidden>
                <span className="addon-toggle__knob" />
              </span>
            </button>
            <p className="linear-settings__hint">
              Kapalıysa ürün detayında boy / ekstra / istek seçenekleri gizlenir. Varsayılan:{' '}
              {DEFAULT_LINEAR_CONFIG.variantsEnabled ? 'açık' : 'kapalı'}.
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
            <p className="linear-settings__hint">
              Açıkken ürün detayında “Sepete ekle” ve menüde sepet ikonu çıkar. Varsayılan:{' '}
              {DEFAULT_LINEAR_CONFIG.cartEnabled ? 'açık' : 'kapalı'}.
            </p>

            <button
              type="button"
              className="addon-toggle"
              onClick={() => setDraft((d) => ({ ...d, userProfileEnabled: !d.userProfileEnabled }))}
              aria-pressed={draft.userProfileEnabled}
            >
              <span className="inline-flex items-center gap-2">
                <UserRound className="w-4 h-4 opacity-70" />
                {draft.userProfileEnabled ? 'Kullanıcı profili açık' : 'Kullanıcı profili kapalı'}
              </span>
              <span className={`addon-toggle__switch${draft.userProfileEnabled ? ' is-on' : ''}`} aria-hidden>
                <span className="addon-toggle__knob" />
              </span>
            </button>
            <p className="linear-settings__hint">
              Menü header’da giriş / profil. Kapalıyken görünmez. Varsayılan kapalı.
            </p>
          </div>

          <label className="linear-settings__field">
            <span>Başlık altı metin</span>
            <input
              value={draft.subhead}
              onChange={(e) => setDraft((d) => ({ ...d, subhead: e.target.value }))}
              maxLength={64}
              placeholder={DEFAULT_LINEAR_CONFIG.subhead}
            />
          </label>

          <div className="linear-settings__features">
            <p className="linear-settings__section-label">4 özellik satırı</p>
            {draft.features.map((f, i) => {
              const Icon = ICON_MAP[f.icon] || Leaf;
              return (
                <div key={i} className="linear-settings__row">
                  <div className="linear-settings__row-top">
                    <span className="linear-settings__index">{i + 1}</span>
                    <span className="linear-settings__preview-icon" aria-hidden>
                      <Icon className="w-4 h-4" strokeWidth={1.75} />
                    </span>
                    <select
                      value={f.icon}
                      onChange={(e) =>
                        updateFeature(i, { icon: e.target.value as LinearFeatureIcon })
                      }
                      aria-label={`Özellik ${i + 1} ikon`}
                    >
                      {LINEAR_FEATURE_ICONS.map((id) => (
                        <option key={id} value={id}>
                          {ICON_LABEL[id]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    value={f.text}
                    onChange={(e) => updateFeature(i, { text: e.target.value })}
                    maxLength={80}
                    placeholder={DEFAULT_LINEAR_CONFIG.features[i]?.text}
                    aria-label={`Özellik ${i + 1} metin`}
                  />
                </div>
              );
            })}
          </div>
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
