import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  Coins,
  Percent,
  Receipt,
  Search,
  UserRound,
  Wallet,
  X,
  Plus,
  Minus,
  Check,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Undo2,
  Gift,
  Pencil,
  Power,
  TriangleAlert,
  Lock,
  Package,
  Folders,
  Type,
} from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, Spinner } from '@/components/ui';
import { gsap, prefersReducedMotion, useGSAP } from '@/lib/gsapSetup';
import '@/admin-customers.css';

type CustomerDiscount = {
  type: 'percent' | 'amount';
  value: number;
  note: string;
  expiresAt: string | null;
} | null;

type CustomerRow = {
  id: number;
  fullName: string;
  email: string | null;
  phone: string | null;
  points: number;
  discount: CustomerDiscount;
  debtBalance: number;
  createdAt: string;
};

type LedgerEntry = {
  id: number;
  kind: 'debt' | 'payment' | 'points' | 'discount' | string;
  amount: number;
  note: string | null;
  balanceAfter: number | null;
  pointsAfter: number | null;
  createdAt: string;
};

type PointsRewardKind = 'custom' | 'product' | 'group' | 'wallet';

type PointsRewardRule = {
  id: string;
  kind: PointsRewardKind;
  title: string;
  pointsCost: number;
  description: string;
  active: boolean;
  sortOrder: number;
  productId: number | null;
  productName: string;
  groupId: number | null;
  groupName: string;
  discountPercent: number | null;
  amountValue: number | null;
};

type RewardOption = { id: number; name: string };

type RewardDraft = {
  kind: PointsRewardKind;
  title: string;
  pointsCost: string;
  description: string;
  productId: string;
  groupId: string;
  discountPercent: string;
  amountValue: string;
};

type DiscountType = 'percent' | 'amount';

const REWARD_KINDS: {
  id: PointsRewardKind;
  label: string;
  hint: string;
  icon: typeof Type;
}[] = [
  { id: 'custom', label: 'Metin', hint: 'Serbest açıklama', icon: Type },
  { id: 'product', label: 'Ürün', hint: 'Seçili ürün bedava', icon: Package },
  { id: 'group', label: 'Grup', hint: 'Gruba % indirim', icon: Folders },
  { id: 'wallet', label: 'Tutar', hint: 'Puan = ₺ indirim', icon: Wallet },
];

function emptyRewardDraft(kind: PointsRewardKind = 'custom'): RewardDraft {
  return {
    kind,
    title: '',
    pointsCost: '',
    description: '',
    productId: '',
    groupId: '',
    discountPercent: '10',
    amountValue: '1',
  };
}

function rewardKindMeta(kind: PointsRewardKind) {
  return REWARD_KINDS.find((k) => k.id === kind) || REWARD_KINDS[0];
}

function rewardCardCopy(rule: PointsRewardRule) {
  if (rule.kind === 'product') {
    return {
      headline: rule.productName || rule.title,
      detail: 'Bedava ürün',
    };
  }
  if (rule.kind === 'group') {
    return {
      headline: rule.groupName || rule.title,
      detail: `%${rule.discountPercent ?? 0} grup indirimi`,
    };
  }
  if (rule.kind === 'wallet') {
    return {
      headline: `${rule.pointsCost} puan = ${rule.amountValue ?? 0}₺`,
      detail: 'Tutar indirimi',
    };
  }
  return {
    headline: rule.title,
    detail: rule.description || 'Serbest kural',
  };
}

