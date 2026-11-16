import { useEffect, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui';
import LanguageTabs from '@/components/LanguageTabs';
import { TranslatableInput } from '@/components/TranslatableField';
import GroupsDialog from '@/components/admin/groups/GroupsDialog';

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
  error?: string;
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
  error,
  onClose,
  onSave,
  onFormChange,
  onImageChange,
}: GroupModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const sorted = [...languages].sort((a, b) =>
    a.code === 'tr' ? -1 : b.code === 'tr' ? 1 : 0,
  );
  const [activeLang, setActiveLang] = useState('tr');
  useEffect(() => {
    if (open)
      setActiveLang(
        languages.find((l) => l.code === 'tr')?.code ||
          languages[0]?.code ||
          'tr',
      );
  }, [open, languages]);
  const current = sorted.find((l) => l.code === activeLang) || sorted[0];
  return (
    <GroupsDialog
      open={open}
      title={
        mode === 'edit'
          ? 'Grup ayrıntıları'
          : mode === 'sub'
            ? 'Bir alt başlık daha'
            : 'Yeni bir grup'
      }
      subtitle={
        parentName
          ? `${parentName} altında`
          : 'Menünüzün başlığını, görselini ve çevirilerini düzenleyin.'
      }
      busy={saving}
      onClose={onClose}
    >
      <form
        className="ag-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!saving) onSave();
        }}
      >
        {error && (
          <p className="ag-form-error" role="alert">
            {error}
          </p>
        )}
        <fieldset disabled={saving} className="ag-form">
          <div className="ag-languages">
            <LanguageTabs
              languages={sorted}
              activeCode={activeLang}
              onChange={setActiveLang}
            />
          </div>
          {current && (
            <TranslatableInput
              key={current.code}
              label="Grup adı"
              maxLength={200}
              sourceText={form.translations.tr || ''}
              targetLang={current.code}
              value={form.translations[current.code] || ''}
              onChange={(value) =>
                onFormChange({
                  ...form,
                  translations: { ...form.translations, [current.code]: value },
                })
              }
            />
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            aria-label="Grup görseli seç"
            onChange={(e) => {
              onImageChange(e.target.files?.[0] || null);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="ag-form-image"
            onClick={() => fileRef.current?.click()}
          >
            {imagePreview ? (
              <img src={imagePreview} alt="Grup görseli önizlemesi" />
            ) : (
              <ImagePlus size={30} />
            )}
            <span>
              {imagePreview ? 'Görseli değiştir' : 'Gruba bir görsel ekle'}
              <small>İsteğe bağlı · En fazla 5 MB</small>
            </span>
          </button>
          <label className="ag-form-visible">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                onFormChange({ ...form, isActive: e.target.checked })
              }
            />
            Menüde göster
          </label>
        </fieldset>
        <div className="ag-form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={saving}
          >
            Vazgeç
          </Button>
          <Button type="submit" disabled={saving || !current}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </div>
      </form>
    </GroupsDialog>
  );
}
