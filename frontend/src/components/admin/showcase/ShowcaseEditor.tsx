import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ImagePlus, Plus, X } from 'lucide-react';
import AdminOverlay from '@/components/admin/AdminOverlay';
import { Button, Input } from '@/components/ui';
import LanguageTabs from '@/components/LanguageTabs';
import { TranslatableInput } from '@/components/TranslatableField';
import { ShowcaseImage } from './ShowcaseCard';
import ProductPicker, { ProductThumb } from './ProductPicker';
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
  const [picking, setPicking] = useState(false);
  const linkButton = useRef<HTMLButtonElement>(null);
  const wasPicking = useRef(false);
  useEffect(() => {
    setLang(
      languages.find((l) => l.code === 'tr')?.code ||
        languages[0]?.code ||
        'tr',
    );
  }, [languages]);
  // Back from the chooser: focus returns to the button that opened it.
  useEffect(() => {
    if (wasPicking.current && !picking)
      linkButton.current?.focus({ preventScroll: true });
    wasPicking.current = picking;
  }, [picking]);
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
  // The linked product may be missing from the list (removed, or not loaded): keep its saved name.
  const linked = form.productId
    ? products.find((p) => String(p.id) === form.productId) ||
      ({
        id: Number(form.productId),
        name: editor.item?.productName || 'Mevcut ürün',
      } as ProductOption)
    : null;
  const missing = story && !linked && /ürün/i.test(error);
  return (
    <AdminOverlay
      label={picking ? 'Ürün seç' : title}
      busy={busy}
      onClose={onClose}
      onEscape={() => {
        if (!picking) return false;
        setPicking(false);
        return true;
      }}
      className="sc-overlay"
    >
      <section className={`relative sc-editor${picking ? ' is-picking' : ''}`}>
        {picking && (
          <ProductPicker
            products={products}
            value={form.productId}
            busy={busy}
            title={title}
            onSelect={(id) => {
              onChange({ ...form, productId: id });
              setPicking(false);
            }}
            onBack={() => setPicking(false)}
            onClose={onClose}
          />
        )}
        <div className="sc-editor__view" hidden={picking}>
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
              <div className="sc-link">
                <span className="sc-link__label">
                  {story ? 'Bağlantılı ürün' : 'Bağlantılı ürün (isteğe bağlı)'}
                </span>
                <div
                  className={`sc-link__tile${linked ? ' has-value' : ''}${
                    missing ? ' is-missing' : ''
                  }`}
                >
                  <button
                    type="button"
                    ref={linkButton}
                    className="sc-link__open"
                    aria-label={
                      linked
                        ? `Bağlantılı ürün: ${linked.name}. Değiştir`
                        : 'Bağlantılı ürün seç'
                    }
                    onClick={() => setPicking(true)}
                  >
                    {linked ? (
                      <ProductThumb product={linked} />
                    ) : (
                      <span className="sc-link__plus" aria-hidden="true">
                        <Plus size={20} />
                      </span>
                    )}
                    <span className="sc-link__text">
                      <strong>{linked ? linked.name : 'Ürün seç'}</strong>
                      <small>
                        {linked
                          ? linked.groupName || 'Seçili ürün'
                          : story
                            ? 'Hikâye bu ürünü açar'
                            : 'İsteğe bağlı'}
                      </small>
                    </span>
                    <span className="sc-link__change">
                      {linked ? 'Değiştir' : 'Seç'}
                    </span>
                  </button>
                  {linked && !story && (
                    <button
                      type="button"
                      className="sc-link__clear"
                      aria-label="Ürün bağlantısını kaldır"
                      onClick={() => onChange({ ...form, productId: '' })}
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>
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
            </fieldset>
          </div>
          <footer className="sc-editor__footer">
            <Button onClick={onSave} disabled={busy}>
              {busy ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </footer>
        </div>
      </section>
    </AdminOverlay>
  );
}
