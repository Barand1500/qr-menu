import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CirclePlay,
  Eye,
  EyeOff,
  ImagePlus,
  Monitor,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { getActiveLanguages } from '@/lib/languages';
import { useDemoData } from '@/contexts/DemoDataContext';
import { Button, PageHeading, Spinner } from '@/components/ui';
import AdminOverlay from '@/components/admin/AdminOverlay';
import AdminToast, {
  type AdminToastNotice,
} from '@/components/admin/AdminToast';
import GroupsDialog from '@/components/admin/groups/GroupsDialog';
import ShowcaseCard from '@/components/admin/showcase/ShowcaseCard';
import ShowcaseEditor from '@/components/admin/showcase/ShowcaseEditor';
import {
  mediaForm,
  mediaReady,
  type Language,
  type MediaEditor,
  type MediaType,
  type ProductOption,
  type ShowcaseItem,
} from '@/components/admin/showcase/types';
import '@/components/admin/showcase/showcase.css';

async function allProducts(signal?: AbortSignal) {
  const products: ProductOption[] = [];
  for (let page = 1; ; page++) {
    const result = await api<{
      data: ProductOption[];
      pagination?: { total: number };
    }>(`/api/admin/products?limit=200&page=${page}`, { signal });
    products.push(...result.data);
    if (
      !result.data.length ||
      products.length >= (result.pagination?.total ?? products.length)
    )
      return products;
  }
}
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'İşlem tamamlanamadı. Tekrar deneyin.';

