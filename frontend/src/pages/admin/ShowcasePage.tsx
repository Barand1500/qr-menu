import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  EyeOff,
  Eye,
  ChevronUp,
  ChevronDown,
  Trash2,
  Monitor,
  Smartphone,
} from 'lucide-react';
import { api, imageUrl } from '@/lib/api';
import { getActiveLanguages, type AdminLanguage } from '@/lib/languages';
import { useDemoData } from '@/contexts/DemoDataContext';
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from '@/components/ui';
import ShowcaseModal, {
  type ShowcaseFormState,
  type ShowcaseTranslationFields,
} from '@/components/ShowcaseModal';
import StoryModal, { type StoryFormState } from '@/components/StoryModal';

interface ShowcaseItem {
  id: number;
  name: string;
  productId: number | null;
  productName: string | null;
  imageUrl?: string | null;
  displayType: 'banner' | 'story';
  sortOrder: number;
  isActive: boolean;
  durationSeconds?: number;
  translations: {
    languageId: number;
    languageCode: string;
    title1: string | null;
    title2: string | null;
  }[];
}

interface ProductOption {
  id: number;
  name: string;
}

interface Language extends AdminLanguage {}

type VitrinTab = 'banner' | 'story';

const emptyBannerForm = (): ShowcaseFormState => ({
  name: '',
  productId: '',
  isActive: true,
  translations: {},
});

const emptyStoryForm = (): StoryFormState => ({
  name: '',
  productId: '',
  isActive: true,
  durationSeconds: 5,
});

function buildBannerForm(item: ShowcaseItem): ShowcaseFormState {
  const translations: Record<string, ShowcaseTranslationFields> = {};
  for (const t of item.translations) {
    translations[t.languageCode] = {
      title1: t.title1 || '',
      title2: t.title2 || '',
    };
  }
  return {
    name: item.name,
    productId: item.productId?.toString() || '',
    isActive: item.isActive,
    translations,
  };
}

function buildStoryForm(item: ShowcaseItem): StoryFormState {
  return {
    name: item.name,
    productId: item.productId?.toString() || '',
    isActive: item.isActive,
    durationSeconds: item.durationSeconds ?? 5,
  };
}

