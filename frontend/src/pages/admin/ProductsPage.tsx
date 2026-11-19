import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  FolderOpen,
  Layers3,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Tags,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { adminPath } from '@/lib/adminPath';
import { getActiveLanguages, type AdminLanguage } from '@/lib/languages';
import { Button, PageHeading, Spinner } from '@/components/ui';
import { AdminListPager } from '@/components/AdminListPager';
import { useImageBackground } from '@/components/admin/ImageBackgroundProvider';
import ProductModal, { type ProductFormState } from '@/components/ProductModal';
import ProductStockModal from '@/components/ProductStockModal';
import BulkPriceModal, {
  type BulkPriceApplyResult,
} from '@/components/BulkPriceModal';
import AdminToast, {
  type AdminToastNotice,
} from '@/components/admin/AdminToast';
import GroupsDialog from '@/components/admin/groups/GroupsDialog';
import ProductRow from '@/components/admin/products/ProductRow';
import type { PriceTransition } from '@/components/admin/products/AnimatedPrice';
import {
  emptyForm,
  buildFormFromProduct,
} from '@/components/admin/products/productForm';
import type {
  Product,
  Group,
  Currency,
} from '@/components/admin/products/types';
import {
  defaultPrefCatalog,
  fetchPrefCatalog,
  savePrefCatalog,
  type PrefCatalog,
} from '@/lib/prefCatalog';
import '@/components/admin/products/products.css';

type Query = {
  search: string;
  group: string;
  status: 'all' | 'active' | 'passive';
  page: number;
};
type Snapshot = {
  hasSnapshot: boolean;
  count: number;
  appliedAt: string | null;
};
const PAGE_SIZE = 15;
const message = (e: unknown) =>
  e instanceof Error ? e.message : 'İşlem tamamlanamadı. Tekrar deneyin.';
const priceValue = (value: string) => Number(value.trim().replace(',', '.'));
/** Düğmenin altındaki küçük filtre paneli: dış tıklama / Escape ile kapanır, ekrana sığacak kadar yükselir. */
function useFilterPanel(
  open: boolean,
  close: () => void,
  root: RefObject<HTMLElement | null>,
  panel: RefObject<HTMLElement | null>,
) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) closeRef.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeRef.current();
        root.current?.querySelector('button')?.focus();
      }
    };
    const place = () => {
      const top = panel.current?.getBoundingClientRect().top || 0;
      panel.current?.style.setProperty('--space', `${Math.max(100, innerHeight - top - 12)}px`);
    };
    place();
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, root, panel]);
}

