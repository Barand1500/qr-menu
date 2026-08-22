import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X, ImagePlus, UtensilsCrossed } from 'lucide-react';
import { Button, Input, Textarea } from '@/components/ui';
import LanguageTabs, { type Language } from '@/components/LanguageTabs';

export interface ProductTranslationFields {
  name: string;
  description: string;
}

export interface ProductFormState {
  groupId: string;
  price: string;
  translations: Record<string, ProductTranslationFields>;
  isActive: boolean;
}

interface GroupOption {
  id: number;
  name: string;
  isSubGroup?: boolean;
  parentName?: string | null;
}

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

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-2xl overflow-hidden"
      style={{
        border: '1px solid var(--admin-card-border)',
        background: 'var(--admin-card)',
      }}
    >
      <div
        className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider admin-text-muted"
        style={{ background: 'var(--admin-input-bg)' }}
      >
        {title}
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </section>
  );
}

function FormRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid sm:grid-cols-[140px_1fr] gap-2 sm:gap-4 sm:items-start">
      <label className="text-sm font-medium text-[var(--admin-text)] pt-2.5">{label}</label>
      <div>{children}</div>
    </div>
  );
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
  const [activeLang, setActiveLang] = useState(sortedLangs[0]?.code || 'tr');

  useEffect(() => {
    if (!open) return;
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
  };

  function updateTranslation(field: keyof ProductTranslationFields, value: string) {
    if (!currentLang) return;
    onFormChange({
      ...form,
      translations: {
        ...form.translations,
        [currentLang.code]: {
          ...currentTranslation,
          [field]: value,
        },
      },
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[6px]" />

      <div
        className="relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto admin-scroll rounded-t-[28px] sm:rounded-[28px] shadow-2xl animate-slide-up"
        style={{
          background: 'var(--admin-card)',
          border: '1px solid var(--admin-card-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sticky top-0 z-10 px-6 pt-6 pb-4"
          style={{
            background: 'linear-gradient(180deg, var(--admin-card) 70%, transparent)',
          }}
        >
          <div className="flex items-start justify-between gap-4">
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
                  {mode === 'edit' ? 'Ürün bilgilerini güncelleyin' : 'Menüye yeni bir ürün ekleyin'}
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

        <div className="px-6 pb-6 space-y-4">
          <FormSection title="Ürün Bilgileri">
            <FormRow label="Grubu">
              <select
                value={form.groupId}
                onChange={(e) => onFormChange({ ...form, groupId: e.target.value })}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition focus:ring-2"
                style={{
                  background: 'var(--admin-input-bg)',
                  border: '1px solid var(--admin-input-border)',
                  color: 'var(--admin-text)',
                }}
              >
                <option value="">Seçiniz</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.isSubGroup && g.parentName ? `${g.parentName} › ${g.name}` : g.name}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="Fiyat">
              <Input
                type="number"
                step="0.01"
                min="0"
                label="0,00"
                value={form.price}
                onChange={(e) => onFormChange({ ...form, price: e.target.value })}
              />
            </FormRow>
            <FormRow label="Durum">
              <label
                className="inline-flex items-center gap-2.5 cursor-pointer py-1"
              >
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => onFormChange({ ...form, isActive: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--admin-accent)]"
                />
                <span className="text-sm text-[var(--admin-text)]">Aktif</span>
              </label>
            </FormRow>
          </FormSection>

          <FormSection title="Çeviriler">
            <LanguageTabs
              languages={sortedLangs}
              activeCode={activeLang}
              onChange={setActiveLang}
              variant="underline"
            />
            {currentLang && (
              <div className="space-y-4 float-field-stack pt-2">
                <FormRow label="Adı">
                  <Input
                    key={`name-${currentLang.code}`}
                    label="Ürün adı"
                    value={currentTranslation.name}
                    onChange={(e) => updateTranslation('name', e.target.value)}
                  />
                </FormRow>
                <FormRow label="Açıklama">
                  <Textarea
                    key={`desc-${currentLang.code}`}
                    label="Ürün açıklaması"
                    rows={3}
                    value={currentTranslation.description}
                    onChange={(e) => updateTranslation('description', e.target.value)}
                  />
                </FormRow>
              </div>
            )}
          </FormSection>

          <FormSection title="Resimler · 600 × 600">
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
                  className="w-32 h-32 mx-auto rounded-2xl object-cover mb-3"
                />
              ) : (
                <ImagePlus
                  className="w-10 h-10 mx-auto mb-3"
                  style={{ color: 'var(--admin-accent)' }}
                />
              )}
              <p className="text-sm font-medium text-[var(--admin-text)]">
                Yüklemek istediğiniz dosyayı sürükleyin ya da seçmek için tıklayın
              </p>
              <p className="text-xs admin-text-subtle mt-1">PNG, JPG — en fazla 5 MB</p>
            </div>
          </FormSection>

          <div className="flex gap-3 pt-1">
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
