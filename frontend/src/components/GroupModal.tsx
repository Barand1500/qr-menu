import { useEffect, useRef, useState } from 'react';
import { X, ImagePlus, Layers, FolderTree } from 'lucide-react';
import { Button } from '@/components/ui';
import LanguageTabs from '@/components/LanguageTabs';
import { TranslatableInput } from '@/components/TranslatableField';

export interface GroupFormState {
  translations: Record<string, string>;
  isActive: boolean;
  parentId: number | null;
}

interface Language {
  id: number;
  code: string;
  name: string;
}

interface GroupModalProps {
  open: boolean;
  mode: 'create' | 'edit' | 'sub';
  parentName?: string | null;
  languages: Language[];
  form: GroupFormState;
  imagePreview?: string | null;
  saving?: boolean;
  onClose: () => void;
  onSave: () => void;
  onFormChange: (form: GroupFormState) => void;
  onImageChange: (file: File | null) => void;
}

export default function GroupModal({
  open,
  mode,
  parentName,
  languages,
  form,
  imagePreview,
  saving,
  onClose,
  onSave,
  onFormChange,
  onImageChange,
}: GroupModalProps) {
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

  const title =
    mode === 'edit' ? 'Grup Düzenle' : mode === 'sub' ? 'Yeni Alt Grup' : 'Yeni Grup';
  const subtitle =
    mode === 'sub' && parentName
      ? `"${parentName}" grubunun altına ekleniyor`
      : mode === 'create'
        ? 'Menüde görünecek yeni bir ana grup oluşturun'
        : 'Grup bilgilerini güncelleyin';

  const currentLang = sortedLangs.find((l) => l.code === activeLang) || sortedLangs[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[6px]" />

      <div
        className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto admin-scroll rounded-t-[28px] sm:rounded-[28px] shadow-2xl animate-slide-up"
        style={{
          background: 'var(--admin-card)',
          border: '1px solid var(--admin-card-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sticky top-0 z-10 px-6 pt-6 pb-4 rounded-t-[28px]"
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
                {mode === 'sub' ? (
                  <FolderTree className="w-5 h-5" style={{ color: 'var(--admin-accent)' }} />
                ) : (
                  <Layers className="w-5 h-5" style={{ color: 'var(--admin-accent)' }} />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-[var(--admin-text)]">{title}</h2>
                <p className="text-sm admin-text-muted mt-0.5">{subtitle}</p>
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
          <div className="space-y-3">
            <LanguageTabs
              languages={sortedLangs}
              activeCode={activeLang}
              onChange={setActiveLang}
            />
            {currentLang && (
              <TranslatableInput
                key={currentLang.code}
                label="Grup Adı"
                sourceText={form.translations.tr || ''}
                targetLang={currentLang.code}
                value={form.translations[currentLang.code] || ''}
                onChange={(val) =>
                  onFormChange({
                    ...form,
                    translations: {
                      ...form.translations,
                      [currentLang.code]: val,
                    },
                  })
                }
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--admin-text)] mb-2">
              Grup Görseli
            </label>
            <div
              className="rounded-2xl border-2 border-dashed p-4 transition hover:border-[var(--admin-accent)] cursor-pointer"
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
              <div className="flex items-center gap-4">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt=""
                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'var(--admin-accent-soft)' }}
                  >
                    <ImagePlus className="w-6 h-6" style={{ color: 'var(--admin-accent)' }} />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-[var(--admin-text)]">
                    Görsel yüklemek için tıklayın
                  </p>
                  <p className="text-xs admin-text-subtle mt-1">PNG, JPG — en fazla 5 MB</p>
                </div>
              </div>
            </div>
          </div>

          <label
            className="flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition hover:bg-[var(--admin-accent-soft)]"
            style={{ background: 'var(--admin-input-bg)' }}
          >
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => onFormChange({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 rounded accent-[var(--admin-accent)]"
            />
            <div>
              <p className="text-sm font-medium text-[var(--admin-text)]">Menüde aktif</p>
              <p className="text-xs admin-text-subtle">Kapalıysa müşteri menüsünde görünmez</p>
            </div>
          </label>

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