function sanitizeNumberInput(raw: string, opts?: { allowDecimal?: boolean }): string {
  const allowDecimal = opts?.allowDecimal === true;
  let cleaned = raw.replace(allowDecimal ? /[^\d.]/g : /\D/g, '');
  if (!allowDecimal) return cleaned;
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return (
    cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
  );
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

function formatDiscount(d: NonNullable<CustomerDiscount>) {
  return d.type === 'amount' ? `${d.value}₺` : `%${d.value}`;
}

function ledgerKindLabel(kind: string) {
  if (kind === 'debt') return 'Borç';
  if (kind === 'payment') return 'Ödeme';
  if (kind === 'discount') return 'İndirim';
  if (kind === 'points') return 'Puan';
  return kind;
}

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: RewardOption[];
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => String(o.id) === value);
  const filtered = useMemo(() => {
    const s = q.trim().toLocaleLowerCase('tr');
    if (!s) return options.slice(0, 100);
    return options
      .filter((o) => o.name.toLocaleLowerCase('tr').includes(s))
      .slice(0, 100);
  }, [options, q]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className={`admin-customers__combo${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="admin-customers__combo-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          setQ('');
        }}
      >
        <span className={selected ? '' : 'is-placeholder'}>
          {selected?.name || placeholder}
        </span>
        <Search className="w-3.5 h-3.5" />
      </button>
      {open ? (
        <div className="admin-customers__combo-panel" role="listbox">
          <div className="admin-customers__combo-search">
            <Search className="w-3.5 h-3.5" />
            <input
              autoFocus
              type="search"
              value={q}
              placeholder="Ara…"
              aria-label="Ara"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false);
              }}
            />
          </div>
          <ul>
            {filtered.length === 0 ? (
              <li className="is-empty">Sonuç yok</li>
            ) : (
              filtered.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={String(o.id) === value}
                    className={String(o.id) === value ? 'is-active' : ''}
                    onClick={() => {
                      onChange(String(o.id));
                      setOpen(false);
                      setQ('');
                    }}
                  >
                    {o.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default function CustomersPage() {
  const [items, setItems] = useState<CustomerRow[]>([]);
  const [debtorCount, setDebtorCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [filter, setFilter] = useState<'all' | 'debtors'>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 12;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CustomerRow | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const ledgerPageSize = 8;
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'manage' | 'ledger'>('manage');

  const [pointsDraft, setPointsDraft] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountDraft, setDiscountDraft] = useState('');
  const [discountNote, setDiscountNote] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtNote, setDebtNote] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<CustomerRow | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [rewardRules, setRewardRules] = useState<PointsRewardRule[]>([]);
  const [rewardProducts, setRewardProducts] = useState<RewardOption[]>([]);
  const [rewardGroups, setRewardGroups] = useState<RewardOption[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(true);
  const [rewardsBusy, setRewardsBusy] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [rewardDraft, setRewardDraft] = useState<RewardDraft>(() => emptyRewardDraft());

  const detailShellRef = useRef<HTMLDivElement>(null);
  const detailBodyRef = useRef<HTMLDivElement>(null);
  const emptyHintRef = useRef<HTMLDivElement>(null);
  const deleteBackdropRef = useRef<HTMLDivElement>(null);
  const deleteCardRef = useRef<HTMLDivElement>(null);
  const pointsStatRef = useRef<HTMLDivElement>(null);
  const discountStatRef = useRef<HTMLDivElement>(null);
  const debtStatRef = useRef<HTMLDivElement>(null);
  const ledgerListRef = useRef<HTMLUListElement>(null);
  const undoBtnRef = useRef<HTMLButtonElement>(null);
  const selectedIdRef = useRef<number | null>(null);
  const animTokenRef = useRef(0);
  const skipEnterAnimRef = useRef(false);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useGSAP(
    () => {
      const root = emptyHintRef.current;
      if (!root || selectedId != null) return;
      if (prefersReducedMotion()) {
        gsap.set(root, { clearProps: 'all' });
        return;
      }

      const ring = root.querySelector('.admin-customers__empty-ring');
      const icon = root.querySelector('.admin-customers__empty-icon');
      const ghosts = root.querySelectorAll('.admin-customers__empty-ghost');
      const copy = root.querySelector('.admin-customers__empty-copy');
      const cue = root.querySelector('.admin-customers__empty-cue');

      gsap.fromTo(
        [icon, copy, cue].filter(Boolean),
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, ease: 'power2.out' }
      );

      if (ring) {
        gsap.to(ring, {
          scale: 1.06,
          opacity: 0.45,
          duration: 2.2,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });
      }

      if (ghosts.length) {
        gsap.fromTo(
          ghosts,
          { x: 12, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.5,
            stagger: 0.08,
            ease: 'power2.out',
            delay: 0.15,
          }
        );
        gsap.to(ghosts, {
          x: -3,
          duration: 1.8,
          stagger: 0.12,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          delay: 0.7,
        });
      }
    },
    { dependencies: [selectedId], scope: emptyHintRef, revertOnUpdate: true }
  );

  useGSAP(
    () => {
      const el = detailBodyRef.current;
      if (!el || !detail) return;
      if (skipEnterAnimRef.current || prefersReducedMotion()) {
        skipEnterAnimRef.current = false;
        gsap.set(el, { clearProps: 'transform,opacity', opacity: 1, y: 0 });
        return;
      }
      gsap.fromTo(
        el,
        { y: -36, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.34, ease: 'power2.out' }
      );
    },
    { dependencies: [detail?.id], scope: detailShellRef }
  );

  useGSAP(
    () => {
      if (!deleteTarget) return;
      const backdrop = deleteBackdropRef.current;
      const card = deleteCardRef.current;
      if (!backdrop || !card) return;
      if (prefersReducedMotion()) {
        gsap.set(backdrop, { autoAlpha: 1 });
        gsap.set(card, { clearProps: 'all', autoAlpha: 1, y: 0, scale: 1 });
        return;
      }
      gsap.fromTo(backdrop, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.22, ease: 'power2.out' });
      gsap.fromTo(
        card,
        { y: 28, scale: 0.94, autoAlpha: 0 },
        { y: 0, scale: 1, autoAlpha: 1, duration: 0.38, ease: 'power3.out' }
      );
    },
    { dependencies: [deleteTarget?.id] }
  );

  const loadList = useCallback(async () => {
    const params = new URLSearchParams({
      limit: String(pageSize),
      page: String(page),
      filter,
    });
    if (search.trim()) params.set('search', search.trim());
    const res = await api<{
      data: CustomerRow[];
      debtorCount: number;
      pagination: { page: number; limit: number; total: number };
    }>(`/api/admin/customers?${params}`);
    setItems(res.data);
    setDebtorCount(res.debtorCount);
    setTotal(res.pagination?.total ?? res.data.length);
  }, [filter, search, page]);

  const loadRewards = useCallback(async () => {
    const [rewardsRes, productsRes, groupsRes] = await Promise.all([
      api<{ rules: PointsRewardRule[] }>('/api/admin/customers/points-rewards'),
      api<{ data: RewardOption[] }>('/api/admin/products?limit=500'),
      api<{ data: RewardOption[] }>('/api/admin/groups?limit=200'),
    ]);
    setRewardRules(rewardsRes.rules || []);
    setRewardProducts(
      (productsRes.data || []).map((p) => ({ id: p.id, name: p.name })).filter((p) => p.name)
    );
    setRewardGroups(
      (groupsRes.data || []).map((g) => ({ id: g.id, name: g.name })).filter((g) => g.name)
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadList()
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadList]);

  useEffect(() => {
    let cancelled = false;
    setRewardsLoading(true);
    loadRewards()
      .catch(() => {
        if (!cancelled) setRewardRules([]);
      })
      .finally(() => {
        if (!cancelled) setRewardsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadRewards]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchDraft);
      setPage(1);
    }, 280);
    return () => window.clearTimeout(t);
  }, [searchDraft]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  function applyDetailForms(customer: CustomerRow) {
    setPointsDraft(String(customer.points));
    const d = customer.discount;
    setDiscountType(d?.type === 'amount' ? 'amount' : 'percent');
    setDiscountDraft(d && d.value > 0 ? String(d.value) : '');
    setDiscountNote(d?.note || '');
    setDebtAmount('');
    setDebtNote('');
    setPayAmount(customer.debtBalance > 0 ? String(customer.debtBalance) : '');
    setPayNote('');
  }

  async function animateDetailOut() {
    const el = detailBodyRef.current;
    if (!el || prefersReducedMotion()) return;
    await new Promise<void>((resolve) => {
      gsap.to(el, {
        y: 42,
        opacity: 0,
        duration: 0.22,
        ease: 'power2.in',
        onComplete: () => resolve(),
      });
    });
  }

  async function openCustomer(
    id: number,
    opts?: { keepTab?: boolean; skipAnim?: boolean; ledgerPage?: number }
  ) {
    const prevId = selectedIdRef.current;
    const shouldAnimOut =
      !opts?.skipAnim && prevId != null && prevId !== id && detailBodyRef.current != null;

    const token = ++animTokenRef.current;
    skipEnterAnimRef.current = Boolean(opts?.skipAnim);
    const pageForLedger = opts?.ledgerPage ?? (prevId === id ? ledgerPage : 1);

    if (shouldAnimOut) {
      await animateDetailOut();
      if (token !== animTokenRef.current) return;
    }

    setSelectedId(id);
    if (!opts?.keepTab) setDetailTab('manage');
    if (prevId !== id) setLedgerPage(1);
    else if (opts?.ledgerPage != null) setLedgerPage(opts.ledgerPage);
    setDetailLoading(true);
    try {
      const qs = new URLSearchParams({
        ledgerPage: String(pageForLedger),
        ledgerLimit: String(ledgerPageSize),
      });
      const res = await api<{
        customer: CustomerRow;
        ledger: LedgerEntry[];
        ledgerPagination?: { page: number; limit: number; total: number };
      }>(`/api/admin/customers/${id}?${qs}`);
      if (token !== animTokenRef.current) return;
      setDetail(res.customer);
      setLedger(res.ledger);
      setLedgerTotal(res.ledgerPagination?.total ?? res.ledger.length);
      if (res.ledgerPagination?.page) setLedgerPage(res.ledgerPagination.page);
      applyDetailForms(res.customer);
      setDetailLoading(false);
    } catch (e) {
      if (token !== animTokenRef.current) return;
      setToast(e instanceof Error ? e.message : 'Yüklenemedi');
      setDetailLoading(false);
    }
  }

  useGSAP(
    () => {
      const list = ledgerListRef.current;
      if (!list || detailTab !== 'ledger' || ledger.length === 0) return;
      if (prefersReducedMotion()) return;
      const items = list.querySelectorAll(':scope > li');
      gsap.fromTo(
        items,
        { y: -14, opacity: 0.35 },
        {
          y: 0,
          opacity: 1,
          duration: 0.32,
          stagger: 0.035,
          ease: 'power2.out',
          overwrite: 'auto',
        }
      );
      const undo = undoBtnRef.current;
      if (undo) {
        gsap.fromTo(
          undo,
          { scale: 0.86, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.28, ease: 'back.out(1.6)' }
        );
      }
    },
    {
      dependencies: [ledger[0]?.id, ledger.length, detailTab, ledgerPage],
      revertOnUpdate: true,
    }
  );

  async function refreshSelected(opts?: { skipAnim?: boolean }) {
    if (selectedId == null) return;
    await loadList();
    await openCustomer(selectedId, {
      keepTab: true,
      skipAnim: opts?.skipAnim ?? true,
      ledgerPage: 1,
    });
  }

  async function savePoints(mode: 'set' | 'delta', value: number) {
    if (!detail || busy) return;
    setBusy(true);
    try {
      await api(`/api/admin/customers/${detail.id}/points`, {
        method: 'PATCH',
        body: JSON.stringify(mode === 'set' ? { set: value } : { delta: value }),
      });
      setToast('Puan güncellendi');
      await refreshSelected();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Puan kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }

  async function saveDiscount(opts?: {
    type?: DiscountType;
    value?: number;
    note?: string;
  }) {
    if (!detail || busy) return;
    const type = opts?.type ?? discountType;
    const value =
      opts?.value !== undefined ? opts.value : Number(discountDraft) || 0;
    const note = opts?.note !== undefined ? opts.note : discountNote;
    setBusy(true);
    try {
      await api(`/api/admin/customers/${detail.id}/discount`, {
        method: 'PATCH',
        body: JSON.stringify({ type, value, note }),
      });
      setToast(value <= 0 ? 'İndirim kaldırıldı' : 'İndirim kaydedildi');
      await refreshSelected();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'İndirim kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }

  async function addDebt() {
    if (!detail || busy) return;
    const amount = Number(debtAmount);
    if (!(amount > 0)) return;
    setBusy(true);
    try {
      await api(`/api/admin/customers/${detail.id}/debt`, {
        method: 'POST',
        body: JSON.stringify({ amount, note: debtNote }),
      });
      setToast('Borç eklendi');
      setDebtAmount('');
      setDebtNote('');
      setDetailTab('ledger');
      setLedgerPage(1);
      await refreshSelected();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Borç eklenemedi');
    } finally {
      setBusy(false);
    }
  }

  async function addPayment() {
    if (!detail || busy) return;
    const amount = Number(payAmount);
    if (!(amount > 0)) return;
    setBusy(true);
    try {
      await api(`/api/admin/customers/${detail.id}/payment`, {
        method: 'POST',
        body: JSON.stringify({ amount, note: payNote }),
      });
      setToast('Ödeme kaydedildi');
      setPayAmount('');
      setPayNote('');
      setDetailTab('ledger');
      setLedgerPage(1);
      await refreshSelected();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Ödeme kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }

  async function undoLast() {
    if (!detail || busy || ledgerTotal <= 0) return;
    setBusy(true);
    try {
      const res = await api<{
        customer: CustomerRow;
        ledger: LedgerEntry[];
        ledgerPagination?: { page: number; limit: number; total: number };
      }>(`/api/admin/customers/${detail.id}/undo`, { method: 'POST' });
      setDetail(res.customer);
      setLedger(res.ledger);
      setLedgerTotal(res.ledgerPagination?.total ?? res.ledger.length);
      setLedgerPage(res.ledgerPagination?.page ?? 1);
      applyDetailForms(res.customer);
      setToast('Son işlem geri alındı');
      await loadList();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Geri alınamadı');
    } finally {
      setBusy(false);
    }
  }

  function requestDelete(customer: CustomerRow, e: ReactMouseEvent) {
    e.stopPropagation();
    setDeleteTarget(customer);
    setDeletePassword('');
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteBusy) return;
    if (!deletePassword.trim()) {
      setToast('Şifre gerekli');
      return;
    }
    setDeleteBusy(true);
    try {
      await api(`/api/admin/customers/${deleteTarget.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword }),
      });
      const deletedId = deleteTarget.id;
      setDeleteTarget(null);
      setDeletePassword('');
      setToast('Müşteri silindi');
      if (selectedId === deletedId) {
        setSelectedId(null);
        setDetail(null);
        setLedger([]);
      }
      await loadList();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setDeleteBusy(false);
    }
  }

  async function persistRewards(next: PointsRewardRule[], toastMsg?: string) {
    setRewardsBusy(true);
    try {
      const ordered = next.map((r, i) => ({ ...r, sortOrder: i }));
      const res = await api<{ rules: PointsRewardRule[] }>(
        '/api/admin/customers/points-rewards',
        {
          method: 'PUT',
          body: JSON.stringify({ rules: ordered }),
        }
      );
      setRewardRules(res.rules || ordered);
      if (toastMsg) setToast(toastMsg);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Kurallar kaydedilemedi');
      throw e;
    } finally {
      setRewardsBusy(false);
    }
  }

  function openRewardComposer(kind: PointsRewardKind = 'custom') {
    setEditingRewardId(null);
    setRewardDraft(emptyRewardDraft(kind));
    setComposerOpen(true);
  }

  function startEditReward(rule: PointsRewardRule) {
    setEditingRewardId(rule.id);
    setRewardDraft({
      kind: rule.kind || 'custom',
      title: rule.title,
      pointsCost: String(rule.pointsCost),
      description: rule.description || '',
      productId: rule.productId ? String(rule.productId) : '',
      groupId: rule.groupId ? String(rule.groupId) : '',
      discountPercent:
        rule.discountPercent != null ? String(rule.discountPercent) : '10',
      amountValue: rule.amountValue != null ? String(rule.amountValue) : '1',
    });
    setComposerOpen(true);
  }

  function closeRewardComposer() {
    setComposerOpen(false);
    setEditingRewardId(null);
    setRewardDraft(emptyRewardDraft());
  }

  function buildRuleFromDraft(): PointsRewardRule | null {
    const kind = rewardDraft.kind;
    const pointsCost = Math.max(0, Math.round(Number(rewardDraft.pointsCost) || 0));
    if (pointsCost <= 0) {
      setToast('Puan maliyeti gerekli');
      return null;
    }

    const productId = Number(rewardDraft.productId) || 0;
    const groupId = Number(rewardDraft.groupId) || 0;
    const discountPercent = Number(rewardDraft.discountPercent) || 0;
    const amountValue = Number(rewardDraft.amountValue) || 0;
    const product = rewardProducts.find((p) => p.id === productId);
    const group = rewardGroups.find((g) => g.id === groupId);

    if (kind === 'custom') {
      const title = rewardDraft.title.trim();
      if (!title) {
        setToast('Başlık gerekli');
        return null;
      }
      return {
        id: editingRewardId || crypto.randomUUID(),
        kind,
        title,
        pointsCost,
        description: rewardDraft.description.trim(),
        active: true,
        sortOrder: rewardRules.length,
        productId: null,
        productName: '',
        groupId: null,
        groupName: '',
        discountPercent: null,
        amountValue: null,
      };
    }

    if (kind === 'product') {
      if (!product) {
        setToast('Ürün seçin');
        return null;
      }
      return {
        id: editingRewardId || crypto.randomUUID(),
        kind,
        title: `${product.name} bedava`,
        pointsCost,
        description: rewardDraft.description.trim(),
        active: true,
        sortOrder: rewardRules.length,
        productId: product.id,
        productName: product.name,
        groupId: null,
        groupName: '',
        discountPercent: null,
        amountValue: null,
      };
    }

    if (kind === 'group') {
      if (!group) {
        setToast('Grup seçin');
        return null;
      }
      if (!(discountPercent > 0 && discountPercent <= 100)) {
        setToast('Geçerli bir indirim yüzdesi girin');
        return null;
      }
      return {
        id: editingRewardId || crypto.randomUUID(),
        kind,
        title: `${group.name} %${discountPercent} indirim`,
        pointsCost,
        description: rewardDraft.description.trim(),
        active: true,
        sortOrder: rewardRules.length,
        productId: null,
        productName: '',
        groupId: group.id,
        groupName: group.name,
        discountPercent,
        amountValue: null,
      };
    }

    if (!(amountValue > 0)) {
      setToast('İndirim tutarı gerekli');
      return null;
    }
    return {
      id: editingRewardId || crypto.randomUUID(),
      kind: 'wallet',
      title: `${pointsCost} puan = ${amountValue}₺`,
      pointsCost,
      description: rewardDraft.description.trim(),
      active: true,
      sortOrder: rewardRules.length,
      productId: null,
      productName: '',
      groupId: null,
      groupName: '',
      discountPercent: null,
      amountValue,
    };
  }

  async function saveRewardDraft() {
    const built = buildRuleFromDraft();
    if (!built) return;
    try {
      if (editingRewardId) {
        const prev = rewardRules.find((r) => r.id === editingRewardId);
        const next = rewardRules.map((r) =>
          r.id === editingRewardId
            ? { ...built, id: editingRewardId, active: prev?.active !== false, sortOrder: r.sortOrder }
            : r
        );
        await persistRewards(next, 'Ödül kuralı güncellendi');
      } else {
        await persistRewards([...rewardRules, built], 'Ödül kuralı eklendi');
      }
      closeRewardComposer();
    } catch {
      /* toast already set */
    }
  }

  async function toggleRewardActive(id: string) {
    const next = rewardRules.map((r) =>
      r.id === id ? { ...r, active: !r.active } : r
    );
    try {
      await persistRewards(next);
    } catch {
      /* toast already set */
    }
  }

  async function deleteReward(id: string) {
    const ok = window.confirm('Bu ödül kuralı silinsin mi?');
    if (!ok) return;
    try {
      await persistRewards(
        rewardRules.filter((r) => r.id !== id),
        'Ödül kuralı silindi'
      );
      if (editingRewardId === id) closeRewardComposer();
    } catch {
      /* toast already set */
    }
  }

  const empty = !loading && items.length === 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const ledgerPageCount = Math.max(1, Math.ceil(ledgerTotal / ledgerPageSize));

  const summary = useMemo(() => {
    if (!detail) return null;
    return [
      {
        key: 'points' as const,
        label: 'Puan',
        value: String(detail.points),
        icon: Coins,
        ref: pointsStatRef,
      },
      {
        key: 'discount' as const,
        label: 'İndirim',
        value: detail.discount ? formatDiscount(detail.discount) : 'Yok',
        icon: Percent,
        ref: discountStatRef,
      },
      {
        key: 'debt' as const,
        label: 'Borç',
        value: formatMoney(detail.debtBalance),
        icon: Wallet,
        warn: detail.debtBalance > 0,
        ref: debtStatRef,
      },
    ];
  }, [detail]);

  const discountPresets =
    discountType === 'percent' ? [5, 10, 15, 20] : [25, 50, 100];

  return (
    <div className="admin-customers">
      <PageHeader title="Müşteriler" />

      {toast ? (
        <div className="admin-customers__toast" role="status">
          {toast}
        </div>
      ) : null}

      <div className={`admin-customers__layout${selectedId ? ' is-open' : ''}`}>
        <section className="admin-customers__list-panel">
          <div className="admin-customers__toolbar">
            <label className="admin-customers__search">
              <Search className="w-4 h-4" />
              <input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Ad, e-posta veya telefon ara…"
              />
            </label>
            <div className="admin-customers__filters" role="tablist">
              <button
                type="button"
                className={filter === 'all' ? 'is-active' : ''}
                onClick={() => {
                  setFilter('all');
                  setPage(1);
                }}
              >
                Tümü
              </button>
              <button
                type="button"
                className={filter === 'debtors' ? 'is-active' : ''}
                onClick={() => {
                  setFilter('debtors');
                  setPage(1);
                }}
              >
                Borçlular
                {debtorCount > 0 ? <em>{debtorCount}</em> : null}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="admin-customers__loading">
              <Spinner />
            </div>
          ) : empty ? (
            <div className="admin-customers__empty">
              <UserRound className="w-8 h-8" />
              <p>Henüz müşteri yok veya arama sonucu boş.</p>
            </div>
          ) : (
            <>
              <ul className="admin-customers__list">
                {items.map((c, i) => (
                  <li key={c.id} style={{ animationDelay: `${Math.min(i, 14) * 28}ms` }}>
                    <div
                      className={`admin-customers__row${selectedId === c.id ? ' is-active' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => void openCustomer(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          void openCustomer(c.id);
                        }
                      }}
                    >
                      <span className="admin-customers__avatar" aria-hidden>
                        {initials(c.fullName)}
                      </span>
                      <span className="admin-customers__meta">
                        <strong>{c.fullName}</strong>
                        <small>
                          {[c.phone, c.email].filter(Boolean).join(' · ') || 'İletişim yok'}
                        </small>
                      </span>
                      <span className="admin-customers__badges">
                        {c.discount ? (
                          <span className="admin-customers__chip is-discount">
                            {formatDiscount(c.discount)}
                          </span>
                        ) : null}
                        {c.debtBalance > 0 ? (
                          <span className="admin-customers__chip is-debt">
                            {formatMoney(c.debtBalance)}
                          </span>
                        ) : null}
                        <span className="admin-customers__chip is-points">{c.points} p</span>
                      </span>
                      <button
                        type="button"
                        className="admin-customers__row-delete"
                        aria-label={`${c.fullName} sil`}
                        title="Sil"
                        onClick={(e) => requestDelete(c, e)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {pageCount > 1 || total > 0 ? (
                <div className="admin-customers__pager">
                  <span>
                    {total === 0
                      ? '0 kayıt'
                      : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} / ${total}`}
                  </span>
                  <div className="admin-customers__pager-btns">
                    <button
                      type="button"
                      disabled={page <= 1 || loading}
                      aria-label="Önceki sayfa"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <em>
                      {page} / {pageCount}
                    </em>
                    <button
                      type="button"
                      disabled={page >= pageCount || loading}
                      aria-label="Sonraki sayfa"
                      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>

        <aside className={`admin-customers__detail${selectedId ? ' is-visible' : ''}`}>
          <div className="admin-customers__detail-shell" ref={detailShellRef}>
            {!selectedId ? (
              <div className="admin-customers__detail-empty" ref={emptyHintRef}>
                <div className="admin-customers__empty-hint">
                  <div className="admin-customers__empty-visual" aria-hidden>
                    <span className="admin-customers__empty-ring" />
                    <span className="admin-customers__empty-icon">
                      <UserRound className="w-7 h-7" />
                    </span>
                  </div>

                  <div className="admin-customers__empty-copy">
                    <h3>Müşteri seçin</h3>
                    <p>
                      Soldaki listeden birini seçin. Puan, indirim ve hesap burada
                      açılır.
                    </p>
                  </div>

                  <div className="admin-customers__empty-ghosts" aria-hidden>
                    <span className="admin-customers__empty-ghost" />
                    <span className="admin-customers__empty-ghost" />
                    <span className="admin-customers__empty-ghost" />
                  </div>

                  <p className="admin-customers__empty-cue">
                    <span className="admin-customers__empty-cue-line" />
                    Listeye bakın
                  </p>
                </div>
              </div>
            ) : detailLoading && !detail ? (
              <div className="admin-customers__loading">
                <Spinner />
              </div>
            ) : detail ? (
              <div className="admin-customers__detail-body" ref={detailBodyRef}>
                <div className="admin-customers__detail-inner">
                  <header className="admin-customers__detail-head">
                    <div className="admin-customers__detail-title">
                      <span className="admin-customers__avatar is-lg" aria-hidden>
                        {initials(detail.fullName)}
                      </span>
                      <div>
                        <h2>{detail.fullName}</h2>
                        <p>
                          {[detail.phone, detail.email].filter(Boolean).join(' · ') ||
                            'İletişim bilgisi yok'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="admin-customers__icon-close"
                      aria-label="Kapat"
                      onClick={() => {
                        setSelectedId(null);
                        setDetail(null);
                        setLedger([]);
                        setLedgerPage(1);
                        setLedgerTotal(0);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </header>

                  {summary ? (
                    <div className="admin-customers__stats">
                      {summary.map((s) => (
                        <div
                          key={s.key}
                          ref={s.ref}
                          className={`admin-customers__stat${s.warn ? ' is-warn' : ''}`}
                          data-stat={s.key}
                        >
                          <s.icon className="w-4 h-4" />
                          <span>{s.label}</span>
                          <strong>{s.value}</strong>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="admin-customers__tabs-wrap">
                    <div className="admin-customers__tabs" role="tablist">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={detailTab === 'manage'}
                        className={detailTab === 'manage' ? 'is-active' : ''}
                        onClick={() => setDetailTab('manage')}
                      >
                        İşlemler
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={detailTab === 'ledger'}
                        className={detailTab === 'ledger' ? 'is-active' : ''}
                        onClick={() => setDetailTab('ledger')}
                      >
                        Hareketler
                        {ledgerTotal > 0 ? <em>{ledgerTotal}</em> : null}
                      </button>
                    </div>
                  </div>

                  <div className="admin-customers__tab-body" key={detailTab}>
                    {detailTab === 'manage' ? (
                      <div className="admin-customers__manage">
                        <section className="admin-customers__block">
                          <div className="admin-customers__block-head">
                            <h3>
                              <Coins className="w-4 h-4" /> Puan
                            </h3>
                            <div className="admin-customers__quick admin-customers__quick--points">
                              {[10, 50, 100].map((n) => (
                                <button
                                  key={`p-${n}`}
                                  type="button"
                                  disabled={busy}
                                  onClick={() => {
                                    const base = Number(pointsDraft) || detail.points || 0;
                                    setPointsDraft(String(Math.max(0, base + n)));
                                  }}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="admin-customers__inline">
                            <input
                              inputMode="numeric"
                              value={pointsDraft}
                              onChange={(e) =>
                                setPointsDraft(sanitizeNumberInput(e.target.value))
                              }
                              aria-label="Puan"
                            />
                            <button
                              type="button"
                              className="admin-customers__quick-minus"
                              disabled={busy || (Number(pointsDraft) || detail.points) <= 0}
                              title="−10"
                              aria-label="10 puan azalt"
                              onClick={() => {
                                const base = Number(pointsDraft) || detail.points || 0;
                                setPointsDraft(String(Math.max(0, base - 10)));
                              }}
                            >
                              <Minus className="w-3.5 h-3.5" />
                              10
                            </button>
                            <button
                              type="button"
                              className="admin-customers__primary"
                              disabled={busy}
                              onClick={() =>
                                void savePoints('set', Number(pointsDraft) || 0)
                              }
                            >
                              Kaydet
                            </button>
                          </div>
                        </section>

                        <section className="admin-customers__block">
                          <div className="admin-customers__block-head">
                            <h3>
                              <Percent className="w-4 h-4" /> Özel indirim
                            </h3>
                            <div className="admin-customers__discount-type" role="group">
                              <button
                                type="button"
                                className={discountType === 'percent' ? 'is-active' : ''}
                                disabled={busy}
                                onClick={() => setDiscountType('percent')}
                              >
                                %
                              </button>
                              <button
                                type="button"
                                className={discountType === 'amount' ? 'is-active' : ''}
                                disabled={busy}
                                onClick={() => setDiscountType('amount')}
                              >
                                ₺
                              </button>
                            </div>
                          </div>
                          <div className="admin-customers__quick">
                            {discountPresets.map((n) => (
                              <button
                                key={`d-${discountType}-${n}`}
                                type="button"
                                disabled={busy}
                                onClick={() => setDiscountDraft(String(n))}
                              >
                                {discountType === 'amount' ? `${n}₺` : `%${n}`}
                              </button>
                            ))}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setDiscountDraft('0')}
                            >
                              Kaldır
                            </button>
                          </div>
                          <div className="admin-customers__inline" style={{ marginTop: '0.45rem' }}>
                            <input
                              inputMode="decimal"
                              placeholder={discountType === 'amount' ? '₺' : '%'}
                              value={discountDraft}
                              onChange={(e) =>
                                setDiscountDraft(
                                  sanitizeNumberInput(e.target.value, {
                                    allowDecimal: discountType === 'amount',
                                  })
                                )
                              }
                              aria-label="İndirim değeri"
                            />
                            <input
                              type="text"
                              placeholder="Not"
                              value={discountNote}
                              onChange={(e) => setDiscountNote(e.target.value)}
                              aria-label="İndirim notu"
                            />
                            <button
                              type="button"
                              className="admin-customers__primary"
                              disabled={busy}
                              onClick={() => void saveDiscount()}
                            >
                              Uygula
                            </button>
                          </div>
                        </section>

                        <section className="admin-customers__block">
                          <div className="admin-customers__block-head">
                            <h3>
                              <Wallet className="w-4 h-4" /> Hesap / borç
                            </h3>
                            <p className="admin-customers__balance">
                              Bakiye{' '}
                              <strong className={detail.debtBalance > 0 ? 'is-debt' : ''}>
                                {formatMoney(detail.debtBalance)}
                              </strong>
                            </p>
                          </div>
                          <div className="admin-customers__forms">
                            <div>
                              <span>Borç ekle</span>
                              <div className="admin-customers__inline">
                                <input
                                  inputMode="decimal"
                                  placeholder="Tutar"
                                  value={debtAmount}
                                  onChange={(e) =>
                                    setDebtAmount(
                                      sanitizeNumberInput(e.target.value, {
                                        allowDecimal: true,
                                      })
                                    )
                                  }
                                />
                                <input
                                  type="text"
                                  placeholder="Not"
                                  value={debtNote}
                                  onChange={(e) => setDebtNote(e.target.value)}
                                />
                                <button
                                  type="button"
                                  className="admin-customers__warn"
                                  disabled={busy || !(Number(debtAmount) > 0)}
                                  onClick={() => void addDebt()}
                                >
                                  Ekle
                                </button>
                              </div>
                            </div>
                            <div>
                              <span>Ödeme / kapat</span>
                              <div className="admin-customers__inline">
                                <input
                                  inputMode="decimal"
                                  placeholder="Tutar"
                                  value={payAmount}
                                  onChange={(e) =>
                                    setPayAmount(
                                      sanitizeNumberInput(e.target.value, {
                                        allowDecimal: true,
                                      })
                                    )
                                  }
                                />
                                <input
                                  type="text"
                                  placeholder="Not"
                                  value={payNote}
                                  onChange={(e) => setPayNote(e.target.value)}
                                />
                                <button
                                  type="button"
                                  className="admin-customers__ok"
                                  disabled={
                                    busy ||
                                    detail.debtBalance <= 0 ||
                                    !(Number(payAmount) > 0)
                                  }
                                  onClick={() => void addPayment()}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Öde
                                </button>
                              </div>
                            </div>
                          </div>
                        </section>
                      </div>
                    ) : (
                      <div className="admin-customers__ledger-wrap">
                        {ledger.length === 0 ? (
                          <div className="admin-customers__ledger-empty">
                            <Receipt className="w-7 h-7" />
                            <p>Henüz hareket yok</p>
                          </div>
                        ) : (
                          <>
                            <ul className="admin-customers__ledger" ref={ledgerListRef}>
                              {ledger.map((e, i) => (
                                <li
                                  key={e.id}
                                  className={`is-${e.kind}${
                                    i === 0 && ledgerPage === 1 ? ' is-latest' : ''
                                  }`}
                                >
                                  <div className="admin-customers__ledger-main">
                                    <div>
                                      <strong>{ledgerKindLabel(e.kind)}</strong>
                                      <small>{formatDate(e.createdAt)}</small>
                                      {e.note ? (
                                        <span className="admin-customers__ledger-note">
                                          {e.note}
                                        </span>
                                      ) : null}
                                    </div>
                                    <em>
                                      {e.kind === 'points'
                                        ? `${e.amount > 0 ? '+' : ''}${e.amount} p`
                                        : e.kind === 'discount'
                                          ? e.amount <= 0
                                            ? 'Kaldırıldı'
                                            : String(e.amount)
                                          : `${e.kind === 'payment' ? '−' : '+'}${formatMoney(e.amount)}`}
                                    </em>
                                  </div>
                                  {i === 0 && ledgerPage === 1 ? (
                                    <button
                                      ref={undoBtnRef}
                                      type="button"
                                      className="admin-customers__ledger-undo"
                                      disabled={busy}
                                      onClick={() => void undoLast()}
                                    >
                                      <Undo2 className="w-3.5 h-3.5" />
                                      Geri al
                                    </button>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                            {ledgerTotal > ledgerPageSize ? (
                              <div className="admin-customers__pager admin-customers__pager--ledger">
                                <span>
                                  {(ledgerPage - 1) * ledgerPageSize + 1}–
                                  {Math.min(ledgerPage * ledgerPageSize, ledgerTotal)} /{' '}
                                  {ledgerTotal}
                                </span>
                                <div className="admin-customers__pager-btns">
                                  <button
                                    type="button"
                                    disabled={ledgerPage <= 1 || busy}
                                    aria-label="Önceki hareket sayfası"
                                    onClick={() => {
                                      if (selectedId == null) return;
                                      void openCustomer(selectedId, {
                                        keepTab: true,
                                        skipAnim: true,
                                        ledgerPage: ledgerPage - 1,
                                      });
                                    }}
                                  >
                                    <ChevronLeft className="w-4 h-4" />
                                  </button>
                                  <em>
                                    {ledgerPage} / {ledgerPageCount}
                                  </em>
                                  <button
                                    type="button"
                                    disabled={ledgerPage >= ledgerPageCount || busy}
                                    aria-label="Sonraki hareket sayfası"
                                    onClick={() => {
                                      if (selectedId == null) return;
                                      void openCustomer(selectedId, {
                                        keepTab: true,
                                        skipAnim: true,
                                        ledgerPage: ledgerPage + 1,
                                      });
                                    }}
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="admin-customers__loading">
                <Spinner />
              </div>
            )}
          </div>
        </aside>
      </div>

      <section className="admin-customers__rewards">
        <header className="admin-customers__rewards-head">
          <div>
            <h2>
              <Gift className="w-4 h-4" />
              Puan ödülleri
            </h2>
            <p>
              Ürün, grup veya tutar indirimi tanımlayın. Masa görünümünde temaya
              bağlanacak.
            </p>
          </div>
          <button
            type="button"
            className="admin-customers__rewards-add"
            disabled={rewardsBusy || rewardsLoading}
            onClick={() => openRewardComposer('custom')}
          >
            <Plus className="w-4 h-4" />
            Ekle
          </button>
        </header>

        {rewardsLoading ? (
          <div className="admin-customers__rewards-loading">
            <Spinner />
          </div>
        ) : (
          <>
            {composerOpen ? (
              <div className="admin-customers__reward-composer">
                <div className="admin-customers__reward-composer-top">
                  <strong>{editingRewardId ? 'Kuralı düzenle' : 'Yeni kural'}</strong>
                  <button
                    type="button"
                    className="admin-customers__icon-close"
                    aria-label="Kapat"
                    onClick={closeRewardComposer}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="admin-customers__reward-kinds" role="tablist">
                  {REWARD_KINDS.map((k) => {
                    const Icon = k.icon;
                    return (
                      <button
                        key={k.id}
                        type="button"
                        role="tab"
                        aria-selected={rewardDraft.kind === k.id}
                        className={rewardDraft.kind === k.id ? 'is-active' : ''}
                        disabled={Boolean(editingRewardId)}
                        onClick={() =>
                          setRewardDraft((d) => ({ ...emptyRewardDraft(k.id), pointsCost: d.pointsCost, description: d.description }))
                        }
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{k.label}</span>
                        <small>{k.hint}</small>
                      </button>
                    );
                  })}
                </div>

                <div className="admin-customers__reward-fields">
                  {rewardDraft.kind === 'custom' ? (
                    <>
                      <label>
                        <span>Başlık</span>
                        <input
                          type="text"
                          placeholder="Örn. Bedava çay"
                          value={rewardDraft.title}
                          onChange={(e) =>
                            setRewardDraft((d) => ({ ...d, title: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        <span>Açıklama</span>
                        <input
                          type="text"
                          placeholder="Kısa not (opsiyonel)"
                          value={rewardDraft.description}
                          onChange={(e) =>
                            setRewardDraft((d) => ({ ...d, description: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        <span>Puan maliyeti</span>
                        <input
                          inputMode="numeric"
                          placeholder="100"
                          value={rewardDraft.pointsCost}
                          onChange={(e) =>
                            setRewardDraft((d) => ({
                              ...d,
                              pointsCost: sanitizeNumberInput(e.target.value),
                            }))
                          }
                        />
                      </label>
                    </>
                  ) : null}

                  {rewardDraft.kind === 'product' ? (
                    <>
                      <label>
                        <span>Ürün</span>
                        <SearchableSelect
                          options={rewardProducts}
                          value={rewardDraft.productId}
                          placeholder="Ürün seçin…"
                          onChange={(id) =>
                            setRewardDraft((d) => ({ ...d, productId: id }))
                          }
                        />
                      </label>
                      <label>
                        <span>Not</span>
                        <input
                          type="text"
                          placeholder="Opsiyonel"
                          value={rewardDraft.description}
                          onChange={(e) =>
                            setRewardDraft((d) => ({ ...d, description: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        <span>Puan maliyeti</span>
                        <input
                          inputMode="numeric"
                          placeholder="100"
                          value={rewardDraft.pointsCost}
                          onChange={(e) =>
                            setRewardDraft((d) => ({
                              ...d,
                              pointsCost: sanitizeNumberInput(e.target.value),
                            }))
                          }
                        />
                      </label>
                    </>
                  ) : null}

                  {rewardDraft.kind === 'group' ? (
                    <>
                      <label>
                        <span>Grup</span>
                        <SearchableSelect
                          options={rewardGroups}
                          value={rewardDraft.groupId}
                          placeholder="Grup seçin…"
                          onChange={(id) =>
                            setRewardDraft((d) => ({ ...d, groupId: id }))
                          }
                        />
                      </label>
                      <label>
                        <span>% İndirim</span>
                        <input
                          inputMode="decimal"
                          placeholder="10"
                          value={rewardDraft.discountPercent}
                          onChange={(e) =>
                            setRewardDraft((d) => ({
                              ...d,
                              discountPercent: sanitizeNumberInput(e.target.value, {
                                allowDecimal: true,
                              }),
                            }))
                          }
                        />
                      </label>
                      <label>
                        <span>Puan maliyeti</span>
                        <input
                          inputMode="numeric"
                          placeholder="500"
                          value={rewardDraft.pointsCost}
                          onChange={(e) =>
                            setRewardDraft((d) => ({
                              ...d,
                              pointsCost: sanitizeNumberInput(e.target.value),
                            }))
                          }
                        />
                      </label>
                    </>
                  ) : null}

                  {rewardDraft.kind === 'wallet' ? (
                    <>
                      <label>
                        <span>İndirim tutarı (₺)</span>
                        <input
                          inputMode="decimal"
                          placeholder="1"
                          value={rewardDraft.amountValue}
                          onChange={(e) =>
                            setRewardDraft((d) => ({
                              ...d,
                              amountValue: sanitizeNumberInput(e.target.value, {
                                allowDecimal: true,
                              }),
                            }))
                          }
                        />
                      </label>
                      <label>
                        <span>Not</span>
                        <input
                          type="text"
                          placeholder="Opsiyonel"
                          value={rewardDraft.description}
                          onChange={(e) =>
                            setRewardDraft((d) => ({ ...d, description: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        <span>Puan maliyeti</span>
                        <input
                          inputMode="numeric"
                          placeholder="100"
                          value={rewardDraft.pointsCost}
                          onChange={(e) =>
                            setRewardDraft((d) => ({
                              ...d,
                              pointsCost: sanitizeNumberInput(e.target.value),
                            }))
                          }
                        />
                      </label>
                    </>
                  ) : null}
                </div>

                <div className="admin-customers__reward-composer-actions">
                  <button
                    type="button"
                    className="admin-customers__ghost"
                    disabled={rewardsBusy}
                    onClick={closeRewardComposer}
                  >
                    İptal
                  </button>
                  <button
                    type="button"
                    className="admin-customers__primary"
                    disabled={rewardsBusy}
                    onClick={() => void saveRewardDraft()}
                  >
                    <Check className="w-3.5 h-3.5" />
                    {editingRewardId ? 'Kaydet' : 'Ekle'}
                  </button>
                </div>
              </div>
            ) : null}

            {rewardRules.length === 0 && !composerOpen ? (
              <div className="admin-customers__rewards-empty">
                <Gift className="w-6 h-6" />
                <p>Henüz ödül yok</p>
                <button
                  type="button"
                  className="admin-customers__primary"
                  onClick={() => openRewardComposer('product')}
                >
                  <Plus className="w-3.5 h-3.5" />
                  İlk kuralı ekle
                </button>
              </div>
            ) : (
              <ul className="admin-customers__rewards-grid">
                {rewardRules.map((rule) => {
                  const meta = rewardKindMeta(rule.kind || 'custom');
                  const copy = rewardCardCopy(rule);
                  const Icon = meta.icon;
                  return (
                    <li
                      key={rule.id}
                      className={`admin-customers__reward-card is-${rule.kind || 'custom'}${
                        rule.active ? '' : ' is-inactive'
                      }`}
                    >
                      <div className="admin-customers__reward-card-top">
                        <span className="admin-customers__reward-chip">
                          <Icon className="w-3 h-3" />
                          {meta.label}
                        </span>
                        <em>{rule.pointsCost} puan</em>
                      </div>
                      <strong>{copy.headline}</strong>
                      <p>{copy.detail}</p>
                      {rule.description && rule.kind === 'custom' ? (
                        <small>{rule.description}</small>
                      ) : null}
                      <div className="admin-customers__reward-card-actions">
                        <button
                          type="button"
                          aria-label={rule.active ? 'Pasifleştir' : 'Aktifleştir'}
                          title={rule.active ? 'Pasifleştir' : 'Aktifleştir'}
                          disabled={rewardsBusy}
                          onClick={() => void toggleRewardActive(rule.id)}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Düzenle"
                          title="Düzenle"
                          disabled={rewardsBusy}
                          onClick={() => startEditReward(rule)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          className="is-danger"
                          aria-label="Sil"
                          title="Sil"
                          disabled={rewardsBusy}
                          onClick={() => void deleteReward(rule.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </section>

      {deleteTarget ? (
        <div
          ref={deleteBackdropRef}
          className="admin-customers__modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!deleteBusy) {
              setDeleteTarget(null);
              setDeletePassword('');
            }
          }}
        >
          <div
            ref={deleteCardRef}
            className="admin-customers__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customers-delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="admin-customers__modal-close"
              aria-label="Kapat"
              disabled={deleteBusy}
              onClick={() => {
                setDeleteTarget(null);
                setDeletePassword('');
              }}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="admin-customers__modal-icon" aria-hidden>
              <TriangleAlert className="w-6 h-6" />
            </div>

            <h3 id="customers-delete-title">Müşteriyi sil</h3>
            <p className="admin-customers__modal-copy">
              <strong>{deleteTarget.fullName}</strong> hesabı kalıcı olarak silinecek.
            </p>
            <div className="admin-customers__modal-warn">
              Bu işlem geri alınamaz. Puan, indirim ve borç hareketleri de silinir.
            </div>

            <label className="admin-customers__modal-field">
              <span>
                <Lock className="w-3.5 h-3.5" />
                Yönetici şifresi
              </span>
              <input
                type="password"
                autoFocus
                autoComplete="current-password"
                placeholder="Şifrenizi girin"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void confirmDelete();
                }}
              />
            </label>

            <div className="admin-customers__modal-actions">
              <button
                type="button"
                className="admin-customers__ghost"
                disabled={deleteBusy}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeletePassword('');
                }}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="admin-customers__danger"
                disabled={deleteBusy || !deletePassword.trim()}
                onClick={() => void confirmDelete()}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleteBusy ? 'Siliniyor…' : 'Kalıcı sil'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
