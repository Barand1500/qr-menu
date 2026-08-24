import { useEffect, useRef, useState } from 'react';
import { X, ImagePlus, LayoutPanelTop } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import LanguageTabs, { type Language } from '@/components/LanguageTabs';
import { TranslatableInput } from '@/components/TranslatableField';

export interface ShowcaseTranslationFields {
  title1: string;
  title2: string;
}

export interface ShowcaseFormState {
  name: string;
  productId: string;
  isActive: boolean;
  translations: Record<string, ShowcaseTranslationFields>;
}

interface ProductOption {
  id: number;
  name: string;
}

interface ShowcaseModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  languages: Language[];
  products: ProductOption[];
  form: ShowcaseFormState;
  imagePreview?: string | null;
  saving?: boolean;
  onClose: () => void;
  onSave: () => void;
  onFormChange: (form: ShowcaseFormState) => void;
  onImageChange: (file: File | null) => void;
}

export default function ShowcaseModal({
  open,
  mode,
  languages,
  products,
  form,
  imagePreview,
  saving,
  onClose,
  onSave,
  onFormChange,
  onImageChange,
}: ShowcaseModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const sortedLangs = [...languages].sort((a, b) =>
    a.code === 'tr' ? -1 : b.code === 'tr' ? 1 : 0
  );
  const [activeLang, setActiveLang] = useState(sortedLangs[0]?.code || 'tr');

  useEffect(() => {
    if (!open) return;
    const tr = languages.find((l) => l.code === 'tr');
    setActiveLang(tr?.code || languages[0]?.code || 'tr');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const currentLang = sortedLangs.find((l) => l.code === activeLang) || sortedLangs[0];
  const currentTranslation = form.translations[currentLang?.code || 'tr'] || {
    title1: '',
    title2: '',
  };
  const trTranslation = form.translations.tr || { title1: '', title2: '' };

  function updateTranslation(field: keyof ShowcaseTranslationFields, value: string) {
    if (!currentLang) return;
    onFormChange({
      ...form,
      translations: {
        ...form.translations,
        [currentLang.code]: { ...currentTranslation, [field]: value },
      },
    });
  }

  const productOptions = products.map((p) => ({
    value: p.id.toString(),
    label: p.name,
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[6px]" />

      <div
        className="relative w-full sm:max-w-xl max-h-[90vh] overflow-y-auto admin-scroll rounded-t-[28px] sm:rounded-[28px] shadow-2xl animate-slide-up"
        style={{
          background: 'var(--admin-card)',
          border: '1px solid var(--admin-card-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--admin-accent-soft)' }}
              >
                <LayoutPanelTop className="w-5 h-5" style={{ color: 'var(--admin-accent)' }} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-[var(--admin-text)]">
                  {mode === 'edit' ? 'Vitrin Görseli Düzenle' : 'Vitrin Görseli Oluştur'}
                </h2>
                <p className="text-sm admin-text-muted mt-0.5">
                  Müşteri menüsünde üst banner alanı
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-[var(--admin-accent-soft)] admin-text-muted transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-5">
          <section
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid var(--admin-card-border)' }}
          >
            <div
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider admin-text-muted"
              style={{ background: 'var(--admin-input-bg)' }}
            >
              Vitrin Görseli Bilgileri
            </div>
            <div className="p-4 space-y-4 float-field-stack">
              <Input
                label="Adı (panel)"
                value={form.name}
                onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              />
              <Select
                label="İlgili ürün"
                value={form.productId}
                options={productOptions}
                onChange={(e) => onFormChange({ ...form, productId: e.target.value })}
              />
              <div
                className="rounded-2xl border-2 border-dashed p-5 transition hover:border-[var(--admin-accent)] cursor-pointer"
                style={{ borderColor: 'var(--admin-card-border)' }}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onImageChange(e.target.files?.[0] || null)}
                />
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt=""
                    className="w-full max-h-36 mx-auto rounded-xl object-cover mb-2"
                  />
                ) : (
                  <ImagePlus
                    className="w-8 h-8 mx-auto mb-2"
                    style={{ color: 'var(--admin-accent)' }}
                  />
                )}
                <p className="text-sm font-medium text-center text-[var(--admin-text)]">
                  Resim seçmek için tıklayın
                </p>
                <p className="text-xs admin-text-subtle text-center mt-1">1920 × 600 önerilir</p>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer text-sm text-[var(--admin-text)]">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => onFormChange({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--admin-accent)]"
                />
                Aktif
              </label>
            </div>
          </section>

          <section
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid var(--admin-card-border)' }}
          >
            <div
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider admin-text-muted"
              style={{ background: 'var(--admin-input-bg)' }}
            >
              Çeviriler
            </div>
            <div className="p-4 space-y-4">
              <LanguageTabs
                languages={sortedLangs}
                activeCode={activeLang}
                onChange={setActiveLang}
                variant="underline"
              />
              {currentLang && (
                <div className="space-y-4 float-field-stack pt-1">
                  <TranslatableInput
                    key={`t1-${currentLang.code}`}
                    label="Başlık (1)"
                    sourceText={trTranslation.title1}
                    targetLang={currentLang.code}
                    value={currentTranslation.title1}
                    onChange={(val) => updateTranslation('title1', val)}
                  />
                  <TranslatableInput
                    key={`t2-${currentLang.code}`}
                    label="Başlık (2)"
                    sourceText={trTranslation.title2}
                    targetLang={currentLang.code}
                    value={currentTranslation.title2}
                    onChange={(val) => updateTranslation('title2', val)}
                  />
                </div>
              )}
            </div>
          </section>

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
              İptal
            </Button>
            <Button className="flex-1" onClick={onSave} disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
