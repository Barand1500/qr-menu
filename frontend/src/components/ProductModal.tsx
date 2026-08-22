import { useEffect, useRef, useState } from 'react';
import { X, ImagePlus, UtensilsCrossed } from 'lucide-react';
import { Button, Input, Select, Textarea } from '@/components/ui';
import LanguageTabs, { type Language } from '@/components/LanguageTabs';

export interface ProductTranslationFields {
  name: string;
  description: string;
  ingredients: string;
  allergens: string;
}

export interface ProductFormState {
  groupId: string;
  price: string;
  prepTimeMinutes: string;
  calories: string;
  isVegan: boolean;
  isVegetarian: boolean;
  isGlutenFree: boolean;
  isDiabetic: boolean;
  isRecommended: boolean;
  translations: Record<string, ProductTranslationFields>;
  isActive: boolean;
}

interface GroupOption {
  id: number;
  name: string;
  isSubGroup?: boolean;
  parentName?: string | null;
}

type ModalTab = 'general' | 'translations' | 'image';

const MODAL_TABS: { id: ModalTab; label: string }[] = [
  { id: 'general', label: 'Genel' },
  { id: 'translations', label: 'Çeviriler' },
  { id: 'image', label: 'Görsel' },
];

const FEATURES = [
  { key: 'isVegan' as const, label: 'Vegan' },
  { key: 'isVegetarian' as const, label: 'Vejeteryan' },
  { key: 'isGlutenFree' as const, label: 'Glutensiz' },
  { key: 'isDiabetic' as const, label: 'Diyabetik' },
];

interface ProductModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  languages: Language[];
  groups: GroupOption[];
  form: ProductFormState;
  imagePreview?: string | null;
  saving?: boolean;
  onClose: () => void;
  onSave: () => void;
  onFormChange: (form: ProductFormState) => void;
  onImageChange: (file: File | null) => void;
}