export default function ShowcasePage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const { demoEnabled } = useDemoData();
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState<MediaType>('banner');
  const [editor, setEditor] = useState<MediaEditor | null>(null),
    [preview, setPreview] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false),
    lock = useRef(false);
  const [notice, setNotice] = useState<AdminToastNotice>(null);
  const [actions, setActions] = useState<{
    item: ShowcaseItem;
    point: { x: number; y: number };
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShowcaseItem | null>(null);
  const [drag, setDrag] = useState<number | null>(null),
    [drop, setDrop] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);
  const refocusAdd = useRef(false);
  const reload = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError('');
    try {
      const [data, langs, productList] = await Promise.all([
        api<ShowcaseItem[]>('/api/admin/showcase', { signal }),
        api<Language[]>('/api/admin/languages', { signal }),
        allProducts(signal),
      ]);
      if (signal?.aborted) return;
      setItems(data);
      setProducts(productList);
      setLanguages(getActiveLanguages(langs));
    } catch (error) {
      if (!signal?.aborted) setLoadError(message(error));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    void reload(abort.signal);
    return () => abort.abort();
  }, [reload]);
  useEffect(() => {
    if (!editor?.file) {
      setPreview(editor?.item?.imageUrl || null);
      return;
    }
    const url = URL.createObjectURL(editor.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [editor?.file, editor?.item?.imageUrl]);
  const visible = useMemo(
    () =>
      items
        .filter((i) => i.displayType === activeTab)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    [items, activeTab],
  );
  // After a delete the add button gets focus, but only once it is enabled again.
  useEffect(() => {
    if (busy || !refocusAdd.current) return;
    refocusAdd.current = false;
    pageRef.current
      ?.querySelector<HTMLButtonElement>('.sc-head > button')
      ?.focus({ preventScroll: true });
  }, [busy]);
  function open(item?: ShowcaseItem) {
    if (lock.current) return;
    setActions(null);
    setFormError('');
    setEditor({
      type: item?.displayType || activeTab,
      item: item || null,
      form: mediaForm(item),
      file: null,
    });
  }
  function close() {
    if (!lock.current) {
      setEditor(null);
      setFormError('');
    }
  }
  function begin() {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    return true;
  }
  function end() {
    lock.current = false;
    setBusy(false);
  }
  function merge(item: ShowcaseItem) {
    setItems((list) =>
      list.some((i) => i.id === item.id)
        ? list.map((i) => (i.id === item.id ? item : i))
        : [...list, item],
    );
  }
  function chooseFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) {
      setFormError('8 MB veya daha küçük bir görsel seçin.');
      return;
    }
    setFormError('');
    setEditor((value) => (value ? { ...value, file } : value));
  }
  async function save() {
    if (!editor || lock.current) return;
    if (!editor.file && !editor.item?.imageUrl) {
      setFormError('Menüde göstermek için bir görsel seçin.');
      return;
    }
    if (editor.type === 'story' && !editor.form.productId) {
      setFormError('Hikâyenin açacağı ürünü seçin.');
      return;
    }
    if (
      editor.type === 'story' &&
      (!Number.isInteger(editor.form.durationSeconds) ||
        editor.form.durationSeconds < 2 ||
        editor.form.durationSeconds > 30)
    ) {
      setFormError('Gösterim süresi 2–30 saniye arasında olmalı.');
      return;
    }
    if (!begin()) return;
    setFormError('');
    let metadataSaved = false;
    try {
      const form = editor.form;
      const payload = {
        name:
          form.name.trim() ||
          products.find((p) => String(p.id) === form.productId)?.name ||
          (editor.type === 'story' ? 'Hikâye' : 'Afiş'),
        productId: form.productId ? Number(form.productId) : null,
        isActive: form.isActive,
        displayType: editor.type,
        durationSeconds: form.durationSeconds,
        translations:
          editor.type === 'banner'
            ? languages.map((l) => ({
                languageId: l.id,
                title1: form.translations[l.code]?.title1 || '',
                title2: form.translations[l.code]?.title2 || '',
              }))
            : [],
      };
      let saved = await api<ShowcaseItem>(
        editor.item
          ? `/api/admin/showcase/${editor.item.id}`
          : '/api/admin/showcase',
        { method: editor.item ? 'PUT' : 'POST', body: JSON.stringify(payload) },
      );
      metadataSaved = true;
      merge(saved);
      // Retain the created ID before upload: retry updates the same record.
      setEditor((value) => (value ? { ...value, item: saved } : value));
      if (editor.file) {
        const body = new FormData();
        body.append('image', editor.file);
        saved = await api<ShowcaseItem>(
          `/api/admin/showcase/${saved.id}/image`,
          { method: 'POST', body },
        );
        merge(saved);
      }
      setEditor(null);
      setNotice({ error: false, text: 'Vitrin görseli kaydedildi.' });
    } catch (error) {
      const text = metadataSaved
        ? `Bilgiler kaydedildi, görsel yüklenemedi. Tekrar Kaydet'e basabilirsiniz. ${message(error)}`
        : message(error);
      setFormError(text);
      setNotice({ error: true, text });
    } finally {
      end();
    }
  }
  async function toggle(item: ShowcaseItem) {
    if (!begin()) return;
    setActions(null);
    try {
      const updated = await api<ShowcaseItem>(
        `/api/admin/showcase/${item.id}/toggle`,
        { method: 'PATCH' },
      );
      merge(updated);
      setNotice({
        error: false,
        text: updated.isActive
          ? `${item.name} menüde gösteriliyor.`
          : `${item.name} menüde gizlendi.`,
      });
    } catch (error) {
      setNotice({ error: true, text: message(error) });
    } finally {
      end();
    }
  }
  async function reorder(id: number, targetId: number) {
    setDrag(null);
    setDrop(null);
    dragRef.current = null;
    const from = visible.findIndex((i) => i.id === id),
      to = visible.findIndex((i) => i.id === targetId);
    if (from < 0 || to < 0 || from === to || !begin()) return;
    setActions(null);
    const before = items,
      list = [...visible];
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    const ordered = list.map((item, index) => ({
      ...item,
      sortOrder: index + 1,
    }));
    setItems([...items.filter((i) => i.displayType !== activeTab), ...ordered]);
    try {
      await api('/api/admin/showcase/reorder/bulk', {
        method: 'PUT',
        body: JSON.stringify({
          items: ordered.map(({ id, sortOrder }) => ({ id, sortOrder })),
        }),
      });
      setNotice({ error: false, text: 'Görsellerin sırası güncellendi.' });
    } catch (error) {
      setItems(before);
      setNotice({ error: true, text: message(error) });
    } finally {
      end();
    }
  }
  function move(item: ShowcaseItem, direction: -1 | 1) {
    const index = visible.findIndex((i) => i.id === item.id);
    const target = visible[index + direction];
    if (target) void reorder(item.id, target.id);
  }
  async function remove() {
    if (!deleteTarget || !begin()) return;
    try {
      await api(`/api/admin/showcase/${deleteTarget.id}`, { method: 'DELETE' });
      setItems((list) => list.filter((i) => i.id !== deleteTarget.id));
      setDeleteTarget(null);
      refocusAdd.current = true;
      setNotice({ error: false, text: 'Vitrin görseli silindi.' });
    } catch (error) {
      setFormError(message(error));
      setNotice({ error: true, text: message(error) });
    } finally {
      end();
    }
  }
  return (
    <div className="sc-page" ref={pageRef}>
      <AdminToast
        notice={notice}
        onClose={() => setNotice(null)}
        className={editor || deleteTarget ? 'sc-modal-toast' : ''}
      />
      <header className="sc-head">
        <PageHeading title="Vitrin Görselleri" />
        <Button
          onClick={() => open()}
          disabled={busy || loading || Boolean(loadError)}
        >
          <Plus size={18} />
          <span>{activeTab === 'banner' ? 'Afiş ekle' : 'Hikâye ekle'}</span>
        </Button>
      </header>
      <nav className="sc-tabs" aria-label="Vitrin türü">
        {(['banner', 'story'] as const).map((type) => (
          <button
            type="button"
            key={type}
            aria-pressed={activeTab === type}
            disabled={busy}
            onClick={() => {
              setActiveTab(type);
              setDrag(null);
              setDrop(null);
              dragRef.current = null;
            }}
            className={activeTab === type ? 'is-active' : ''}
          >
            {type === 'banner' ? (
              <Monitor size={18} />
            ) : (
              <CirclePlay size={18} />
            )}
            <span>{type === 'banner' ? 'Afişler' : 'Hikâyeler'}</span>
            <small>{items.filter((i) => i.displayType === type).length}</small>
          </button>
        ))}
      </nav>
      {demoEnabled && (
        <p className="sc-demo">
          Örnek müşteri görünümü açık; burada gerçek görselleri düzenliyorsun.
        </p>
      )}
      {loading ? (
        <Spinner />
      ) : loadError ? (
        <div className="sc-empty" role="alert">
          <p>{loadError}</p>
          <Button onClick={() => void reload()}>Tekrar dene</Button>
        </div>
      ) : (
        <>
          <div className="sc-section-line">
            <span>
              {activeTab === 'banner'
                ? 'Menünün vitrini'
                : 'Bir dokunuşla ürüne'}
            </span>
            <small>
              {visible.filter((i) => i.isActive && mediaReady(i)).length}{' '}
              yayında
            </small>
          </div>
          {!visible.length ? (
            <div className="sc-empty">
              <ImagePlus size={34} />
              <h2>
                {activeTab === 'banner'
                  ? 'İlk izlenim, senin fotoğrafın.'
                  : 'Menünün küçük hikâyeleri.'}
              </h2>
              <Button onClick={() => open()}>
                <Plus size={17} />
                {activeTab === 'banner'
                  ? 'İlk afişi ekle'
                  : 'İlk hikâyeyi ekle'}
              </Button>
            </div>
          ) : (
            <div className={`sc-grid sc-grid--${activeTab}`}>
              {visible.map((item, index) => (
                <ShowcaseCard
                  key={item.id}
                  item={item}
                  index={index}
                  busy={busy}
                  dragging={drag === item.id}
                  dropTarget={drop === item.id && drag !== item.id}
                  onEdit={() => open(item)}
                  onToggle={() => void toggle(item)}
                  onActions={(point) => setActions({ item, point })}
                  onDrag={(id) => {
                    dragRef.current = id;
                    setDrag(id);
                    setDrop(null);
                  }}
                  onDrop={(id, commit) => {
                    if (dragRef.current === null) return;
                    if (commit) void reorder(dragRef.current, id);
                    else setDrop(id);
                  }}
                  onMove={(direction) => move(item, direction)}
                />
              ))}
            </div>
          )}
        </>
      )}
      {editor && (
        <ShowcaseEditor
          editor={editor}
          languages={languages}
          products={products}
          preview={preview}
          busy={busy}
          error={formError}
          onChange={(form) =>
            setEditor((value) => (value ? { ...value, form } : value))
          }
          onFile={chooseFile}
          onClose={close}
          onSave={() => void save()}
        />
      )}
      <GroupsDialog
        open={Boolean(actions)}
        title={actions?.item.name || 'Görsel işlemleri'}
        onClose={() => setActions(null)}
        className="ag-actions sc-actions"
        anchor={actions?.point}
      >
        {actions && (
          <div className="ag-action-list">
            <button type="button" onClick={() => open(actions.item)}>
              <Pencil size={18} />
              Düzenle
            </button>
            <button type="button" onClick={() => void toggle(actions.item)}>
              {actions.item.isActive ? <EyeOff size={18} /> : <Eye size={18} />}
              {actions.item.isActive ? 'Menüde gizle' : 'Menüde göster'}
            </button>
            <button
              type="button"
              disabled={visible[0]?.id === actions.item.id}
              onClick={() => move(actions.item, -1)}
            >
              <ArrowUp size={18} />
              Öne taşı
            </button>
            <button
              type="button"
              disabled={visible.at(-1)?.id === actions.item.id}
              onClick={() => move(actions.item, 1)}
            >
              <ArrowDown size={18} />
              Geri taşı
            </button>
            <button
              type="button"
              className="sc-danger"
              onClick={() => {
                setDeleteTarget(actions.item);
                setFormError('');
                setActions(null);
              }}
            >
              <Trash2 size={18} />
              Sil
            </button>
          </div>
        )}
      </GroupsDialog>
      {deleteTarget && (
        <AdminOverlay
          label="Vitrin görselini sil"
          busy={busy}
          onClose={() => {
            if (!lock.current) setDeleteTarget(null);
          }}
          className="sc-overlay"
        >
          <section className="relative sc-editor sc-delete">
            <header className="sc-editor__head">
              <h2>Bu görsel silinsin mi?</h2>
              <button
                type="button"
                className="sc-icon"
                aria-label="Pencereyi kapat"
                disabled={busy}
                onClick={() => setDeleteTarget(null)}
              >
                <X size={20} />
              </button>
            </header>
            <div className="sc-editor__scroll">
              <p>{deleteTarget.name}</p>
              <small>Menüden kaldırılır. Bağlı ürün silinmez.</small>
              {formError && (
                <p className="sc-error" role="alert">
                  {formError}
                </p>
              )}
            </div>
            <footer className="sc-editor__footer">
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => void remove()}
              >
                {busy ? 'Siliniyor…' : 'Görseli sil'}
              </Button>
            </footer>
          </section>
        </AdminOverlay>
      )}
    </div>
  );
}