export default function ShowcasePage() {
  const { demoEnabled } = useDemoData();
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<VitrinTab>('banner');

  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [bannerMode, setBannerMode] = useState<'create' | 'edit'>('create');
  const [editingBanner, setEditingBanner] = useState<ShowcaseItem | null>(null);
  const [bannerForm, setBannerForm] = useState<ShowcaseFormState>(emptyBannerForm());
  const [bannerImageFile, setBannerImageFile] = useState<File | null>(null);
  const [bannerImagePreview, setBannerImagePreview] = useState<string | null>(null);

  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [storyMode, setStoryMode] = useState<'create' | 'edit'>('create');
  const [editingStory, setEditingStory] = useState<ShowcaseItem | null>(null);
  const [storyForm, setStoryForm] = useState<StoryFormState>(emptyStoryForm());
  const [storyImageFile, setStoryImageFile] = useState<File | null>(null);
  const [storyImagePreview, setStoryImagePreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [showcase, productList, langs] = await Promise.all([
      api<ShowcaseItem[]>('/api/admin/showcase'),
      api<{ data: { id: number; name: string }[] }>('/api/admin/products?limit=200'),
      api<Language[]>('/api/admin/languages'),
    ]);
    setItems(showcase);
    setProducts(productList.data);
    setLanguages(getActiveLanguages(langs));
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const banners = useMemo(
    () =>
      items
        .filter((i) => i.displayType === 'banner')
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [items]
  );

  const stories = useMemo(
    () =>
      items
        .filter((i) => i.displayType === 'story')
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [items]
  );

  useEffect(() => {
    if (!bannerImageFile) {
      setBannerImagePreview(editingBanner?.imageUrl ? imageUrl(editingBanner.imageUrl) : null);
      return;
    }
    const url = URL.createObjectURL(bannerImageFile);
    setBannerImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [bannerImageFile, editingBanner?.imageUrl]);

  useEffect(() => {
    if (!storyImageFile) {
      setStoryImagePreview(editingStory?.imageUrl ? imageUrl(editingStory.imageUrl) : null);
      return;
    }
    const url = URL.createObjectURL(storyImageFile);
    setStoryImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [storyImageFile, editingStory?.imageUrl]);

  async function uploadImage(id: number, file: File) {
    const fd = new FormData();
    fd.append('image', file);
    await fetch(`/api/admin/showcase/${id}/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: fd,
    });
  }

  function openCreateBanner() {
    setBannerMode('create');
    setEditingBanner(null);
    setBannerForm(emptyBannerForm());
    setBannerImageFile(null);
    setBannerImagePreview(null);
    setBannerModalOpen(true);
  }

  function openEditBanner(item: ShowcaseItem) {
    setBannerMode('edit');
    setEditingBanner(item);
    setBannerForm(buildBannerForm(item));
    setBannerImageFile(null);
    setBannerImagePreview(item.imageUrl ? imageUrl(item.imageUrl) : null);
    setBannerModalOpen(true);
  }

  function openCreateStory() {
    setStoryMode('create');
    setEditingStory(null);
    setStoryForm(emptyStoryForm());
    setStoryImageFile(null);
    setStoryImagePreview(null);
    setStoryModalOpen(true);
  }

  function openEditStory(item: ShowcaseItem) {
    setStoryMode('edit');
    setEditingStory(item);
    setStoryForm(buildStoryForm(item));
    setStoryImageFile(null);
    setStoryImagePreview(item.imageUrl ? imageUrl(item.imageUrl) : null);
    setStoryModalOpen(true);
  }

  async function saveBanner() {
    setSaving(true);
    try {
      const translations = languages.map((l) => ({
        languageId: l.id,
        title1: bannerForm.translations[l.code]?.title1 || '',
        title2: bannerForm.translations[l.code]?.title2 || '',
      }));
      const payload = {
        name: bannerForm.name,
        productId: bannerForm.productId ? Number(bannerForm.productId) : null,
        isActive: bannerForm.isActive,
        displayType: 'banner',
        translations,
      };
      if (editingBanner) {
        await api(`/api/admin/showcase/${editingBanner.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        if (bannerImageFile) await uploadImage(editingBanner.id, bannerImageFile);
      } else {
        const created = await api<ShowcaseItem>('/api/admin/showcase', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (bannerImageFile) await uploadImage(created.id, bannerImageFile);
      }
      setBannerModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveStory() {
    setSaving(true);
    try {
      const payload = {
        name: storyForm.name || 'Hikaye',
        productId: Number(storyForm.productId),
        isActive: storyForm.isActive,
        displayType: 'story',
        durationSeconds: storyForm.durationSeconds,
        translations: [],
      };
      if (editingStory) {
        await api(`/api/admin/showcase/${editingStory.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        if (storyImageFile) await uploadImage(editingStory.id, storyImageFile);
      } else {
        const created = await api<ShowcaseItem>('/api/admin/showcase', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (storyImageFile) await uploadImage(created.id, storyImageFile);
      }
      setStoryModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(item: ShowcaseItem) {
    const next = !item.isActive;
    const snapshot = items;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isActive: next } : i)));
    try {
      await api(`/api/admin/showcase/${item.id}/toggle`, { method: 'PATCH' });
    } catch {
      setItems(snapshot);
      window.alert('Durum güncellenemedi. Lütfen tekrar deneyin.');
    }
  }

  async function moveStory(id: number, direction: -1 | 1) {
    const list = [...stories];
    const idx = list.findIndex((s) => s.id === id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;

    [list[idx], list[swapIdx]] = [list[swapIdx], list[idx]];
    const payload = list.map((s, i) => ({ id: s.id, sortOrder: i + 1 }));
    const snapshot = items;
    setItems((prev) => {
      const others = prev.filter((i) => i.displayType !== 'story');
      const updated = list.map((s, i) => ({ ...s, sortOrder: i + 1 }));
      return [...others, ...updated];
    });
    try {
      await api('/api/admin/showcase/reorder/bulk', {
        method: 'PUT',
        body: JSON.stringify({ items: payload }),
      });
    } catch {
      setItems(snapshot);
      window.alert('Sıralama güncellenemedi. Lütfen tekrar deneyin.');
    }
  }

  async function deleteStory(id: number) {
    if (!window.confirm('Bu hikayeyi silmek istediğinize emin misiniz?')) return;
    try {
      await api(`/api/admin/showcase/${id}`, { method: 'DELETE' });
      await load();
    } catch {
      window.alert('Hikaye silinemedi. Lütfen tekrar deneyin.');
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-5 w-full">
      <PageHeader title="Vitrin Görselleri" />

      {demoEnabled && (
        <div
          className="px-4 py-3 rounded-2xl text-sm font-medium"
          style={{
            background: 'var(--admin-accent-soft)',
            color: 'var(--admin-accent-text)',
            border: '1px dashed var(--admin-accent)',
          }}
        >
          Sahte veri modu aktif — müşteri menüsü önizlemesinde örnek veriler gösterilir. Burada gerçek kayıtları düzenlersiniz.
        </div>
      )}

      <div
        className="flex gap-1 p-1 rounded-xl max-w-md"
        style={{ background: 'var(--admin-input-bg)' }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('banner')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: activeTab === 'banner' ? 'var(--admin-accent)' : 'transparent',
            color:
              activeTab === 'banner'
                ? 'var(--admin-btn-primary-text)'
                : 'var(--admin-text-muted)',
          }}
        >
          <Monitor className="w-4 h-4" />
          Web Banner
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('story')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: activeTab === 'story' ? 'var(--admin-accent)' : 'transparent',
            color:
              activeTab === 'story' ? 'var(--admin-btn-primary-text)' : 'var(--admin-text-muted)',
          }}
        >
          <Smartphone className="w-4 h-4" />
          Mobil Hikayeler
        </button>
      </div>

      {activeTab === 'banner' ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm admin-text-muted max-w-2xl">
              Web/tablet menüsünde üstte görünen geniş banner görselleri. Önerilen boyut 1920×600 px.
            </p>
            <Button onClick={openCreateBanner} className="shrink-0">
              <Plus className="w-4 h-4" />
              Yeni Banner
            </Button>
          </div>

          <Card className="overflow-hidden !p-0">
            <div className="overflow-x-auto admin-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="text-left text-xs uppercase tracking-wide admin-text-muted"
                    style={{ background: 'var(--admin-input-bg)' }}
                  >
                    <th className="py-3.5 px-4 font-semibold w-[120px]">Önizleme</th>
                    <th className="py-3.5 px-4 font-semibold">Adı</th>
                    <th className="py-3.5 px-4 font-semibold hidden md:table-cell">İlgili Ürün</th>
                    <th className="py-3.5 px-4 font-semibold">Durum</th>
                    <th className="py-3.5 px-4 font-semibold w-[100px]">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {banners.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState message="Henüz web banner eklenmemiş" />
                      </td>
                    </tr>
                  ) : (
                    banners.map((item) => (
                      <tr
                        key={item.id}
                        onDoubleClick={() => openEditBanner(item)}
                        className="border-b transition hover:bg-[var(--admin-accent-soft)]/30 admin-table-row--editable cursor-pointer"
                        style={{
                          borderColor: 'var(--admin-card-border)',
                          opacity: item.isActive ? 1 : 0.4,
                        }}
                      >
                        <td className="py-3.5 px-4">
                          {item.imageUrl ? (
                            <img
                              src={imageUrl(item.imageUrl)}
                              alt=""
                              className="w-24 h-14 rounded-xl object-cover"
                            />
                          ) : (
                            <div className="w-24 h-14 rounded-xl bg-[var(--admin-accent-soft)]" />
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-semibold">{item.name}</td>
                        <td className="py-3.5 px-4 admin-text-muted hidden md:table-cell">
                          {item.productName || '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge active={item.isActive} />
                        </td>
                        <td className="py-3.5 px-4" onDoubleClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            <button
                              onClick={() => openEditBanner(item)}
                              className="p-2 rounded-xl hover:bg-[var(--admin-accent-soft)]"
                              style={{ color: 'var(--admin-accent)' }}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggle(item)}
                              className={`p-2 rounded-xl ${
                                item.isActive ? 'text-amber-600' : 'text-emerald-600'
                              }`}
                            >
                              {item.isActive ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm admin-text-muted max-w-2xl">
              Sadece mobil menüde görünür — Instagram hikayesi gibi yuvarlak görseller. Tıklanınca
              bağlı ürüne gider.
            </p>
            <Button onClick={openCreateStory} className="shrink-0">
              <Plus className="w-4 h-4" />
              Yeni Hikaye
            </Button>
          </div>

          <Card className="p-4 sm:p-5">
            {stories.length === 0 ? (
              <EmptyState message="Henüz mobil hikaye eklenmemiş" />
            ) : (
              <div className="admin-stories-list">
                {stories.map((story, index) => (
                  <div
                    key={story.id}
                    onDoubleClick={() => openEditStory(story)}
                    className={`admin-stories-card admin-table-row--editable cursor-pointer ${story.isActive ? '' : 'is-passive'}`}
                  >
                    <div className="admin-stories-card__ring">
                      {story.imageUrl ? (
                        <img src={imageUrl(story.imageUrl)} alt={story.name} />
                      ) : (
                        <div className="admin-stories-card__empty" />
                      )}
                    </div>

                    <div className="admin-stories-card__body">
                      <p className="admin-stories-card__name">{story.name}</p>
                      <p className="admin-stories-card__product">{story.productName || '—'}</p>
                      <span className="admin-stories-card__duration">
                        {story.durationSeconds ?? 5} sn
                      </span>
                    </div>

                    <div className="admin-stories-card__actions" onDoubleClick={(e) => e.stopPropagation()}>
                      <div className="admin-stories-card__reorder">
                        <button
                          type="button"
                          className="admin-stories-card__btn"
                          onClick={() => moveStory(story.id, -1)}
                          disabled={index === 0}
                          title="Yukarı taşı"
                          aria-label="Yukarı taşı"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="admin-stories-card__btn"
                          onClick={() => moveStory(story.id, 1)}
                          disabled={index === stories.length - 1}
                          title="Aşağı taşı"
                          aria-label="Aşağı taşı"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="admin-stories-card__toolbar">
                        <button
                          type="button"
                          className="admin-stories-card__btn admin-stories-card__btn--accent"
                          onClick={() => openEditStory(story)}
                          title="Düzenle"
                          aria-label="Düzenle"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className={`admin-stories-card__btn ${
                            story.isActive
                              ? 'admin-stories-card__btn--warn'
                              : 'admin-stories-card__btn--ok'
                          }`}
                          onClick={() => handleToggle(story)}
                          title={story.isActive ? 'Mobilde gizle' : 'Mobilde göster'}
                          aria-label={story.isActive ? 'Mobilde gizle' : 'Mobilde göster'}
                        >
                          {story.isActive ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          className="admin-stories-card__btn admin-stories-card__btn--danger"
                          onClick={() => deleteStory(story.id)}
                          title="Sil"
                          aria-label="Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      <ShowcaseModal
        open={bannerModalOpen}
        mode={bannerMode}
        languages={languages}
        products={products}
        form={bannerForm}
        imagePreview={bannerImagePreview}
        saving={saving}
        onClose={() => setBannerModalOpen(false)}
        onSave={saveBanner}
        onFormChange={setBannerForm}
        onImageChange={setBannerImageFile}
      />

      <StoryModal
        open={storyModalOpen}
        mode={storyMode}
        products={products}
        form={storyForm}
        imagePreview={storyImagePreview}
        saving={saving}
        onClose={() => setStoryModalOpen(false)}
        onSave={saveStory}
        onFormChange={setStoryForm}
        onImageChange={setStoryImageFile}
      />
    </div>
  );
}
