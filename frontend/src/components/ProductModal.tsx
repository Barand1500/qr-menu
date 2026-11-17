import { useEffect, useRef, useState } from 'react';
import { X, Plus, Pencil, Trash2 } from 'lucide-react';
import { imageUrl } from '@/lib/api';
import { Button, Input, Select } from '@/components/ui';
import LanguageTabs, { type Language } from '@/components/LanguageTabs';
import {
  TranslatableInput,
  TranslatableTextarea,
} from '@/components/TranslatableField';
import {
  catalogToOptions,
  dietIdsFromProduct,
  flagsFromDietSelection,
  defaultPrefCatalog,
  type PrefCatalog,
} from '@/lib/prefCatalog';
import { ManageableTagPillGroup } from '@/components/CatalogTagManager';
import IngredientPoolPicker from '@/components/admin/IngredientPoolPicker';
import { syncIngredientsFromPoolSelection } from '@/lib/ingredientPool';
import '@/ingredient-pool.css';
import AdminOverlay from '@/components/admin/AdminOverlay';
import ProductNameField, {
  type Suggestion,
} from '@/components/admin/products/ProductNameField';
import ProductGallery from '@/components/admin/products/ProductGallery';
import { findDishTemplate, normalizeDishName } from '@/lib/dishCatalog';
import {
  fillDishDraft,
  undoDraftFill,
  type DraftFill,
} from '@/components/admin/products/dishDraft';
import '@/components/admin/products/product-editor.css';

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

type ModalTab = 'general' | 'translations' | 'image';

