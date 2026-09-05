import { useEffect, useRef, useState } from 'react';
import { X, ImagePlus, UtensilsCrossed, Plus, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { imageUrl } from '@/lib/api';
import { Button, Input, Select } from '@/components/ui';
import LanguageTabs, { type Language } from '@/components/LanguageTabs';
import { TranslatableInput, TranslatableTextarea } from '@/components/TranslatableField';
import {
  catalogToOptions,
  dietIdsFromProduct,
  flagsFromDietSelection,
  type PrefCatalog,
} from '@/lib/prefCatalog';
import { ManageableTagPillGroup } from '@/components/CatalogTagManager';

export interface ProductTranslationFields {
  name: string;
  description: string;
  ingredients: string;
  allergens: string;
}

export interface ProductFormState {
  groupId: string;
  price: string;
  currencyId: string;
  prepTimeMinutes: string;
  calories: string;
  features: string[];
  allergenTags: string[];
  dietTags: string[];
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

type ModalTab = 'general' | 'diet' | 'translations' | 'image';

const MODAL_TABS: { id: ModalTab; label: string }[] = [
  { id: 'general', label: 'Genel' },
  { id: 'diet', label: 'Alerjen' },
  { id: 'translations', label: 'Çeviriler' },
  { id: 'image', label: 'Görseller' },
];

function ProductFeaturesEditor({
  features,
  onChange,
}: {
  features: string[];
  onChange: (features: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  function addFeature() {
    const name = newName.trim();
    if (!name) return;
    onChange([...features, name]);
    setNewName('');
    setAdding(false);
  }

  function removeFeature(index: number) {
    onChange(features.filter((_, i) => i !== index));
  }

  function startEdit(index: number) {
    setEditingIdx(index);
    setEditValue(features[index]);
  }

  function saveEdit(index: number) {
    const name = editValue.trim();
    if (!name) return;
    onChange(features.map((f, i) => (i === index ? name : f)));
    setEditingIdx(null);
    setEditValue('');
  }

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{ background: 'var(--admin-input-bg)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide admin-text-muted">Özellikler</p>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition hover:opacity-90"
          style={{ background: 'var(--admin-accent)', color: 'var(--admin-btn-primary-text)' }}
          title="Özellik ekle"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {features.length === 0 && !adding && (
        <p className="text-sm admin-text-muted">Henüz özellik eklenmedi</p>
      )}

      <div className="flex flex-wrap gap-2">
        {features.map((feature, index) =>
          editingIdx === index ? (
            <div key={index} className="flex items-center gap-1.5 w-full sm:w-auto">
              <Input
                label="Özellik adı"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 min-w-[140px]"
              />
              <Button size="sm" type="button" onClick={() => saveEdit(index)}>
                OK
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setEditingIdx(null)}>
                ×
              </Button>
            </div>
          ) : (
            <span
              key={index}
              className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl text-sm font-medium"
              style={{
                background: 'var(--admin-card)',
                border: '1px solid var(--admin-card-border)',
                color: 'var(--admin-text)',
              }}
            >
              {feature}
              <button
                type="button"
                onClick={() => startEdit(index)}
                className="p-1 rounded-lg hover:bg-[var(--admin-accent-soft)]"
                style={{ color: 'var(--admin-accent)' }}
                title="Düzenle"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeFeature(index)}
                className="p-1 rounded-lg hover:bg-red-500/10 text-red-500"
                title="Sil"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </span>
          )
        )}
      </div>

      {adding && (
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Input
            label="Yeni özellik"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && addFeature()}
          />
          <div className="flex gap-2 shrink-0">
            <Button size="sm" type="button" onClick={addFeature}>
              Ekle
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => {
                setAdding(false);
                setNewName('');
              }}
            >
              İptal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ProductModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  languages: Language[];
  currencies: { id: number; code: string; name: string; symbol: string; isActive: boolean }[];
  groups: GroupOption[];
  prefCatalog: PrefCatalog;
  onPrefCatalogChange: (catalog: PrefCatalog) => void;
  form: ProductFormState;
  productImages: string[];
  pendingPreviews: { id: string; url: string }[];
  saving?: boolean;
  onClose: () => void;
  onSave: () => void;
  onFormChange: (form: ProductFormState) => void;
  onAddImages: (files: FileList | null) => void;
  onRemoveImage: (url: string) => void;
  onRemovePending: (id: string) => void;
  onMoveImage: (url: string, direction: -1 | 1) => void;
}

export default function ProductModal({
  open,
  mode,
  languages,
  currencies,
  groups,
  prefCatalog,
  onPrefCatalogChange,
  form,
  productImages,
  pendingPreviews,
  saving,
  onClose,
  onSave,
  onFormChange,
  onAddImages,
  onRemoveImage,
  onRemovePending,
  onMoveImage,
}: ProductModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const sortedLangs = [...languages].sort((a, b) =>
    a.code === 'tr' ? -1 : b.code === 'tr' ? 1 : 0
  );
  const [activeTab, setActiveTab] = useState<ModalTab>('general');
  const [activeLang, setActiveLang] = useState(sortedLangs[0]?.code || 'tr');
  const [emptyDietWarned, setEmptyDietWarned] = useState(false);
  const [dietTabPulse, setDietTabPulse] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActiveTab('general');
    setEmptyDietWarned(false);
    setDietTabPulse(false);
    const tr = languages.find((l) => l.code === 'tr');
    setActiveLang(tr?.code || languages[0]?.code || 'tr');
    // Yalnızca modal açıldığında sıfırla — onClose/languages her render'da değişebilir
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

  function hasAnyDietSelection() {
    return (
      form.allergenTags.length > 0 ||
      form.dietTags.length > 0 ||
      form.isVegan ||
      form.isVegetarian ||
      form.isGlutenFree ||
      form.isDiabetic
    );
  }

  function handleSaveClick() {
    if (!hasAnyDietSelection() && !emptyDietWarned) {
      setActiveTab('diet');
      setDietTabPulse(true);
      window.setTimeout(() => setDietTabPulse(false), 2000);
      setEmptyDietWarned(true);
      const ok = window.confirm(
        'Emin misiniz? Hiçbir alerjen veya diyet tercihi seçmediniz.\n\nBu ürün menü filtrelerinde eşleşmez. Yine de kaydedilsin mi?'
      );
      if (!ok) return;
    }
    onSave();
  }

  if (!open) return null;

  const currentLang = sortedLangs.find((l) => l.code === activeLang) || sortedLangs[0];
  const currentTranslation = form.translations[currentLang?.code || 'tr'] || {
    name: '',
    description: '',
    ingredients: '',
    allergens: '',
  };
  const trTranslation = form.translations.tr || {
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

  const groupOptions = groups.map((g) => ({
    value: g.id.toString(),
    label: g.isSubGroup && g.parentName ? `${g.parentName} › ${g.name}` : g.name,
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
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
                className={`flex-1 py-2 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all${
                  tab.id === 'diet' && dietTabPulse ? ' product-modal-tab--pulse' : ''
                }`}
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
                  label="Fiyat"
                  value={form.price}
                  onChange={(e) => onFormChange({ ...form, price: e.target.value })}
                />
                <Select
                  label="Para birimi"
                  value={form.currencyId}
                  options={currencies
                    .filter((c) => c.isActive || c.id.toString() === form.currencyId)
                    .map((c) => ({
                      value: c.id.toString(),
                      label: `${c.symbol} ${c.code} — ${c.name}`,
                    }))}
                  onChange={(e) => onFormChange({ ...form, currencyId: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  min="0"
                  label="Hazırlanma (dk.)"
                  value={form.prepTimeMinutes}
                  onChange={(e) => onFormChange({ ...form, prepTimeMinutes: e.target.value })}
                />
                <Input
                  type="number"
                  min="0"
                  label="Kalori (cal.)"
                  value={form.calories}
                  onChange={(e) => onFormChange({ ...form, calories: e.target.value })}
                />
              </div>

              <ProductFeaturesEditor
                features={form.features}
                onChange={(features) => onFormChange({ ...form, features })}
              />

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

          {activeTab === 'diet' && (
            <div className="space-y-5 pt-2">
              <p
                className="text-xs admin-text-muted rounded-xl px-3 py-2.5 leading-relaxed"
                style={{ background: 'var(--admin-input-bg)' }}
              >
                Burada seçtiğiniz pill’ler menü filtreleriyle birebir bağlanır. Yeni eklediğiniz
                seçenekler Dil Ayarları’ndaki aktif dillere otomatik çevrilir — çeviri sekmesinde
                ayrıca yazmanız gerekmez.
              </p>

              <ManageableTagPillGroup
                title="Alerjenler"
                hint="Üründe bulunan maddeleri seçin — yeni eklerken Dil Ayarları dillerine otomatik çevrilir"
                kind="allergen"
                options={catalogToOptions(prefCatalog, 'allergen')}
                selected={form.allergenTags}
                onChange={(allergenTags) => onFormChange({ ...form, allergenTags })}
                catalog={prefCatalog}
                onCatalogChange={onPrefCatalogChange}
                languageCodes={languages.map((l) => l.code)}
              />

              <ManageableTagPillGroup
                title="Diyet / yaşam tarzı"
                hint="Ürün bu tercihlere uygunsa işaretleyin — yeni eklerken Dil Ayarları dillerine otomatik çevrilir"
                kind="diet"
                options={catalogToOptions(prefCatalog, 'diet')}
                selected={dietIdsFromProduct(form, form.dietTags)}
                onChange={(ids) => {
                  const flags = flagsFromDietSelection(ids);
                  onFormChange({
                    ...form,
                    isVegan: flags.isVegan,
                    isVegetarian: flags.isVegetarian,
                    isGlutenFree: flags.isGlutenFree,
                    isDiabetic: flags.isDiabetic,
                    dietTags: flags.dietTags,
                  });
                }}
                catalog={prefCatalog}
                onCatalogChange={onPrefCatalogChange}
                languageCodes={languages.map((l) => l.code)}
              />
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
                  <TranslatableInput
                    key={`name-${currentLang.code}`}
                    label="Ürün adı"
                    sourceText={trTranslation.name}
                    targetLang={currentLang.code}
                    value={currentTranslation.name}
                    onChange={(val) => updateTranslation('name', val)}
                  />
                  <TranslatableTextarea
                    key={`desc-${currentLang.code}`}
                    label="Açıklama"
                    rows={2}
                    sourceText={trTranslation.description}
                    targetLang={currentLang.code}
                    value={currentTranslation.description}
                    onChange={(val) => updateTranslation('description', val)}
                  />
                  <TranslatableTextarea
                    key={`ing-${currentLang.code}`}
                    label="İçindekiler"
                    rows={2}
                    sourceText={trTranslation.ingredients}
                    targetLang={currentLang.code}
                    value={currentTranslation.ingredients}
                    onChange={(val) => updateTranslation('ingredients', val)}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'image' && (
            <div className="pt-2 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {productImages.map((url, index) => (
                  <div key={url} className="product-images-item">
                    <img src={imageUrl(url)} alt="" className="product-images-item__img" />
                    <div className="product-images-item__actions">
                      <button
                        type="button"
                        onClick={() => onMoveImage(url, -1)}
                        disabled={index === 0}
                        title="Yukarı taşı"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveImage(url, 1)}
                        disabled={index === productImages.length - 1}
                        title="Aşağı taşı"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveImage(url)}
                        className="text-red-500"
                        title="Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {index === 0 && <span className="product-images-item__cover">Kapak</span>}
                  </div>
                ))}
                {pendingPreviews.map((item) => (
                  <div key={item.id} className="product-images-item product-images-item--pending">
                    <img src={item.url} alt="" className="product-images-item__img" />
                    <button
                      type="button"
                      className="product-images-item__remove-pending"
                      onClick={() => onRemovePending(item.id)}
                      title="Kaldır"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span className="product-images-item__pending-label">Yeni</span>
                  </div>
                ))}
              </div>

              <div
                className="rounded-2xl border-2 border-dashed p-6 text-center transition hover:border-[var(--admin-accent)] cursor-pointer"
                style={{ borderColor: 'var(--admin-card-border)' }}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    onAddImages(e.target.files);
                    e.target.value = '';
                  }}
                />
                <ImagePlus
                  className="w-9 h-9 mx-auto mb-2"
                  style={{ color: 'var(--admin-accent)' }}
                />
                <p className="text-sm font-medium text-[var(--admin-text)]">
                  Görsel ekle (birden fazla seçebilirsiniz)
                </p>
                <p className="text-xs admin-text-subtle mt-1">600 × 600 · PNG, JPG — 5 MB</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-5">
            <Button variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
              İptal
            </Button>
            <Button className="flex-1" onClick={handleSaveClick} disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
