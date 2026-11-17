import { useEffect, useState } from 'react';
import { ChevronDown, ImagePlus, X } from 'lucide-react';
import AdminOverlay from '@/components/admin/AdminOverlay';
import { Button, Input, Select } from '@/components/ui';
import LanguageTabs from '@/components/LanguageTabs';
import { TranslatableInput } from '@/components/TranslatableField';
import { ShowcaseImage } from './ShowcaseCard';
import type { Language, MediaEditor, MediaForm, ProductOption } from './types';
export default function ShowcaseEditor({
  editor,
  languages,
  products,
  preview,
  busy,
  error,
  onChange,
  onFile,
  onClose,
  onSave,
}: {
  editor: MediaEditor;
  languages: Language[];
  products: ProductOption[];
  preview: string | null;
  busy: boolean;
  error: string;
  onChange: (form: MediaForm) => void;
  onFile: (file: File | null) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { form } = editor,
    story = editor.type === 'story';
  const [lang, setLang] = useState('tr');
  useEffect(() => {
    setLang(
      languages.find((l) => l.code === 'tr')?.code ||
        languages[0]?.code ||
        'tr',
    );
  }, [languages]);
  const current = form.translations[lang] || { title1: '', title2: '' },
    tr = form.translations.tr || { title1: '', title2: '' };
  function text(field: 'title1' | 'title2', value: string) {
    onChange({
      ...form,
      translations: {
        ...form.translations,
        [lang]: { ...current, [field]: value },
      },
    });
  }
  const title = editor.item
    ? story
      ? 'Hikâyeyi düzenle'
      : 'Afişi düzenle'
    : story
      ? 'Yeni hikâye'
      : 'Yeni afiş';
  return (
    <AdminOverlay
      label={title}
      busy={busy}
      onClose={onClose}
      className="sc-overlay"
    >
      <section className="relative sc-editor">
        <header className="sc-editor__head">
          <div>
            <span className="sc-eyebrow">
              {story ? 'HİKÂYELER' : 'AFİŞLER'}
            </span>
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            className="sc-icon"
            aria-label="Pencereyi kapat"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="sc-editor__scroll admin-scroll">
          {error && (
            <p className="sc-error" role="alert">
              {error}
            </p>
          )}
          <fieldset disabled={busy} className="sc-editor__fields">
            <label className={`sc-upload ${story ? 'sc-upload--story' : ''}`}>
              {preview ? (
                <ShowcaseImage src={preview} />
              ) : (
                <span className="sc-upload__empty">
                  <ImagePlus size={28} />
                  <strong>Görsel seç</strong>
                  <small>
                    {story
                      ? 'Dikey fotoğraflar daha iyi görünür'
                      : 'Geniş bir fotoğraf seç'}
                  </small>
                </span>
              )}
              {preview && (
                <span className="sc-upload__change">
                  <ImagePlus size={16} /> Fotoğrafı değiştir
                </span>
              )}
              <input
                type="file"
                accept="image/*"
                aria-label="Görsel seç"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onFile(file);
                  event.target.value = '';
                }}
              />
            </label>
            <Input
              label={story ? 'Hikâye adı' : 'Afiş adı'}
              placeholder={story ? 'Örn. Günün kahvesi' : 'Örn. Yeni sezon'}
              value={form.name}
              onChange={(event) =>
                onChange({ ...form, name: event.target.value })
              }
            />
            <Select
              label={
                story ? 'Bağlantılı ürün' : 'Bağlantılı ürün (isteğe bağlı)'
              }
              value={form.productId}
              options={[
                ...(story ? [] : [{ value: '', label: 'Bağlantı yok' }]),
                ...(!products.some((p) => String(p.id) === form.productId) &&
                form.productId
                  ? [
                      {
                        value: form.productId,
                        label: editor.item?.productName || 'Mevcut ürün',
                      },
                    ]
                  : []),
                ...products.map((p) => ({
                  value: String(p.id),
                  label: p.name,
                })),
              ]}
              onChange={(event) =>
                onChange({ ...form, productId: event.target.value })
              }
            />
            {story && (
              <div className="sc-duration">
                <span>Gösterim süresi</span>
                <div role="group" aria-label="Gösterim süresi">
                  {[3, 5, 8].map((seconds) => (
                    <button
                      type="button"
                      key={seconds}
                      aria-pressed={form.durationSeconds === seconds}
                      onClick={() =>
                        onChange({ ...form, durationSeconds: seconds })
                      }
                    >
                      {seconds} sn
                    </button>
                  ))}
                  <label>
                    <span className="sr-only">Özel süre (saniye)</span>
                    <input
                      type="number"
                      min={2}
                      max={30}
                      aria-label="Özel süre (saniye)"
                      value={form.durationSeconds}
                      onChange={(event) =>
                        onChange({
                          ...form,
                          durationSeconds: Number(event.target.value),
                        })
                      }
                    />
                    <small>sn</small>
                  </label>
                </div>
              </div>
            )}
            {!story && (
              <details className="sc-texts">
                <summary>
                  Yazılar ve çeviriler <ChevronDown size={17} />
                </summary>
                <div className="sc-texts__fields">
                  {languages.length > 1 && (
                    <LanguageTabs
                      languages={languages}
                      activeCode={lang}
                      onChange={setLang}
                      variant="underline"
                    />
                  )}
                  <TranslatableInput
                    key={`title1-${lang}`}
                    label="Başlık"
                    sourceText={tr.title1}
                    targetLang={lang}
                    value={current.title1}
                    onChange={(value) => text('title1', value)}
                  />
                  <TranslatableInput
                    key={`title2-${lang}`}
                    label="Alt başlık"
                    sourceText={tr.title2}
                    targetLang={lang}
                    value={current.title2}
                    onChange={(value) => text('title2', value)}
                  />
                </div>
              </details>
            )}
            <label className="sc-visible">
              <span>Menüde göster</span>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  onChange({ ...form, isActive: event.target.checked })
                }
              />
            </label>
          </fieldset>
        </div>
        <footer className="sc-editor__footer">
          <Button onClick={onSave} disabled={busy}>
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </footer>
      </section>
    </AdminOverlay>
  );
}