const MODAL_TABS: { id: ModalTab; label: string }[] = [
  { id: 'general', label: 'Ürün' },
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
        <p className="text-xs font-bold uppercase tracking-wide admin-text-muted">
          Özellikler
        </p>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition hover:opacity-90"
          style={{
            background: 'var(--admin-accent)',
            color: 'var(--admin-btn-primary-text)',
          }}
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
            <div
              key={index}
              className="flex items-center gap-1.5 w-full sm:w-auto"
            >
              <Input
                label="Özellik adı"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 min-w-[140px]"
              />
              <Button size="sm" type="button" onClick={() => saveEdit(index)}>
                OK
              </Button>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => setEditingIdx(null)}
              >
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
          ),
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
  currencies: {
    id: number;
    code: string;
    name: string;
    symbol: string;
    isActive: boolean;
  }[];
  groups: GroupOption[];
  prefCatalog: PrefCatalog;
  onPrefCatalogChange: (catalog: PrefCatalog) => void;
  form: ProductFormState;
  productImages: string[];
  pendingPreviews: { id: string; url: string }[];
  photoOrder: string[];
  productId?: number;
  saving?: boolean;
  error?: string;
  initialTab?: ModalTab;
  onClose: () => void;
  onSave: () => void;
  onFormChange: (form: ProductFormState) => void;
  onAddImages: (files: FileList | null) => void;
  onRemoveImage: (url: string) => void;
  onRemovePending: (id: string) => void;
  onPhotoOrderChange: (ids: string[]) => void;
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
  photoOrder,
  productId,
  saving,
  error,
  initialTab = 'general',
  onClose,
  onSave,
  onFormChange,
  onAddImages,
  onRemoveImage,
  onRemovePending,
  onPhotoOrderChange,
}: ProductModalProps) {
  const sortedLangs = [...languages].sort((a, b) =>
    a.code === 'tr' ? -1 : b.code === 'tr' ? 1 : 0,
  );
  const [activeTab, setActiveTab] = useState<ModalTab>('general');
  const [activeLang, setActiveLang] = useState(sortedLangs[0]?.code || 'tr');
  const [ingredientsMode, setIngredientsMode] = useState<'manual' | 'pool'>(
    'manual',
  );
  const [poolPickerOpen, setPoolPickerOpen] = useState(false);
  const autoFill = useRef<DraftFill | null>(null);
  const [assistText, setAssistText] = useState('');

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
    setIngredientsMode('manual');
    setPoolPickerOpen(false);
    autoFill.current = null;
    setAssistText('');
    const tr = languages.find((l) => l.code === 'tr');
    setActiveLang(tr?.code || languages[0]?.code || 'tr');
    // Yalnızca modal açıldığında sıfırla — onClose/languages her render'da değişebilir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (activeTab !== 'translations') setPoolPickerOpen(false);
  }, [activeTab]);

  if (!open) return null;

  const currentLang =
    sortedLangs.find((l) => l.code === activeLang) || sortedLangs[0];
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

  function updateTranslation(
    field: keyof ProductTranslationFields,
    value: string,
  ) {
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
    label:
      g.isSubGroup && g.parentName ? `${g.parentName} › ${g.name}` : g.name,
  }));
  const missingAllergens = autoFill.current
    ? form.allergenTags.filter(
        (id) => !prefCatalog.allergens.some((tag) => tag.id === id),
      )
    : [];
  const missingDiets = autoFill.current
    ? dietIdsFromProduct(form, form.dietTags).filter(
        (id) => !prefCatalog.diets.some((tag) => tag.id === id),
      )
    : [];
  const missingTags = [...missingAllergens, ...missingDiets];
  const builtins = defaultPrefCatalog();
  function changeName(name: string, selected?: Suggestion) {
    if (
      !selected &&
      autoFill.current &&
      normalizeDishName(autoFill.current.name) === normalizeDishName(name)
    ) {
      onFormChange({
        ...form,
        translations: { ...form.translations, tr: { ...trTranslation, name } },
      });
      return;
    }
    const restored = undoDraftFill(form, autoFill.current);
    const base = {
      ...restored,
      translations: {
        ...restored.translations,
        tr: { ...restored.translations.tr, name },
      },
    };
    const template =
      selected?.template ||
      (mode === 'create' ? findDishTemplate(name) : undefined);
    if (template || selected?.product) {
      const after = fillDishDraft(base, name, template, selected?.product);
      autoFill.current = { before: base, after, name };
      setAssistText(
        selected?.product
          ? 'Menünüzdeki ürün bilgileri alındı; dolu alanlarınız korundu.'
          : 'Başlangıç kataloğundan örnek tarif dolduruldu. İçerik, alerjen ve tercihleri kendi tarifinizle kontrol edin.',
      );
      onFormChange(after);
    } else {
      autoFill.current = null;
      setAssistText('');
      onFormChange(base);
    }
  }

  return (
    <AdminOverlay
      open={open}
      busy={saving}
      label={mode === 'edit' ? 'Ürün ayrıntıları' : 'Yeni ürün'}
      className="admin-overlay--product pe-editor"
      onClose={onClose}
      onEscape={() => {
        if (poolPickerOpen) {
          setPoolPickerOpen(false);
          return true;
        }
        return false;
      }}
    >
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[6px]" />

      <div
        className={`product-modal-shell relative z-10 ${poolPickerOpen ? 'is-pool-open' : ''}`}
      >
        <div
          className="product-modal-shell__main relative w-full sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col rounded-t-[28px] sm:rounded-[28px] shadow-2xl animate-slide-up"
          style={{
            background: 'var(--admin-card)',
            border: '1px solid var(--admin-card-border)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 pt-6 pb-3 shrink-0 pe-header">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="pe-eyebrow">
                    {mode === 'edit' ? 'MENÜNÜZDEN' : 'MENÜYE EKLE'}
                  </p>
                  <h2 className="text-xl font-bold text-[var(--admin-text)]">
                    {mode === 'edit' ? 'Ürünü düzenle' : 'Yeni ürün'}
                  </h2>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={saving}
                aria-label="Ürün penceresini kapat"
                className="p-2 rounded-xl hover:bg-[var(--admin-accent-soft)] admin-text-muted transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="pe-tabs">
              {MODAL_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={activeTab === tab.id ? 'is-active' : ''}
                  aria-pressed={activeTab === tab.id}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto admin-scroll px-6 pb-6">
            {error && (
              <p role="alert" className="ag-form-error">
                {error}
              </p>
            )}
            {missingTags.length > 0 && (
              <div role="alert" className="ag-form-error">
                Önerilen bazı etiketler listenizde yok:{' '}
                {missingTags
                  .map(
                    (id) =>
                      [...builtins.allergens, ...builtins.diets].find(
                        (tag) => tag.id === id,
                      )?.label.tr || id,
                  )
                  .join(', ')}
                . Alerjenler bölümünde kendi etiketinizi seçebilirsiniz.
                <button
                  type="button"
                  className="pe-copy-tags"
                  onClick={() =>
                    onFormChange({
                      ...form,
                      allergenTags: form.allergenTags.filter(
                        (id) => !missingAllergens.includes(id),
                      ),
                      ...flagsFromDietSelection(
                        dietIdsFromProduct(form, form.dietTags).filter(
                          (id) => !missingDiets.includes(id),
                        ),
                      ),
                    })
                  }
                >
                  Listemde olmayan önerileri kaldır
                </button>
              </div>
            )}
            <fieldset disabled={saving} className="min-w-0">
              {activeTab === 'general' && (
                <div className="pe-form">
                  <ProductNameField
                    value={trTranslation.name}
                    productId={productId}
                    disabled={saving}
                    onChange={(name) => changeName(name)}
                    onSelect={(suggestion) =>
                      changeName(suggestion.name, suggestion)
                    }
                  />
                  <div className="pe-primary-grid">
                    <Select
                      label="Grubu"
                      value={form.groupId}
                      options={groupOptions}
                      onChange={(event) =>
                        onFormChange({ ...form, groupId: event.target.value })
                      }
                    />
                    <fieldset className="pe-price">
                      <legend>Fiyat</legend>
                      <input
                        aria-label="Fiyat"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={form.price}
                        onChange={(event) =>
                          onFormChange({ ...form, price: event.target.value })
                        }
                      />
                      <select
                        aria-label="Para birimi"
                        value={form.currencyId}
                        onChange={(event) =>
                          onFormChange({
                            ...form,
                            currencyId: event.target.value,
                          })
                        }
                      >
                        <option value="" disabled>
                          Seçin
                        </option>
                        {currencies
                          .filter(
                            (currency) =>
                              currency.isActive ||
                              String(currency.id) === form.currencyId,
                          )
                          .map((currency) => (
                            <option key={currency.id} value={currency.id}>
                              {currency.symbol} {currency.code}
                            </option>
                          ))}
                      </select>
                    </fieldset>
                  </div>
                  <label className="pe-description">
                    Kısa açıklama <span>isteğe bağlı</span>
                    <textarea
                      aria-label="Kısa açıklama"
                      rows={2}
                      placeholder="Misafiriniz bu lezzet hakkında ne bilmeli?"
                      value={trTranslation.description}
                      onChange={(event) =>
                        onFormChange({
                          ...form,
                          translations: {
                            ...form.translations,
                            tr: {
                              ...trTranslation,
                              description: event.target.value,
                            },
                          },
                        })
                      }
                    />
                  </label>
                  <div className="pe-numbers">
                    <label>
                      Hazırlanma{' '}
                      <span>
                        <input
                          aria-label="Hazırlanma (dk.)"
                          type="number"
                          min="0"
                          inputMode="numeric"
                          placeholder="—"
                          value={form.prepTimeMinutes}
                          onChange={(event) =>
                            onFormChange({
                              ...form,
                              prepTimeMinutes: event.target.value,
                            })
                          }
                        />
                        <small>dk</small>
                      </span>
                    </label>
                    <label>
                      Kalori{' '}
                      <span>
                        <input
                          aria-label="Kalori (kcal)"
                          type="number"
                          min="0"
                          inputMode="numeric"
                          placeholder="—"
                          value={form.calories}
                          onChange={(event) =>
                            onFormChange({
                              ...form,
                              calories: event.target.value,
                            })
                          }
                        />
                        <small>kcal</small>
                      </span>
                    </label>
                  </div>
                  {assistText && (
                    <p className="pe-assist" role="status">
                      {assistText}
                      {trTranslation.ingredients && (
                        <small>İçerik: {trTranslation.ingredients}</small>
                      )}
                    </p>
                  )}
                  <details className="pe-details">
                    <summary>
                      <span>
                        Alerjenler ve tercihler
                        <small>
                          {form.allergenTags.length +
                            dietIdsFromProduct(form, form.dietTags).length >
                          0
                            ? [
                                ...catalogToOptions(
                                  prefCatalog,
                                  'allergen',
                                ).filter((item) =>
                                  form.allergenTags.includes(item.id),
                                ),
                                ...catalogToOptions(prefCatalog, 'diet').filter(
                                  (item) =>
                                    dietIdsFromProduct(
                                      form,
                                      form.dietTags,
                                    ).includes(item.id),
                                ),
                              ]
                                .map((item) => item.label)
                                .join(' · ')
                            : 'Gerekliyse ekleyin'}
                        </small>
                      </span>
                      <Plus size={17} />
                    </summary>
                    <div className="pe-details__body">
                      <ManageableTagPillGroup
                        title="Alerjenler"
                        hint="Tarifinizde bulunanları seçin."
                        kind="allergen"
                        options={catalogToOptions(prefCatalog, 'allergen')}
                        selected={form.allergenTags}
                        onChange={(allergenTags) =>
                          onFormChange({ ...form, allergenTags })
                        }
                        catalog={prefCatalog}
                        onCatalogChange={onPrefCatalogChange}
                        languageCodes={languages.map(
                          (language) => language.code,
                        )}
                      />
                      <ManageableTagPillGroup
                        title="Diyet / yaşam tarzı"
                        hint="Ürün bu tercihlere uygunsa seçin."
                        kind="diet"
                        options={catalogToOptions(prefCatalog, 'diet')}
                        selected={dietIdsFromProduct(form, form.dietTags)}
                        onChange={(ids) =>
                          onFormChange({
                            ...form,
                            ...flagsFromDietSelection(ids),
                          })
                        }
                        catalog={prefCatalog}
                        onCatalogChange={onPrefCatalogChange}
                        languageCodes={languages.map(
                          (language) => language.code,
                        )}
                      />
                    </div>
                  </details>
                  <details className="pe-details">
                    <summary>
                      <span>
                        Ürün özellikleri
                        <small>
                          {form.features.length
                            ? form.features.join(' · ')
                            : 'Acı, ev yapımı, günlük taze…'}
                        </small>
                      </span>
                      <Plus size={17} />
                    </summary>
                    <div className="pe-details__body">
                      <ProductFeaturesEditor
                        features={form.features}
                        onChange={(features) =>
                          onFormChange({ ...form, features })
                        }
                      />
                    </div>
                  </details>
                  <div className="pe-toggles">
                    <label>
                      <input
                        type="checkbox"
                        checked={form.isRecommended}
                        onChange={(event) =>
                          onFormChange({
                            ...form,
                            isRecommended: event.target.checked,
                          })
                        }
                      />
                      Önerilen ürün
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(event) =>
                          onFormChange({
                            ...form,
                            isActive: event.target.checked,
                          })
                        }
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
                        onChange={(val) =>
                          updateTranslation('description', val)
                        }
                      />
                      <TranslatableTextarea
                        key={`ing-${currentLang.code}`}
                        label="İçindekiler"
                        rows={2}
                        sourceText={trTranslation.ingredients}
                        targetLang={currentLang.code}
                        value={currentTranslation.ingredients}
                        onChange={(val) =>
                          updateTranslation('ingredients', val)
                        }
                        onFocus={() => {
                          if (ingredientsMode === 'pool')
                            setPoolPickerOpen(true);
                        }}
                        endAction={
                          <div
                            className="ingredient-mode-toggle ingredient-mode-toggle--field"
                            role="group"
                            aria-label="İçindekiler kaynağı"
                          >
                            <button
                              type="button"
                              className={
                                ingredientsMode === 'pool' ? 'is-active' : ''
                              }
                              onClick={() => {
                                setIngredientsMode('pool');
                                setPoolPickerOpen(true);
                              }}
                            >
                              Havuz
                            </button>
                            <button
                              type="button"
                              className={
                                ingredientsMode === 'manual' ? 'is-active' : ''
                              }
                              onClick={() => {
                                setIngredientsMode('manual');
                                setPoolPickerOpen(false);
                              }}
                            >
                              Elle
                            </button>
                          </div>
                        }
                      />
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'image' && (
                <div className="pe-images">
                  <div className="pe-section-title">
                    <span>Görselleriniz</span>
                    <small>
                      {productImages.length + pendingPreviews.length} görsel
                    </small>
                  </div>
                  <ProductGallery
                    disabled={saving}
                    photos={(() => {
                      const photos = [
                        ...productImages.map((url) => ({
                          id: 'saved:' + url,
                          src: imageUrl(url),
                        })),
                        ...pendingPreviews.map((item) => ({
                          id: 'pending:' + item.id,
                          src: item.url,
                          pending: true,
                        })),
                      ];
                      return photos.sort(
                        (a, b) =>
                          photoOrder.indexOf(a.id) - photoOrder.indexOf(b.id),
                      );
                    })()}
                    onOrder={onPhotoOrderChange}
                    onRemove={(photo) =>
                      photo.pending
                        ? onRemovePending(photo.id.slice(8))
                        : onRemoveImage(photo.id.slice(6))
                    }
                  />
                  <label className="pe-upload">
                    <Plus size={22} />
                    <span>
                      Görsel ekle<small>PNG, JPG, WebP · en fazla 5 MB</small>
                    </span>
                    <input
                      type="file"
                      aria-label="Ürün görselleri ekle"
                      accept="image/*"
                      multiple
                      disabled={saving}
                      onChange={(event) => {
                        onAddImages(event.target.files);
                        event.target.value = '';
                      }}
                    />
                  </label>
                  <p className="pe-help">
                    Yeni görseller ve sıralama Kaydet ile yayınlanır.
                  </p>
                </div>
              )}
            </fieldset>
          </div>
          <div
            className="flex gap-3 px-6 py-4 border-t shrink-0"
            style={{ borderColor: 'var(--admin-card-border)' }}
          >
            <Button
              className="flex-1"
              onClick={onSave}
              disabled={saving || missingTags.length > 0}
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </div>

        <IngredientPoolPicker
          open={poolPickerOpen && ingredientsMode === 'pool'}
          currentIngredients={currentTranslation.ingredients}
          onClose={() => setPoolPickerOpen(false)}
          onSelectionChange={(names, allPoolNames) => {
            updateTranslation(
              'ingredients',
              syncIngredientsFromPoolSelection(
                currentTranslation.ingredients,
                names,
                allPoolNames,
              ),
            );
          }}
        />
      </div>
    </AdminOverlay>
  );
}
