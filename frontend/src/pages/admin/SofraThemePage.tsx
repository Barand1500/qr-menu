import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Monitor,
  Smartphone,
  Save,
  ImagePlus,
  RotateCcw,
} from 'lucide-react';
import { Button, Input, PageHeader, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import {
  normalizeSofraConfig,
  sofraCopy,
  type SofraConfig,
  type SofraTextField,
} from '@/lib/sofra';
import {
  SofraWelcomeView,
  SofraMenuView,
} from '@/components/public/sofra/SofraCanvas';
import SofraPreviewFrame from '@/components/admin/SofraPreviewFrame';
import './sofra-editor.css';

type ImageField = 'welcomeImage' | 'menuImage';
interface EditorData {
  config: SofraConfig;
  revision: string;
  restaurant: { name: string; logoUrl?: string | null };
  languages: { code: string; name: string }[];
  groups: { id: number; i18n: Record<string, { name?: string }> }[];
  products: {
    id: number;
    groupId: number;
    price: number | string;
    imageUrl?: string | null;
    i18n: Record<string, { name?: string; description?: string }>;
  }[];
}
export default function SofraThemePage() {
  const [data, setData] = useState<EditorData | null>(null);
  const [draft, setDraft] = useState<SofraConfig>(normalizeSofraConfig({}));
  const [saved, setSaved] = useState('');
  const [page, setPage] = useState<'welcome' | 'menu'>('welcome');
  const [device, setDevice] = useState<'phone' | 'desktop'>('phone');
  const [lang, setLang] = useState('tr');
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<Partial<Record<ImageField, File>>>({});
  const [message, setMessage] = useState<{
    error: boolean;
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [stageWidth, setStageWidth] = useState(800);
  const [stageHeight, setStageHeight] = useState(650);
  const [activeGroup, setActiveGroup] = useState<number | null>(null);
  const [previewSearch, setPreviewSearch] = useState('');
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const imageFieldRef = useRef<ImageField>('welcomeImage');
  const urlsRef = useRef<Partial<Record<ImageField, string>>>({});
  const savingRef = useRef(false);
  const dirty =
    JSON.stringify(draft) !== saved || Object.keys(pending).length > 0;

  async function load() {
    setLoading(true);
    try {
      const res = await api<EditorData>('/api/admin/theme-settings');
      const config = normalizeSofraConfig(res.config);
      setData(res);
      setDraft(config);
      setSaved(JSON.stringify(config));
      setMessage(null);
      setLang((prev) =>
        res.languages.some((l) => l.code === prev)
          ? prev
          : res.languages[0]?.code || 'tr',
      );
    } catch (err) {
      setMessage({
        error: true,
        text: err instanceof Error ? err.message : 'Tema yüklenemedi.',
      });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => {
      setStageWidth(entry.contentRect.width);
      setStageHeight(entry.contentRect.height);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [loading]);
  useEffect(
    () => () =>
      Object.values(urlsRef.current).forEach((url) => URL.revokeObjectURL(url)),
    [],
  );
  useEffect(() => {
    if (!data || !dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const leaving = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest?.(
        'a[href]',
      ) as HTMLAnchorElement | null;
      if (
        !anchor ||
        anchor.target === '_blank' ||
        anchor.pathname === window.location.pathname
      )
        return;
      if (
        !window.confirm(
          'Kaydedilmemiş değişiklikler var. Sayfadan ayrılmak istiyor musunuz?',
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', leaving, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', leaving, true);
    };
  }, [dirty, data]);

  function editText(field: SofraTextField, value: string) {
    const locale = lang.toLowerCase();
    setDraft((prev) =>
      sofraCopy(prev, lang)[field] === value
        ? prev
        : {
            ...prev,
            texts: {
              ...prev.texts,
              [locale]: { ...prev.texts[locale], [field]: value },
            },
          },
    );
    setMessage(null);
  }
  function chooseImage(field: ImageField) {
    imageFieldRef.current = field;
    imageRef.current?.click();
  }
  function changeImage(file?: File) {
    if (!file) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setMessage({
        error: true,
        text: 'En fazla 5 MB boyutunda PNG, JPG veya WebP görsel seçin.',
      });
      return;
    }
    const field = imageFieldRef.current;
    if (urlsRef.current[field]) URL.revokeObjectURL(urlsRef.current[field]!);
    const url = URL.createObjectURL(file);
    urlsRef.current[field] = url;
    setPending((prev) => ({ ...prev, [field]: file }));
    setDraft((prev) => ({ ...prev, [field]: url }));
    setMessage(null);
  }
  async function save() {
    if (!data || savingRef.current || !dirty) return;
    savingRef.current = true;
    setSaving(true);
    setMessage(null);
    try {
      const config = { ...draft };
      for (const field of ['welcomeImage', 'menuImage'] as const) {
        const file = pending[field];
        if (!file) continue;
        const form = new FormData();
        form.append('image', file);
        const result = await api<{ imageUrl: string }>(
          '/api/admin/theme-settings/image',
          {
            method: 'POST',
            body: form,
          },
        );
        config[field] = result.imageUrl;
      }
      const result = await api<{ config: SofraConfig; revision: string }>(
        '/api/admin/theme-settings',
        {
          method: 'PUT',
          body: JSON.stringify({
            config: normalizeSofraConfig(config),
            revision: data.revision,
          }),
        },
      );
      const next = normalizeSofraConfig(result.config);
      setData((prev) =>
        prev ? { ...prev, config: next, revision: result.revision } : prev,
      );
      setDraft(next);
      setSaved(JSON.stringify(next));
      setPending({});
      Object.values(urlsRef.current).forEach((url) => URL.revokeObjectURL(url));
      urlsRef.current = {};
      setMessage({
        error: false,
        text: 'Kaydedildi. Tema artık bu haliyle yayında.',
      });
    } catch (err) {
      setMessage({
        error: true,
        text:
          err instanceof Error
            ? err.message
            : 'Kaydedilemedi. Taslağınız korunuyor.',
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  function discard() {
    if (
      !data ||
      !window.confirm('Kaydedilmemiş değişiklikler geri alınsın mı?')
    )
      return;
    Object.values(urlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current = {};
    setDraft(normalizeSofraConfig(data.config));
    setPending({});
    setMessage(null);
  }
  if (loading) return <Spinner />;
  if (!data)
    return (
      <div role="alert">
        <p>{message?.text}</p>
        <Button onClick={() => void load()}>Tekrar dene</Button>
      </div>
    );
  const width = device === 'phone' ? 390 : 1280;
  const height = device === 'phone' ? 844 : 800;
  const scale = Math.min(
    1,
    Math.max(
      0.1,
      Math.min((stageWidth - 32) / width, (stageHeight - 32) / height),
    ),
  );
  const groups = data.groups.map((g) => ({
    id: g.id,
    name: g.i18n[lang]?.name || g.i18n.tr?.name || 'Grup',
  }));
  const products = data.products.map((p) => ({
    id: p.id,
    groupId: p.groupId,
    name: p.i18n[lang]?.name || p.i18n.tr?.name || 'Ürün',
    description: p.i18n[lang]?.description || p.i18n.tr?.description || '',
    price: Number(p.price),
    imageUrl: p.imageUrl,
  }));
  const languages = data.languages.length
    ? data.languages
    : [{ code: 'tr', name: 'Türkçe' }];
  const copy = sofraCopy(draft, lang);
  const fields: { key: SofraTextField; label: string; multiline?: boolean }[] =
    page === 'welcome'
      ? [
          { key: 'welcomeTitle', label: 'Ana başlık', multiline: true },
          {
            key: 'welcomeSubtitle',
            label: 'Karşılama yazısı',
            multiline: true,
          },
          { key: 'enterLabel', label: 'Menüye giriş düğmesi' },
          { key: 'sealText', label: 'Dekoratif yazı' },
          { key: 'footerText', label: 'Alt yazı' },
        ]
      : [
          { key: 'menuTitle', label: 'Menü başlığı' },
          { key: 'menuEyebrow', label: 'Menü üst yazısı' },
          { key: 'picksLabel', label: 'Önerilen ürünler başlığı' },
          { key: 'footerText', label: 'Alt yazı' },
        ];
  const previewProducts = products.filter(
    (p) =>
      (activeGroup === null || p.groupId === activeGroup) &&
      (!previewSearch.trim() ||
        `${p.name} ${p.description}`
          .toLocaleLowerCase(lang)
          .includes(previewSearch.trim().toLocaleLowerCase(lang))),
  );
  const editing = {
    onTextEdit: editText,
    onImageEdit: chooseImage,
    onBrandEdit: (value: string) =>
      setDraft((prev) =>
        value === (prev.brandName || data.restaurant.name)
          ? prev
          : { ...prev, brandName: value },
      ),
  };
  return (
    <div className="sofra-editor">
      <PageHeader
        title="Tema Ayarları"
        actions={
          <>
            <span className={`sofra-editor-status${dirty ? ' is-dirty' : ''}`}>
              {dirty ? 'Kaydedilmemiş değişiklikler' : 'Yayındaki tasarım'}
            </span>
            <Button disabled={!dirty || saving} onClick={() => void save()}>
              <Save size={16} />
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </>
        }
      />
      <div className="sofra-editor-toolbar">
        <div className="sofra-editor-segments" aria-label="Düzenlenecek ekran">
          <button
            className={page === 'welcome' ? 'is-active' : ''}
            onClick={() => setPage('welcome')}
            disabled={saving}
          >
            Karşılama
          </button>
          <button
            className={page === 'menu' ? 'is-active' : ''}
            onClick={() => setPage('menu')}
            disabled={saving}
          >
            Menü
          </button>
        </div>
        <div className="sofra-editor-devices">
          <button
            aria-label="Telefon önizlemesi"
            aria-pressed={device === 'phone'}
            disabled={saving}
            onClick={() => setDevice('phone')}
          >
            <Smartphone size={18} />
          </button>
          <button
            aria-label="Masaüstü önizlemesi"
            aria-pressed={device === 'desktop'}
            disabled={saving}
            onClick={() => setDevice('desktop')}
          >
            <Monitor size={18} />
          </button>
        </div>
        <label className="sofra-editor-lang">
          Metin dili
          <select
            aria-label="Düzenleme dili"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            disabled={saving}
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="sofra-editor-discard"
          onClick={discard}
          disabled={!dirty || saving}
        >
          <RotateCcw size={14} /> Değişiklikleri geri al
        </button>
      </div>
      {message && (
        <p
          className={`sofra-editor-message${message.error ? ' is-error' : ''}`}
          role={message.error ? 'alert' : 'status'}
        >
          {!message.error && <Check size={16} />}
          {message.text}
        </p>
      )}
      <div className="sofra-editor-workspace">
        <section className="sofra-editor-preview" aria-label="Canlı taslak">
          <div className="sofra-editor-preview-meta">
            <span>
              {device === 'phone' ? 'Telefon' : 'Masaüstü'} · {width} × {height}
            </span>
            <span>%{Math.round(scale * 100)}</span>
          </div>
          <div className="sofra-editor-stage" ref={stageRef} inert={saving}>
            <SofraPreviewFrame width={width} height={height} scale={scale}>
              {page === 'welcome' ? (
                <SofraWelcomeView
                  config={draft}
                  restaurant={data.restaurant}
                  lang={lang}
                  languages={languages}
                  tableLabel="Masa 08"
                  {...editing}
                />
              ) : (
                <SofraMenuView
                  config={draft}
                  restaurant={data.restaurant}
                  lang={lang}
                  groups={groups}
                  products={previewProducts}
                  activeGroup={activeGroup}
                  onGroupChange={setActiveGroup}
                  search={previewSearch}
                  onSearchChange={setPreviewSearch}
                  {...editing}
                />
              )}
            </SofraPreviewFrame>
          </div>
        </section>
        <aside
          className="sofra-editor-inspector"
          aria-label="Tema düzenleme alanları"
        >
          <div className="sofra-editor-inspector-head">
            <h2>{page === 'welcome' ? 'Karşılama' : 'Menü'} yazıları</h2>
            <span>{languages.find((l) => l.code === lang)?.name || lang}</span>
          </div>
          <div className="sofra-editor-fields">
            {fields.map((field) => (
              <label
                key={`${lang}-${field.key}`}
                className="sofra-editor-field"
              >
                <span>{field.label}</span>
                {field.multiline ? (
                  <textarea
                    aria-label={field.label}
                    rows={3}
                    value={copy[field.key]}
                    disabled={saving}
                    maxLength={400}
                    onChange={(e) => editText(field.key, e.target.value)}
                  />
                ) : (
                  <input
                    aria-label={field.label}
                    value={copy[field.key]}
                    disabled={saving}
                    maxLength={field.key === 'enterLabel' ? 60 : 400}
                    onChange={(e) => editText(field.key, e.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
          <div className="sofra-editor-details">
            <Input
              label="Görünen işletme adı"
              value={draft.brandName}
              placeholder={data.restaurant.name}
              disabled={saving}
              maxLength={100}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, brandName: e.target.value }))
              }
            />
            <Input
              label="Çalışma saatleri (isteğe bağlı)"
              value={draft.openingHours}
              disabled={saving}
              maxLength={150}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, openingHours: e.target.value }))
              }
            />
            <button
              onClick={() =>
                chooseImage(page === 'welcome' ? 'welcomeImage' : 'menuImage')
              }
              disabled={saving}
            >
              <ImagePlus size={18} />
              {page === 'welcome' ? 'Karşılama fotoğrafı' : 'Menü fotoğrafı'}
            </button>
          </div>
          <p className="sofra-editor-note">
            Değişiklikler Kaydet dediğinizde yayınlanır. Ürün adları ve fiyatlar
            Ürünler sayfasından yönetilir. Önizlemedeki ürünler ve masa numarası
            örnektir.
          </p>
        </aside>
      </div>
      <input
        ref={imageRef}
        type="file"
        className="hidden"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Sofra fotoğrafı seç"
        onChange={(e) => {
          changeImage(e.target.files?.[0]);
          e.currentTarget.value = '';
        }}
      />
    </div>
  );
}