export default function ProductModal({
  open,
  mode,
  languages,
  groups,
  form,
  imagePreview,
  saving,
  onClose,
  onSave,
  onFormChange,
  onImageChange,
}: ProductModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const sortedLangs = [...languages].sort((a, b) =>
    a.code === 'tr' ? -1 : b.code === 'tr' ? 1 : 0
  );
  const [activeTab, setActiveTab] = useState<ModalTab>('general');
  const [activeLang, setActiveLang] = useState(sortedLangs[0]?.code || 'tr');

  useEffect(() => {
    if (!open) return;
    setActiveTab('general');
    const tr = languages.find((l) => l.code === 'tr');
    setActiveLang(tr?.code || languages[0]?.code || 'tr');
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, languages]);

  if (!open) return null;

  const currentLang = sortedLangs.find((l) => l.code === activeLang) || sortedLangs[0];
  const currentTranslation = form.translations[currentLang?.code || 'tr'] || {
    name: '',
    description: '',
    ingredients: '',
    allergens: '',
  };

  function updateTranslation(field: keyof ProductTranslationFields, value: string) {
    if (!currentLang) return;
    onFormChange({
      ...form,
      translations: {
        ...form.translations,
        [currentLang.code]: { ...currentTranslation, [field]: value },
      },
    });
  }

  function toggleFeature(key: keyof Pick<ProductFormState, 'isVegan' | 'isVegetarian' | 'isGlutenFree' | 'isDiabetic'>) {
    onFormChange({ ...form, [key]: !form[key] });
  }

  const groupOptions = groups.map((g) => ({
    value: g.id.toString(),
    label: g.isSubGroup && g.parentName ? `${g.parentName} › ${g.name}` : g.name,
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[6px]" />

      <div
        className="relative w-full sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col rounded-t-[28px] sm:rounded-[28px] shadow-2xl animate-slide-up"
        style={{
          background: 'var(--admin-card)',
          border: '1px solid var(--admin-card-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-3 shrink-0">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--admin-accent-soft)' }}
              >
                <UtensilsCrossed className="w-5 h-5" style={{ color: 'var(--admin-accent)' }} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-[var(--admin-text)]">
                  {mode === 'edit' ? 'Ürün Düzenle' : 'Ürün Oluştur'}
                </h2>
                <p className="text-sm admin-text-muted mt-0.5">
                  Bilgileri sekmeler arasında düzenleyin
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

          <div
            className="flex gap-1 p-1 rounded-xl"
            style={{ background: 'var(--admin-input-bg)' }}
          >
            {MODAL_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: activeTab === tab.id ? 'var(--admin-accent)' : 'transparent',
                  color:
                    activeTab === tab.id
                      ? 'var(--admin-btn-primary-text)'
                      : 'var(--admin-text-muted)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto admin-scroll px-6 pb-6">
          {activeTab === 'general' && (
            <div className="space-y-4 float-field-stack pt-2">
              <Select
                label="Grubu"
                value={form.groupId}
                options={groupOptions}
                onChange={(e) => onFormChange({ ...form, groupId: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  label="Fiyat (₺)"
                  value={form.price}
                  onChange={(e) => onFormChange({ ...form, price: e.target.value })}
                />
                <Input
                  type="number"
                  min="0"
                  label="Hazırlanma (dk.)"
                  value={form.prepTimeMinutes}
                  onChange={(e) => onFormChange({ ...form, prepTimeMinutes: e.target.value })}
                />
              </div>
              <Input
                type="number"
                min="0"
                label="Kalori (cal.)"
                value={form.calories}
                onChange={(e) => onFormChange({ ...form, calories: e.target.value })}
              />

              <div
                className="rounded-2xl p-4 space-y-3"
                style={{ background: 'var(--admin-input-bg)' }}
              >
                <p className="text-xs font-bold uppercase tracking-wide admin-text-muted">
                  Özellikler
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {FEATURES.map((f) => (
                    <label
                      key={f.key}
                      className="flex items-center gap-2 cursor-pointer text-sm text-[var(--admin-text)]"
                    >
                      <input
                        type="checkbox"
                        checked={form[f.key]}
                        onChange={() => toggleFeature(f.key)}
                        className="w-4 h-4 rounded accent-[var(--admin-accent)]"
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer text-sm text-[var(--admin-text)]">
                  <input
                    type="checkbox"
                    checked={form.isRecommended}
                    onChange={(e) => onFormChange({ ...form, isRecommended: e.target.checked })}
                    className="w-4 h-4 rounded accent-[var(--admin-accent)]"
                  />
                  Önerilen ürün
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer text-sm text-[var(--admin-text)]">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => onFormChange({ ...form, isActive: e.target.checked })}
                    className="w-4 h-4 rounded accent-[var(--admin-accent)]"
                  />
                  Menüde aktif
                </label>
              </div>
            </div>
          )}

          {activeTab === 'translations' && (
            <div className="space-y-4 pt-2">
              <LanguageTabs
                languages={sortedLangs}
                activeCode={activeLang}
                onChange={setActiveLang}
                variant="underline"
              />
              {currentLang && (
                <div className="space-y-4 float-field-stack">
                  <Input
                    key={`name-${currentLang.code}`}
                    label="Ürün adı"
                    value={currentTranslation.name}
                    onChange={(e) => updateTranslation('name', e.target.value)}
                  />
                  <Textarea
                    key={`desc-${currentLang.code}`}
                    label="Açıklama"
                    rows={2}
                    value={currentTranslation.description}
                    onChange={(e) => updateTranslation('description', e.target.value)}
                  />
                  <Textarea
                    key={`ing-${currentLang.code}`}
                    label="İçindekiler"
                    rows={2}
                    value={currentTranslation.ingredients}
                    onChange={(e) => updateTranslation('ingredients', e.target.value)}
                  />
                  <Textarea
                    key={`all-${currentLang.code}`}
                    label="Alerjenler"
                    rows={2}
                    value={currentTranslation.allergens}
                    onChange={(e) => updateTranslation('allergens', e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'image' && (
            <div className="pt-2">
              <div
                className="rounded-2xl border-2 border-dashed p-8 text-center transition hover:border-[var(--admin-accent)] cursor-pointer"
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
                    className="w-40 h-40 mx-auto rounded-2xl object-cover mb-3"
                  />
                ) : (
                  <ImagePlus
                    className="w-10 h-10 mx-auto mb-3"
                    style={{ color: 'var(--admin-accent)' }}
                  />
                )}
                <p className="text-sm font-medium text-[var(--admin-text)]">
                  Görsel yüklemek için tıklayın
                </p>
                <p className="text-xs admin-text-subtle mt-1">600 × 600 · PNG, JPG — 5 MB</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-5">
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
