import { useEffect, useRef } from 'react';
import { X, ImagePlus, Circle } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';

export interface StoryFormState {
  name: string;
  productId: string;
  isActive: boolean;
  durationSeconds: number;
}

interface ProductOption {
  id: number;
  name: string;
}

interface StoryModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  products: ProductOption[];
  form: StoryFormState;
  imagePreview?: string | null;
  saving?: boolean;
  onClose: () => void;
  onSave: () => void;
  onFormChange: (form: StoryFormState) => void;
  onImageChange: (file: File | null) => void;
}

export default function StoryModal({
  open,
  mode,
  products,
  form,
  imagePreview,
  saving,
  onClose,
  onSave,
  onFormChange,
  onImageChange,
}: StoryModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const productOptions = products.map((p) => ({
    value: p.id.toString(),
    label: p.name,
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[6px]" />

      <div
        className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto admin-scroll rounded-t-[28px] sm:rounded-[28px] shadow-2xl animate-slide-up"
        style={{
          background: 'var(--admin-card)',
          border: '1px solid var(--admin-card-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--admin-accent-soft)' }}
              >
                <Circle className="w-5 h-5" style={{ color: 'var(--admin-accent)' }} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--admin-text)]">
                  {mode === 'edit' ? 'Hikaye Düzenle' : 'Yeni Hikaye'}
                </h2>
                <p className="text-sm admin-text-muted mt-0.5">
                  Mobil menüde Instagram hikayesi gibi görünür
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-[var(--admin-accent-soft)] admin-text-muted"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-5">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="story-modal-preview"
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onImageChange(e.target.files?.[0] || null)}
              />
              {imagePreview ? (
                <img src={imagePreview} alt="" className="story-modal-preview__img" />
              ) : (
                <div className="story-modal-preview__empty">
                  <ImagePlus className="w-8 h-8" style={{ color: 'var(--admin-accent)' }} />
                </div>
              )}
            </button>
            <p className="text-xs admin-text-muted text-center">
              Yuvarlak görsel · önerilen 400×400 px
            </p>
          </div>

          <div className="space-y-4 float-field-stack">
            <Input
              label="Hikaye adı (mobilde altta görünür)"
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
            />
            <Select
              label="Bağlantılı ürün"
              value={form.productId}
              options={productOptions}
              onChange={(e) => onFormChange({ ...form, productId: e.target.value })}
            />
            <Input
              label="Gösterim süresi (saniye)"
              type="number"
              min={2}
              max={30}
              value={String(form.durationSeconds)}
              onChange={(e) =>
                onFormChange({
                  ...form,
                  durationSeconds: Math.min(30, Math.max(2, Number(e.target.value) || 5)),
                })
              }
            />
            <p className="text-xs admin-text-muted -mt-2">
              Hikaye bu süre sonunda otomatik olarak sonrakine geçer (2–30 sn)
            </p>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer text-sm text-[var(--admin-text)]">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => onFormChange({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 rounded accent-[var(--admin-accent)]"
            />
            Mobilde aktif
          </label>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
              İptal
            </Button>
            <Button className="flex-1" onClick={onSave} disabled={saving || !form.productId}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