export default function ProductsPage() {
  const { prepare: prepareImages } = useImageBackground();
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]),
    [groups, setGroups] = useState<Group[]>([]),
    [languages, setLanguages] = useState<AdminLanguage[]>([]),
    [currencies, setCurrencies] = useState<Currency[]>([]);
  const [ready, setReady] = useState(false),
    [metaError, setMetaError] = useState(''),
    [metaRetry, setMetaRetry] = useState(0);
  const [query, setQuery] = useState<Query>({
      search: '',
      group: '',
      status: 'all',
      page: 1,
    }),
    [total, setTotal] = useState(0),
    [refreshing, setRefreshing] = useState(true),
    [listError, setListError] = useState(''),
    [retry, setRetry] = useState(0);
  const [notice, setNotice] = useState<AdminToastNotice>(null),
    [busy, setBusy] = useState(false);
  const lock = useRef(false),
    request = useRef(0),
    handled = useRef('');
  const [categoryOpen, setCategoryOpen] = useState(false),
    [toolsOpen, setToolsOpen] = useState(false),
    [statusOpen, setStatusOpen] = useState(false);
  const statusRoot = useRef<HTMLDivElement>(null),
    statusPanel = useRef<HTMLDivElement>(null),
    groupRoot = useRef<HTMLDivElement>(null),
    groupPanel = useRef<HTMLDivElement>(null);
  const [actions, setActions] = useState<{
    product: Product;
    point: { x: number; y: number };
  } | null>(null);
  const [modalOpen, setModalOpen] = useState(false),
    [editing, setEditing] = useState<Product | null>(null),
    [form, setForm] = useState<ProductFormState>(emptyForm()),
    [tab, setTab] = useState<'general' | 'image'>('general'),
    [formError, setFormError] = useState('');
  const [images, setImages] = useState<string[]>([]),
    [pending, setPending] = useState<{ id: string; file: File; url: string }[]>(
      [],
    ),
    [imageBusyId, setImageBusyId] = useState<number | null>(null);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const [photoOrder, setPhotoOrder] = useState<string[]>([]);
  useEffect(() => {
    const available = [
      ...images.map((url) => `saved:${url}`),
      ...pending.map((photo) => `pending:${photo.id}`),
    ];
    setPhotoOrder((previous) => [
      ...previous.filter((id) => available.includes(id)),
      ...available.filter((id) => !previous.includes(id)),
    ]);
  }, [images, pending]);
  const [stock, setStock] = useState<Product | null>(null),
    [deleteTarget, setDeleteTarget] = useState<Product | null>(null),
    [deleteError, setDeleteError] = useState('');
  const [prefs, setPrefs] = useState<PrefCatalog>(defaultPrefCatalog);
  const [bulkOpen, setBulkOpen] = useState(false),
    [restoreOpen, setRestoreOpen] = useState(false),
    [restoreError, setRestoreError] = useState(''),
    [snapshot, setSnapshot] = useState<Snapshot>({
      hasSnapshot: false,
      count: 0,
      appliedAt: null,
    });
  const [categorySearch, setCategorySearch] = useState('');
  const [priceTransitions, setPriceTransitions] = useState<
    Record<number, PriceTransition>
  >({});
  useEffect(() => {
    setPriceTransitions({});
  }, [query]);
  useEffect(
    () => () =>
      pendingRef.current.forEach((file) => URL.revokeObjectURL(file.url)),
    [],
  );
  const refreshSnapshot = useCallback(async () => {
    try {
      setSnapshot(await api<Snapshot>('/api/admin/products/bulk-price/status'));
    } catch {
      /* snapshot tools stay unavailable until a successful response */
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [first, langs, curs, catalog] = await Promise.all([
          api<{ data: Group[]; pagination?: { total: number } }>(
            '/api/admin/groups?limit=200',
          ),
          api<AdminLanguage[]>('/api/admin/languages'),
          api<Currency[]>('/api/admin/currencies'),
          fetchPrefCatalog().catch(() => defaultPrefCatalog()),
        ]);
        const all = [...first.data];
        for (
          let page = 2;
          all.length < (first.pagination?.total || 0);
          page++
        ) {
          const res = await api<{ data: Group[] }>(
            `/api/admin/groups?limit=200&page=${page}`,
          );
          if (!res.data.length) break;
          all.push(...res.data);
        }
        if (!cancelled) {
          setGroups(all);
          setLanguages(getActiveLanguages(langs));
          setCurrencies(curs);
          setPrefs(catalog);
          setReady(true);
          setMetaError('');
        }
      } catch (e) {
        if (!cancelled) setMetaError(message(e));
      }
    })();
    void refreshSnapshot();
    return () => {
      cancelled = true;
    };
  }, [metaRetry, refreshSnapshot]);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const id = ++request.current;
      setRefreshing(true);
      setListError('');
      const search = new URLSearchParams({
        limit: String(PAGE_SIZE),
        page: String(query.page),
      });
      if (query.search.trim()) search.set('search', query.search.trim());
      if (query.group) search.set('groupId', query.group);
      if (query.status !== 'all')
        search.set('active', String(query.status === 'active'));
      try {
        const result = await api<{
          data: Product[];
          pagination: { total: number };
        }>(`/api/admin/products?${search}`, { signal });
        if (id !== request.current || signal?.aborted) return;
        setProducts(result.data);
        const count = result.pagination?.total ?? result.data.length;
        setTotal(count);
        if (query.page > Math.max(1, Math.ceil(count / PAGE_SIZE)))
          setQuery((prev) => ({
            ...prev,
            page: Math.max(1, Math.ceil(count / PAGE_SIZE)),
          }));
      } catch (e) {
        if (id === request.current && !signal?.aborted)
          setListError(message(e));
      } finally {
        if (id === request.current && !signal?.aborted) setRefreshing(false);
      }
    },
    [query],
  );
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(
      () => void load(abort.signal),
      query.search.trim() ? 220 : 0,
    );
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [load, retry, query.search]);
  useFilterPanel(statusOpen, () => setStatusOpen(false), statusRoot, statusPanel);
  useFilterPanel(categoryOpen, () => setCategoryOpen(false), groupRoot, groupPanel);
  function filter(patch: Partial<Query>) {
    setQuery((prev) => ({ ...prev, ...patch, page: 1 }));
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
  function merge(updated: Product) {
    setProducts((list) =>
      list.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
    );
  }
  function clearPending() {
    pendingRef.current.forEach((file) => URL.revokeObjectURL(file.url));
    setPending([]);
  }
  function openEdit(
    product: Product,
    initial: 'general' | 'image' = 'general',
  ) {
    if (lock.current) return;
    setActions(null);
    setNotice(null);
    setEditing(product);
    setForm(buildFormFromProduct(product));
    setTab(initial);
    setFormError('');
    setImages(
      product.images?.length
        ? product.images
        : product.imageUrl
          ? [product.imageUrl]
          : [],
    );
    setPhotoOrder(
      (product.images?.length
        ? product.images
        : product.imageUrl
          ? [product.imageUrl]
          : []
      ).map((url) => `saved:${url}`),
    );
    clearPending();
    setModalOpen(true);
  }
  function openCreate(groupId?: string) {
    if (lock.current) return;
    setNotice(null);
    setEditing(null);
    setTab('general');
    setFormError('');
    const currency =
      currencies.find((c) => c.code === 'TRY' && c.isActive) ||
      currencies.find((c) => c.isActive);
    const group = groupId || query.group || String(groups[0]?.id || '');
    setForm({
      ...emptyForm(),
      groupId: groups.some((g) => String(g.id) === group)
        ? group
        : String(groups[0]?.id || ''),
      currencyId: String(currency?.id || ''),
    });
    setImages([]);
    setPhotoOrder([]);
    clearPending();
    setModalOpen(true);
  }
  function closeForm() {
    if (lock.current) return;
    setModalOpen(false);
    setEditing(null);
    clearPending();
  }
  useEffect(() => {
    if (!ready) return;
    const edit = params.get('edit'),
      create = params.get('new') === '1' || params.get('add') === '1';
    const key = edit ? `edit:${edit}` : create ? 'new' : '';
    if (!key || handled.current === key) return;
    handled.current = key;
    const done = () => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('edit');
          next.delete('new');
          next.delete('add');
          next.delete('groupId');
          return next;
        },
        { replace: true },
      );
      handled.current = '';
    };
    if (edit) {
      void api<Product>(`/api/admin/products/${Number(edit)}`)
        .then((p) => openEdit(p))
        .catch((e) => setNotice({ error: true, text: message(e) }))
        .finally(done);
    } else {
      openCreate(params.get('groupId') || undefined);
      done();
    }
    // The URL is consumed once; draft changes must not reopen/reset it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, params]);
  async function quickEdit(
    product: Product,
    field: 'name' | 'price',
    raw: string,
  ) {
    if (!begin()) return false;
    setPriceTransitions((previous) => {
      const next = { ...previous };
      delete next[product.id];
      return next;
    });
    try {
      let payload: object;
      if (field === 'price') {
        const price = priceValue(raw);
        if (!raw.trim() || !Number.isFinite(price) || price < 0)
          throw new Error('Geçerli, sıfır veya üzeri bir fiyat yazın.');
        payload = { price };
      } else {
        const lang = languages.find((l) => l.code === 'tr') || languages[0];
        if (!raw.trim() || !lang) throw new Error('Ürün adını yazın.');
        const old = product.translations.find((t) => t.languageId === lang.id);
        payload = {
          translations: [{ ...old, languageId: lang.id, name: raw.trim() }],
        };
      }
      merge(
        await api<Product>(`/api/admin/products/${product.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        }),
      );
      setNotice({
        error: false,
        text: field === 'price' ? 'Fiyat kaydedildi.' : 'Ürün adı kaydedildi.',
      });
      return true;
    } catch (e) {
      setNotice({ error: true, text: message(e) });
      return false;
    } finally {
      end();
    }
  }
  async function toggle(product: Product) {
    if (!begin()) return;
    try {
      const result = await api<Product>(
        `/api/admin/products/${product.id}/toggle`,
        { method: 'PATCH' },
      );
      merge(result);
      setNotice({
        error: false,
        text: `${product.name} ${result.isActive ? 'menüde gösteriliyor.' : 'menüde gizlendi.'}`,
      });
      if (query.status !== 'all') await load();
    } catch (e) {
      setNotice({ error: true, text: message(e) });
    } finally {
      end();
    }
  }
  function validateFiles(files: File[]) {
    if (
      files.length > 12 ||
      files.some(
        (file) =>
          !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024,
      )
    )
      throw new Error(
        'Bir seferde en fazla 12 görsel seçin; her biri en fazla 5 MB olmalı.',
      );
  }
  async function upload(id: number, files: File[]) {
    validateFiles(files);
    const body = new FormData();
    files.forEach((file) => body.append('images', file));
    return api<Product>(`/api/admin/products/${id}/images`, {
      method: 'POST',
      body,
    });
  }
  async function quickUpload(product: Product, chosen: File[]) {
    if (!chosen.length) return;
    const files = await prepareImages(chosen, { subject: 'Ürün görseli' });
    if (!files || !begin()) return;
    setImageBusyId(product.id);
    try {
      merge(await upload(product.id, files));
      setNotice({
        error: false,
        text: `${product.name}: ${files.length} görsel eklendi.`,
      });
    } catch (e) {
      setNotice({ error: true, text: message(e) });
    } finally {
      setImageBusyId(null);
      end();
    }
  }
  async function manageImage(
    product: Product,
    action: 'order' | 'remove' | 'replace',
    value: string[] | string,
    chosen?: File,
  ) {
    let file = chosen;
    if (action === 'replace' && chosen) {
      const prepared = await prepareImages([chosen], { subject: 'Ürün görseli' });
      if (!prepared) return false;
      file = prepared[0];
    }
    if (!begin()) return false;
    setImageBusyId(product.id);
    try {
      let body: BodyInit, method: string, endpoint: string;
      if (action === 'replace') {
        if (!file) return false;
        validateFiles([file]);
        const data = new FormData();
        data.append('image', file);
        data.append('url', String(value));
        body = data;
        method = 'POST';
        endpoint = '/images/replace';
      } else {
        body = JSON.stringify(
          action === 'order' ? { images: value } : { url: value },
        );
        method = action === 'order' ? 'PUT' : 'DELETE';
        endpoint = action === 'order' ? '/images/reorder' : '/images';
      }
      const updated = await api<Product>(
        `/api/admin/products/${product.id}${endpoint}`,
        { method, body },
      );
      merge(updated);
      setNotice({
        error: false,
        text:
          action === 'replace'
            ? 'Görsel değiştirildi.'
            : action === 'remove'
              ? 'Görsel kaldırıldı.'
              : 'Görsel sırası kaydedildi.',
      });
      return true;
    } catch (error) {
      setNotice({ error: true, text: message(error) });
      return false;
    } finally {
      setImageBusyId(null);
      end();
    }
  }
  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const prepared = await prepareImages(Array.from(files), { subject: 'Ürün görseli' });
    if (!prepared) return;
    try {
      const next = prepared;
      validateFiles([...pending.map((p) => p.file), ...next]);
      setPending((prev) => [
        ...prev,
        ...next.map((file) => ({
          id: crypto.randomUUID(),
          file,
          url: URL.createObjectURL(file),
        })),
      ]);
    } catch (e) {
      setFormError(message(e));
    }
  }
  function removePending(id: string) {
    setPending((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((p) => p.id !== id);
    });
  }
  async function removeImage(url: string) {
    if (!editing || !begin()) return;
    try {
      const updated = await api<Product>(
        `/api/admin/products/${editing.id}/images`,
        { method: 'DELETE', body: JSON.stringify({ url }) },
      );
      setImages(updated.images || []);
      setEditing(updated);
      merge(updated);
    } catch (e) {
      setFormError(message(e));
    } finally {
      end();
    }
  }
  async function saveForm() {
    if (!begin()) return;
    setFormError('');
    try {
      const price = priceValue(form.price);
      if (!form.translations.tr?.name.trim())
        throw new Error('Ürün adını yazın.');
      if (!groups.some((g) => String(g.id) === form.groupId))
        throw new Error('Bir grup seçin.');
      if (!form.price.trim() || !Number.isFinite(price) || price < 0)
        throw new Error('Geçerli bir fiyat yazın.');
      for (const [label, value] of [
        ['Hazırlanma süresi', form.prepTimeMinutes],
        ['Kalori', form.calories],
      ]) {
        if (
          value.trim() &&
          (!Number.isInteger(Number(value)) ||
            Number(value) < 0 ||
            Number(value) > 2147483647)
        ) {
          throw new Error(`${label} için sıfır veya üzeri bir tam sayı yazın.`);
        }
      }
      validateFiles(pending.map((p) => p.file));
      const payload = {
        ...form,
        groupId: Number(form.groupId),
        price,
        currencyId: form.currencyId ? Number(form.currencyId) : null,
        prepTimeMinutes: form.prepTimeMinutes
          ? Number(form.prepTimeMinutes)
          : null,
        calories: form.calories ? Number(form.calories) : null,
        translations: languages.map((l) => ({
          languageId: l.id,
          name: form.translations[l.code]?.name || '',
          description: form.translations[l.code]?.description || '',
          ingredients: form.translations[l.code]?.ingredients || '',
          allergens: form.translations[l.code]?.allergens || '',
        })),
      };
      const saved = await api<Product>(
        editing ? `/api/admin/products/${editing.id}` : '/api/admin/products',
        { method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload) },
      );
      setEditing(saved);
      merge(saved);
      let savedPhotos = [...images];
      const resolved = new Map(images.map((url) => [`saved:${url}`, url]));
      if (pending.length) {
        const orderedPending = [...pending].sort(
          (a, b) =>
            photoOrder.indexOf(`pending:${a.id}`) -
            photoOrder.indexOf(`pending:${b.id}`),
        );
        const updated = await upload(
          saved.id,
          orderedPending.map((photo) => photo.file),
        );
        savedPhotos = updated.images || [];
        const added = savedPhotos.filter((url) => !images.includes(url));
        orderedPending.forEach((photo, index) => {
          if (added[index]) resolved.set(`pending:${photo.id}`, added[index]);
        });
        setImages(savedPhotos);
        setEditing(updated);
        merge(updated);
        // Resolve temporary IDs before the request: retrying a failed reorder must not upload twice.
        setPhotoOrder(
          photoOrder
            .map((id) => resolved.get(id))
            .filter((url): url is string => Boolean(url))
            .map((url) => `saved:${url}`),
        );
        clearPending();
      }
      const desired = photoOrder
        .map((id) => resolved.get(id))
        .filter((url): url is string => Boolean(url));
      savedPhotos.forEach((url) => {
        if (!desired.includes(url)) desired.push(url);
      });
      if (
        desired.length &&
        desired.some((url, index) => url !== savedPhotos[index])
      ) {
        const reordered = await api<Product>(
          `/api/admin/products/${saved.id}/images/reorder`,
          {
            method: 'PUT',
            body: JSON.stringify({ images: desired }),
          },
        );
        setImages(reordered.images || desired);
        setEditing(reordered);
        merge(reordered);
      }
      await load();
      setModalOpen(false);
      clearPending();
      setNotice({ error: false, text: 'Ürün kaydedildi.' });
    } catch (e) {
      setFormError(message(e));
    } finally {
      end();
    }
  }
  async function changePrefs(catalog: PrefCatalog) {
    setPrefs(catalog);
    try {
      await savePrefCatalog(catalog);
    } catch (e) {
      setFormError(message(e));
    }
  }
  async function removeProduct() {
    if (!deleteTarget || !begin()) return;
    setDeleteError('');
    try {
      await api(`/api/admin/products/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await load();
      setNotice({ error: false, text: 'Ürün silindi.' });
    } catch (e) {
      setDeleteError(message(e));
    } finally {
      end();
    }
  }
  async function bulkApplied(result: BulkPriceApplyResult) {
    setBulkOpen(false);
    if (!begin()) return;
    try {
      const transitions: Record<number, PriceTransition> = {};
      const token = Date.now();
      let index = 0;
      products.forEach((product) => {
        const update = result.updates.find(
          (update) => update.id === product.id,
        );
        if (update && update.price !== update.previousPrice)
          transitions[product.id] = {
            from: update.previousPrice,
            to: update.price,
            delay: index++ * 220,
            token,
          };
      });
      setPriceTransitions(transitions);
      setProducts((previous) =>
        previous.map((product) => {
          const update = result.updates.find(
            (update) => update.id === product.id,
          );
          return update ? { ...product, ...update } : product;
        }),
      );
      await load();
      await refreshSnapshot();
      setNotice({
        error: false,
        text: `${result.updates.length} ürünün fiyatı güncellendi.${result.skipped.length ? ` ${result.skipped.length} ürün atlandı.` : ''}`,
      });
    } finally {
      end();
    }
  }
  async function restorePrices() {
    if (!snapshot.hasSnapshot || !begin()) return;
    setRestoreError('');
    try {
      setPriceTransitions({});
      await api('/api/admin/products/bulk-price/restore', { method: 'POST' });
      setRestoreOpen(false);
      await load();
      await refreshSnapshot();
      setNotice({
        error: false,
        text: 'Son toplu fiyat değişikliği geri alındı.',
      });
    } catch (e) {
      setRestoreError(message(e));
    } finally {
      end();
    }
  }
  function openActions(product: Product, e: MouseEvent<HTMLElement>) {
    e.preventDefault();
    if (busy) return;
    const box = e.currentTarget.getBoundingClientRect();
    setActions({
      product,
      point: {
        x: e.type === 'contextmenu' ? e.clientX : box.right - 280,
        y: e.type === 'contextmenu' ? e.clientY : box.bottom + 6,
      },
    });
  }
  const disabled = busy || refreshing;
  const groupOptions = groups.map((g) => ({
    id: g.id,
    name: g.name,
    isSubGroup: g.isSubGroup,
    parentName: g.parentName,
  }));
  const selectedGroup = groups.find((g) => String(g.id) === query.group);
  const groupQuery = categorySearch.toLocaleLowerCase('tr').trim();
  const visibleGroups = groups.filter(
    (g) =>
      !groupQuery ||
      `${g.name} ${g.parentName || ''}`.toLocaleLowerCase('tr').includes(groupQuery),
  );
  if (metaError)
    return (
      <div className="ag-empty" role="alert">
        <h1>Ürünler açılamadı</h1>
        <p>{metaError}</p>
        <Button
          onClick={() => {
            setMetaError('');
            setMetaRetry((v) => v + 1);
          }}
        >
          Tekrar dene
        </Button>
      </div>
    );
  if (!ready) return <Spinner />;
  return (
    <section className="ap-page" aria-label="Ürün yönetimi">
      <AdminToast
        notice={notice}
        onClose={() => setNotice(null)}
        className={modalOpen ? 'pe-modal-toast' : ''}
      />
      <header className="ap-head">
        <PageHeading title="Ürünler" subtitle={`${total} ürün`} />
        <div className="ap-head__actions">
          <button
            className="ap-tools"
            disabled={busy}
            onClick={() => setToolsOpen(true)}
            aria-label="Ürün araçları"
          >
            <MoreHorizontal size={20} />
            <span>Araçlar</span>
          </button>
          <Button disabled={busy} onClick={() => openCreate()}>
            <Plus size={18} />
            Ürün ekle
          </Button>
        </div>
      </header>
      <div className="ap-workspace">
        <div className="ap-canvas">
          <div className="ap-toolbar">
            <label className="ap-search">
              <Search size={18} />
              <input
                aria-label="Ürünlerde ara"
                placeholder="Bir ürün bul…"
                value={query.search}
                onChange={(e) => filter({ search: e.target.value })}
              />
              {query.search && (
                <button
                  className="ag-icon"
                  aria-label="Aramayı temizle"
                  onClick={() => filter({ search: '' })}
                >
                  <X size={16} />
                </button>
              )}
            </label>
            <div className="ap-group-wrap" ref={groupRoot}>
              <button
                className={`ap-category-trigger${query.group ? ' is-active' : ''}`}
                aria-haspopup="true"
                aria-expanded={categoryOpen}
                onClick={() => {
                  setStatusOpen(false);
                  setCategorySearch('');
                  setCategoryOpen((v) => !v);
                }}
              >
                <FolderOpen size={17} />
                <span>{selectedGroup?.name || 'Tüm gruplar'}</span>
                <small>{refreshing ? '…' : `${total} ürün`}</small>
                <ChevronDown size={15} className={categoryOpen ? 'is-open' : ''} />
              </button>
              {categoryOpen && (
                <div
                  ref={groupPanel}
                  className="ap-filter-panel ap-group-panel"
                  role="region"
                  aria-label="Bölüm filtresi"
                >
                  <header>
                    <span>Hangi bölüm?</span>
                    <button
                      className="ag-icon"
                      aria-label="Filtreyi kapat"
                      onClick={() => setCategoryOpen(false)}
                    >
                      <X size={16} />
                    </button>
                  </header>
                  {groups.length > 8 && (
                    <label className="ap-group-search">
                      <Search size={16} />
                      <input
                        aria-label="Grup bul"
                        placeholder="Grup ara"
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                      />
                    </label>
                  )}
                  <div className="ap-pills">
                    {!groupQuery && (
                      <button
                        aria-pressed={!query.group}
                        onClick={() => {
                          filter({ group: '' });
                          setCategoryOpen(false);
                        }}
                      >
                        Tüm ürünler
                      </button>
                    )}
                    {visibleGroups.map((g) => (
                      <button
                        key={g.id}
                        aria-pressed={query.group === String(g.id)}
                        className={g.isSubGroup ? 'is-sub' : undefined}
                        onClick={() => {
                          filter({ group: String(g.id) });
                          setCategoryOpen(false);
                        }}
                      >
                        {g.isSubGroup && <small>{g.parentName}</small>}
                        <span>{g.name}</span>
                      </button>
                    ))}
                    {!visibleGroups.length && <p>Bu aramaya uyan grup yok.</p>}
                  </div>
                </div>
              )}
            </div>
            <div className="ap-status-wrap" ref={statusRoot}>
              <button
                className={`ap-filter${query.status !== 'all' ? 'is-active' : ''}`}
                aria-label="Ürün filtreleri"
                aria-expanded={statusOpen}
                onClick={() => {
                  setCategoryOpen(false);
                  setStatusOpen((v) => !v);
                }}
              >
                <SlidersHorizontal size={18} />
                {query.status !== 'all' && <i />}
              </button>
              {statusOpen && (
                <div
                  ref={statusPanel}
                  className="ap-filter-panel"
                  role="region"
                  aria-label="Görünürlük filtresi"
                >
                  <header>
                    <span>Menüde görünürlük</span>
                    <button
                      className="ag-icon"
                      aria-label="Filtreleri kapat"
                      onClick={() => setStatusOpen(false)}
                    >
                      <X size={16} />
                    </button>
                  </header>
                  {(
                    [
                      ['all', 'Tümü'],
                      ['active', 'Açık'],
                      ['passive', 'Gizli'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      aria-pressed={query.status === value}
                      onClick={() => filter({ status: value })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className={`ap-section-head${query.search ? ' is-search' : ''}`}>
            <div>
              {query.search && <p>ARAMA SONUÇLARI</p>}
              <h2>
                {query.search
                  ? `“${query.search}”`
                  : selectedGroup?.name || 'Tüm ürünler'}
              </h2>
            </div>
            <span aria-live="polite">
              {refreshing ? 'Yükleniyor…' : `${total} ürün`}
            </span>
          </div>
          {query.status !== 'all' && (
            <div className="ap-active-filter">
              {query.status === 'active' ? 'Menüde açık' : 'Menüde gizli'}
              <button
                onClick={() => filter({ status: 'all' })}
                aria-label="Görünürlük filtresini temizle"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <div
            className={`ap-list${refreshing ? ' is-loading' : ''}`}
            aria-busy={refreshing}
          >
            {listError ? (
              <div className="ag-empty" role="alert">
                <p>{listError}</p>
                <Button onClick={() => setRetry((v) => v + 1)}>
                  Tekrar dene
                </Button>
              </div>
            ) : products.length ? (
              products.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  busy={disabled}
                  imageBusy={imageBusyId === product.id}
                  onEdit={openEdit}
                  onQuickEdit={quickEdit}
                  onToggle={toggle}
                  onStock={(product) => {
                    setNotice(null);
                    setStock(product);
                  }}
                  onActions={openActions}
                  onUpload={(files) => quickUpload(product, files)}
                  onImageOrder={(urls) => manageImage(product, 'order', urls)}
                  onImageRemove={(url) => manageImage(product, 'remove', url)}
                  onImageReplace={(url, file) =>
                    manageImage(product, 'replace', url, file)
                  }
                  priceTransition={priceTransitions[product.id]}
                />
              ))
            ) : refreshing ? (
              <div className="ap-skeleton" aria-label="Ürünler yükleniyor">
                {[1, 2, 3].map((i) => (
                  <div key={i} />
                ))}
              </div>
            ) : (
              <div className="ag-empty">
                <Package size={30} />
                <h3>
                  {query.search || query.status !== 'all'
                    ? 'Bu seçimde ürün yok'
                    : 'İlk lezzetinize yer açın'}
                </h3>
                <p>
                  {query.search
                    ? 'Başka bir ürün adı deneyin.'
                    : 'Yeni ürününüzü bu bölüme ekleyebilirsiniz.'}
                </p>
                <Button
                  variant="secondary"
                  onClick={() =>
                    query.search || query.status !== 'all'
                      ? filter({ search: '', status: 'all' })
                      : openCreate()
                  }
                >
                  {query.search || query.status !== 'all'
                    ? 'Filtreleri temizle'
                    : 'Ürün ekle'}
                </Button>
              </div>
            )}
          </div>
          <AdminListPager
            page={query.page}
            pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={(page) => {
              if (!disabled) setQuery((prev) => ({ ...prev, page }));
            }}
          />
          <p className="ap-note">
            Ad veya fiyata dokunun, Enter ile kaydedin. Ayrıntılar için üç
            noktayı kullanın.
          </p>
        </div>
      </div>
      <GroupsDialog
        open={toolsOpen}
        title="Menü araçları"
        subtitle="Günlük işlerin ötesinde, ihtiyacınız olduğunda."
        onClose={() => setToolsOpen(false)}
      >
        <div className="ag-action-list">
          <button
            onClick={() => {
              setToolsOpen(false);
              setBulkOpen(true);
            }}
          >
            <Tags size={20} />
            <span>
              Toplu fiyat güncelle
              <small>Önizle, kontrol et, birlikte uygula</small>
            </span>
          </button>
          {snapshot.hasSnapshot && (
            <button
              onClick={() => {
                setToolsOpen(false);
                setRestoreError('');
                setRestoreOpen(true);
              }}
            >
              <RotateCcw size={19} />
              <span>
                Son fiyat değişikliğini geri al
                <small>{snapshot.count} ürün</small>
              </span>
            </button>
          )}
          <Link to={adminPath('urun-secenekleri')}>
            <Layers3 size={20} />
            <span>Varyant ve seçenekler</span>
          </Link>
          <Link to={adminPath('icerik-havuzu')}>
            <Package size={20} />
            <span>İçerik havuzu</span>
          </Link>
          <Link to={adminPath('saatlik-menu')}>
            <Clock size={20} />
            <span>Saatlik menü</span>
          </Link>
        </div>
      </GroupsDialog>
      <GroupsDialog
        open={Boolean(actions)}
        title={actions?.product.name || 'Ürün'}
        onClose={() => setActions(null)}
        className="ag-actions"
        anchor={actions?.point}
      >
        {actions && (
          <div className="ag-action-list">
            <button onClick={() => openEdit(actions.product)}>
              <Pencil size={18} />
              Ayrıntıları düzenle
            </button>
            <button onClick={() => openEdit(actions.product, 'image')}>
              <Layers3 size={18} />
              Görselleri yönet
            </button>
            <button
              onClick={() => {
                setStock(actions.product);
                setActions(null);
              }}
            >
              <Package size={18} />
              Stok ve varyantlar
            </button>
            <button
              onClick={() => {
                const product = actions.product;
                setActions(null);
                void toggle(product);
              }}
            >
              {actions.product.isActive ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
              Menüde {actions.product.isActive ? 'gizle' : 'göster'}
            </button>
            <button
              className="is-danger"
              onClick={() => {
                setDeleteTarget(actions.product);
                setDeleteError('');
                setActions(null);
              }}
            >
              <Trash2 size={18} />
              Ürünü sil
            </button>
          </div>
        )}
      </GroupsDialog>
      <ProductModal
        open={modalOpen}
        mode={editing ? 'edit' : 'create'}
        initialTab={tab}
        error={formError}
        languages={languages}
        currencies={currencies}
        groups={groupOptions}
        prefCatalog={prefs}
        onPrefCatalogChange={changePrefs}
        form={form}
        productImages={images}
        productId={editing?.id}
        photoOrder={photoOrder}
        pendingPreviews={pending.map(({ id, url }) => ({ id, url }))}
        saving={busy}
        onClose={closeForm}
        onSave={() => void saveForm()}
        onFormChange={setForm}
        onRecommendationChange={(recommended) =>
          setNotice({
            error: false,
            text: recommended
              ? 'Bu lezzet başrolde! Kaydettiğinde menünün üstündeki önerilen ürünler arasında görünecek.'
              : 'Öne çıkarma kaldırıldı. Kaydettiğinde ürün kendi kategorisinde gösterilmeye devam edecek.',
          })
        }
        onAddImages={addFiles}
        onRemoveImage={removeImage}
        onRemovePending={removePending}
        onPhotoOrderChange={setPhotoOrder}
      />
      <BulkPriceModal
        open={bulkOpen}
        groups={groupOptions}
        onClose={() => setBulkOpen(false)}
        onApplied={bulkApplied}
      />
      {stock && (
        <ProductStockModal
          product={stock}
          onClose={() => setStock(null)}
          onSaved={(updated) => {
            setProducts((list) =>
              list.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
            );
            setNotice({ error: false, text: 'Stok bilgileri kaydedildi.' });
          }}
        />
      )}
      <GroupsDialog
        open={Boolean(deleteTarget)}
        title="Ürünü silelim mi?"
        subtitle={deleteTarget?.name}
        busy={busy}
        onClose={() => setDeleteTarget(null)}
      >
        <p className="ag-delete-copy">
          Bu ürün menüden kalıcı olarak kaldırılır. Bu işlem geri alınamaz.
        </p>
        {deleteError && (
          <p role="alert" className="ag-form-error">
            {deleteError}
          </p>
        )}
        <Button
          className="w-full ag-delete-button"
          disabled={busy}
          onClick={() => void removeProduct()}
        >
          {busy ? 'Siliniyor…' : 'Ürünü sil'}
        </Button>
      </GroupsDialog>
      <GroupsDialog
        open={restoreOpen}
        title="Son fiyatlara dön"
        busy={busy}
        onClose={() => setRestoreOpen(false)}
      >
        <p className="ag-delete-copy">
          Son toplu işlemde değişen {snapshot.count} ürünün eski fiyatı geri
          yüklenecek.
        </p>
        {restoreError && (
          <p role="alert" className="ag-form-error">
            {restoreError}
          </p>
        )}
        <Button
          className="w-full"
          disabled={busy}
          onClick={() => void restorePrices()}
        >
          {busy ? 'Geri alınıyor…' : 'Eski fiyatları geri yükle'}
        </Button>
      </GroupsDialog>
    </section>
  );
}
