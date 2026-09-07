import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Maximize2, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { imageUrl } from '@/lib/api';
import {
  ABOUT_TEMPLATE_META,
  ABOUT_TEMPLATES,
  applyAboutTemplate,
  type AboutPageConfig,
  type AboutTemplateId,
} from '@/lib/aboutPage';
import AboutPageView from '@/components/public/AboutPageView';
import '@/about-page.css';

type Props = {
  open: boolean;
  initial: AboutPageConfig;
  restaurantName: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (config: AboutPageConfig) => Promise<void> | void;
  onCoverUploaded?: (coverUrl: string) => void;
};

export default function AboutPageEditorModal({
  open,
  initial,
  restaurantName,
  saving,
  onClose,
  onSave,
  onCoverUploaded,
}: Props) {
  const [draft, setDraft] = useState<AboutPageConfig>(initial);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  if (!open) return null;

  function pickTemplate(id: AboutTemplateId) {
    setDraft((d) => applyAboutTemplate(d, id, true));
  }

  async function onCoverFile(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('cover', file);
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch('/api/admin/settings/about-cover', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error('Yükleme başarısız');
      const data = (await res.json()) as { coverUrl: string };
      setDraft((d) => ({ ...d, coverUrl: data.coverUrl }));
      onCoverUploaded?.(data.coverUrl);
    } catch {
      /* ignore */
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="about-editor" role="dialog" aria-modal="true" aria-labelledby="about-editor-title">
      <button type="button" className="about-editor__scrim" aria-label="Kapat" onClick={onClose} />
      <div className="about-editor__panel">
        <header className="about-editor__head">
          <div>
            <p className="about-editor__eyebrow">
              <Maximize2 className="w-3.5 h-3.5" /> Hakkımızda
            </p>
            <h2 id="about-editor-title">Sayfa özelleştirme</h2>
            <p>Kapak görseli, şablon ve metinleri buradan düzenleyin. Önizleme sağda.</p>
          </div>
          <button type="button" className="about-editor__close" onClick={onClose} aria-label="Kapat">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="about-editor__grid">
          <div className="about-editor__form">
            <section className="about-editor__block">
              <p className="about-editor__label">Kapak görseli</p>
              <button
                type="button"
                className="about-editor__cover"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void onCoverFile(e.target.files?.[0] || null)}
                />
                {draft.coverUrl ? (
                  <img src={imageUrl(draft.coverUrl)} alt="" />
                ) : (
                  <span className="about-editor__cover-empty">
                    <ImagePlus className="w-7 h-7" />
                    {uploading ? 'Yükleniyor…' : 'Vitrin gibi kapak yükle'}
                  </span>
                )}
              </button>
              {draft.coverUrl ? (
                <button
                  type="button"
                  className="about-editor__cover-clear"
                  onClick={() => setDraft((d) => ({ ...d, coverUrl: null }))}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Kapağı kaldır
                </button>
              ) : null}
            </section>

            <section className="about-editor__block">
              <p className="about-editor__label">Şablon</p>
              <div className="about-editor__templates">
                {ABOUT_TEMPLATES.map((id) => {
                  const meta = ABOUT_TEMPLATE_META[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`about-editor__tpl${draft.template === id ? ' is-active' : ''}`}
                      onClick={() => pickTemplate(id)}
                    >
                      <strong>{meta.label}</strong>
                      <span>{meta.blurb}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="about-editor__block">
              <label className="about-editor__field">
                <span>Başlık</span>
                <input
                  value={draft.headline}
                  onChange={(e) => setDraft((d) => ({ ...d, headline: e.target.value }))}
                  maxLength={80}
                  placeholder="Örn. Hikâyemiz"
                />
              </label>
              <label className="about-editor__field">
                <span>Hakkında metni</span>
                <textarea
                  value={draft.body}
                  onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                  rows={7}
                  maxLength={4000}
                  placeholder="Restoranınızı anlatın…"
                />
              </label>
              {draft.template === 'highlights' ? (
                <div className="about-editor__highlights">
                  <p className="about-editor__label">3 vurgu satırı</p>
                  {draft.highlights.map((h, i) => (
                    <input
                      key={i}
                      value={h}
                      maxLength={80}
                      placeholder={`${i + 1}. satır`}
                      onChange={(e) =>
                        setDraft((d) => {
                          const next = [...d.highlights];
                          next[i] = e.target.value;
                          return { ...d, highlights: next };
                        })
                      }
                    />
                  ))}
                </div>
              ) : null}
            </section>
          </div>

          <aside className="about-editor__preview" aria-label="Önizleme">
            <p className="about-editor__preview-label">Önizleme</p>
            <AboutPageView
              config={draft}
              restaurantName={restaurantName}
              preview
            />
          </aside>
        </div>

        <footer className="about-editor__foot">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Vazgeç
          </Button>
          <Button type="button" onClick={() => void onSave(draft)} disabled={saving || uploading}>
            {saving ? 'Kaydediliyor…' : 'Uygula'}
          </Button>
        </footer>
      </div>
    </div>
  );
}
