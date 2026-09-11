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

type PointsRewardRule = {
  id: string;
  title: string;
  pointsCost: number;
  description: string;
  active: boolean;
  sortOrder: number;
};

type DiscountType = 'percent' | 'amount';
type FloatTarget = 'points' | 'discount' | 'debt';

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

function playFloatChip(
  fromEl: HTMLElement | null | undefined,
  toEl: HTMLElement | null | undefined,
  label: string
) {
  if (!fromEl || !toEl) return;
  if (prefersReducedMotion()) {
    toEl.classList.add('is-chip-bump');
    window.setTimeout(() => toEl.classList.remove('is-chip-bump'), 420);
    return;
  }

  const from = fromEl.getBoundingClientRect();
  const to = toEl.getBoundingClientRect();
  const chip = document.createElement('div');
  chip.className = 'admin-customers__float-chip';
  chip.textContent = label;
  chip.style.left = `${from.left + from.width / 2}px`;
  chip.style.top = `${from.top + from.height / 2}px`;
  document.body.appendChild(chip);

  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);

  gsap.fromTo(
    chip,
    { x: -28, y: -10, opacity: 0, scale: 0.85 },
    {
      x: 0,
      y: 0,
      opacity: 1,
      scale: 1,
      duration: 0.12,
      ease: 'power2.out',
      onComplete: () => {
        gsap.to(chip, {
          x: dx,
          y: dy,
          scale: 0.72,
          opacity: 0.2,
          duration: 0.55,
          ease: 'power2.in',
          onComplete: () => {
            chip.remove();
            toEl.classList.add('is-chip-bump');
            window.setTimeout(() => toEl.classList.remove('is-chip-bump'), 420);
          },
        });
      },
    }
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
  const [rewardsLoading, setRewardsLoading] = useState(true);
  const [rewardsBusy, setRewardsBusy] = useState(false);
  const [newRewardTitle, setNewRewardTitle] = useState('');
  const [newRewardPoints, setNewRewardPoints] = useState('');
  const [newRewardDesc, setNewRewardDesc] = useState('');
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPoints, setEditPoints] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const detailShellRef = useRef<HTMLDivElement>(null);
  const detailBodyRef = useRef<HTMLDivElement>(null);
  const pointsStatRef = useRef<HTMLDivElement>(null);
  const discountStatRef = useRef<HTMLDivElement>(null);
  const debtStatRef = useRef<HTMLDivElement>(null);
  const pointsActionRef = useRef<HTMLElement | null>(null);
  const discountActionRef = useRef<HTMLElement | null>(null);
  const debtActionRef = useRef<HTMLElement | null>(null);
  const selectedIdRef = useRef<number | null>(null);
  const animTokenRef = useRef(0);
  const skipEnterAnimRef = useRef(false);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

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
    const res = await api<{ rules: PointsRewardRule[] }>(
      '/api/admin/customers/points-rewards'
    );
    setRewardRules(res.rules || []);
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

  async function openCustomer(id: number, opts?: { keepTab?: boolean; skipAnim?: boolean }) {
    const prevId = selectedIdRef.current;
    const shouldAnimOut =
      !opts?.skipAnim && prevId != null && prevId !== id && detailBodyRef.current != null;

    const token = ++animTokenRef.current;
    skipEnterAnimRef.current = Boolean(opts?.skipAnim);

    if (shouldAnimOut) {
      await animateDetailOut();
      if (token !== animTokenRef.current) return;
    }

    setSelectedId(id);
    if (!opts?.keepTab) setDetailTab('manage');
    setDetailLoading(true);
    try {
      const res = await api<{ customer: CustomerRow; ledger: LedgerEntry[] }>(
        `/api/admin/customers/${id}`
      );
      if (token !== animTokenRef.current) return;
      setDetail(res.customer);
      setLedger(res.ledger);
      applyDetailForms(res.customer);
      setDetailLoading(false);
    } catch (e) {
      if (token !== animTokenRef.current) return;
      setToast(e instanceof Error ? e.message : 'Yüklenemedi');
      setDetailLoading(false);
    }
  }

  async function refreshSelected(opts?: { skipAnim?: boolean }) {
    if (selectedId == null) return;
    await loadList();
    await openCustomer(selectedId, { keepTab: true, skipAnim: opts?.skipAnim ?? true });
  }

  function floatTo(target: FloatTarget, label: string) {
    const from =
      target === 'points'
        ? pointsActionRef.current
        : target === 'discount'
          ? discountActionRef.current
          : debtActionRef.current;
    const to =
      target === 'points'
        ? pointsStatRef.current
        : target === 'discount'
          ? discountStatRef.current
          : debtStatRef.current;
    playFloatChip(from, to, label);
  }

  async function savePoints(mode: 'set' | 'delta', value: number, chipLabel?: string) {
    if (!detail || busy) return;
    setBusy(true);
    try {
      await api(`/api/admin/customers/${detail.id}/points`, {
        method: 'PATCH',
        body: JSON.stringify(mode === 'set' ? { set: value } : { delta: value }),
      });
      setToast('Puan güncellendi');
      floatTo(
        'points',
        chipLabel ||
          (mode === 'delta' ? `${value > 0 ? '+' : ''}${value} p` : `${value} p`)
      );
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
    chipLabel?: string;
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
      floatTo(
        'discount',
        opts?.chipLabel ||
          (value <= 0 ? 'Kaldır' : type === 'amount' ? `${value}₺` : `%${value}`)
      );
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
      floatTo('debt', `+${formatMoney(amount)}`);
      setDetailTab('ledger');
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
      floatTo('debt', `−${formatMoney(amount)}`);
      setDetailTab('ledger');
      await refreshSelected();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Ödeme kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }

  async function undoLast() {
    if (!detail || busy || ledger.length === 0) return;
    setBusy(true);
    try {
      const res = await api<{ customer: CustomerRow; ledger: LedgerEntry[] }>(
        `/api/admin/customers/${detail.id}/undo`,
        { method: 'POST' }
      );
      setDetail(res.customer);
      setLedger(res.ledger);
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
    const ok = window.confirm(
      `"${customer.fullName}" müşteri kaydı kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?`
    );
    if (!ok) return;
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

  async function addReward() {
    const title = newRewardTitle.trim();
    const pointsCost = Math.max(0, Math.round(Number(newRewardPoints) || 0));
    if (!title || pointsCost <= 0) {
      setToast('Başlık ve puan maliyeti gerekli');
      return;
    }
    const rule: PointsRewardRule = {
      id: crypto.randomUUID(),
      title,
      pointsCost,
      description: newRewardDesc.trim(),
      active: true,
      sortOrder: rewardRules.length,
    };
    try {
      await persistRewards([...rewardRules, rule], 'Ödül kuralı eklendi');
      setNewRewardTitle('');
      setNewRewardPoints('');
      setNewRewardDesc('');
    } catch {
      /* toast already set */
    }
  }

  function startEditReward(rule: PointsRewardRule) {
    setEditingRewardId(rule.id);
    setEditTitle(rule.title);
    setEditPoints(String(rule.pointsCost));
    setEditDesc(rule.description);
  }

  async function saveEditReward() {
    if (!editingRewardId) return;
    const title = editTitle.trim();
    const pointsCost = Math.max(0, Math.round(Number(editPoints) || 0));
    if (!title || pointsCost <= 0) {
      setToast('Başlık ve puan maliyeti gerekli');
      return;
    }
    const next = rewardRules.map((r) =>
      r.id === editingRewardId
        ? { ...r, title, pointsCost, description: editDesc.trim() }
        : r
    );
    try {
      await persistRewards(next, 'Ödül kuralı güncellendi');
      setEditingRewardId(null);
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
      if (editingRewardId === id) setEditingRewardId(null);
    } catch {
      /* toast already set */
    }
  }

  const empty = !loading && items.length === 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

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
              <div className="admin-customers__detail-empty">
                <Receipt className="w-9 h-9" />
                <h3>Müşteri seçin</h3>
                <p>Listeden bir üyeye tıklayın; puan, indirim ve hesabı burada yönetirsiniz.</p>
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
                      {ledger.length > 0 ? <em>{ledger.length}</em> : null}
                    </button>
                  </div>

                  <div className="admin-customers__tab-body" key={detailTab}>
                    {detailTab === 'manage' ? (
                      <div className="admin-customers__manage">
                        <section className="admin-customers__block" ref={pointsActionRef}>
                          <div className="admin-customers__block-head">
                            <h3>
                              <Coins className="w-4 h-4" /> Puan
                            </h3>
                            <div className="admin-customers__quick">
                              {[10, 50, 100].map((n) => (
                                <button
                                  key={`p-${n}`}
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void savePoints('delta', n, `+${n} p`)}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  {n}
                                </button>
                              ))}
                              <button
                                type="button"
                                disabled={busy || detail.points <= 0}
                                onClick={() => void savePoints('delta', -10, '−10 p')}
                              >
                                <Minus className="w-3.5 h-3.5" />
                                10
                              </button>
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
                              className="admin-customers__primary"
                              disabled={busy}
                              onClick={() =>
                                void savePoints(
                                  'set',
                                  Number(pointsDraft) || 0,
                                  `${Number(pointsDraft) || 0} p`
                                )
                              }
                            >
                              Kaydet
                            </button>
                          </div>
                        </section>

                        <section className="admin-customers__block" ref={discountActionRef}>
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
                                onClick={() =>
                                  void saveDiscount({
                                    type: discountType,
                                    value: n,
                                    chipLabel:
                                      discountType === 'amount' ? `${n}₺` : `%${n}`,
                                  })
                                }
                              >
                                {discountType === 'amount' ? `${n}₺` : `%${n}`}
                              </button>
                            ))}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void saveDiscount({
                                  type: discountType,
                                  value: 0,
                                  chipLabel: 'Kaldır',
                                })
                              }
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

                        <section className="admin-customers__block" ref={debtActionRef}>
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
                        {ledger.length > 0 ? (
                          <div className="admin-customers__ledger-actions">
                            <button
                              type="button"
                              className="admin-customers__undo"
                              disabled={busy}
                              onClick={() => void undoLast()}
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                              Son işlemi geri al
                            </button>
                          </div>
                        ) : null}
                        {ledger.length === 0 ? (
                          <div className="admin-customers__ledger-empty">
                            <Receipt className="w-7 h-7" />
                            <p>Henüz hareket yok</p>
                          </div>
                        ) : (
                          <ul className="admin-customers__ledger">
                            {ledger.map((e, i) => (
                              <li
                                key={e.id}
                                className={`is-${e.kind}`}
                                style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                              >
                                <div>
                                  <strong>{ledgerKindLabel(e.kind)}</strong>
                                  <small>{formatDate(e.createdAt)}</small>
                                  {e.note ? (
                                    <span className="admin-customers__ledger-note">{e.note}</span>
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
                              </li>
                            ))}
                          </ul>
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
              Puan ile neler yapılır?
            </h2>
            <p>
              Müşterilerin puanlarını neye çevirebileceğini tanımlayın — çay, tatlı, tutar
              indirimi…
            </p>
          </div>
        </header>

        {rewardsLoading ? (
          <div className="admin-customers__rewards-loading">
            <Spinner />
          </div>
        ) : (
          <>
            <ul className="admin-customers__rewards-list">
              {rewardRules.length === 0 ? (
                <li className="admin-customers__rewards-empty">
                  Henüz kural yok. Aşağıdan ilk ödülü ekleyin.
                </li>
              ) : (
                rewardRules.map((rule) => (
                  <li
                    key={rule.id}
                    className={`admin-customers__reward${rule.active ? '' : ' is-inactive'}`}
                  >
                    {editingRewardId === rule.id ? (
                      <div className="admin-customers__reward-edit">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="Başlık"
                          aria-label="Ödül başlığı"
                        />
                        <input
                          inputMode="numeric"
                          value={editPoints}
                          onChange={(e) =>
                            setEditPoints(sanitizeNumberInput(e.target.value))
                          }
                          placeholder="Puan"
                          aria-label="Puan maliyeti"
                        />
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder="Açıklama"
                          aria-label="Ödül açıklaması"
                        />
                        <div className="admin-customers__reward-edit-actions">
                          <button
                            type="button"
                            className="admin-customers__primary"
                            disabled={rewardsBusy}
                            onClick={() => void saveEditReward()}
                          >
                            Kaydet
                          </button>
                          <button
                            type="button"
                            className="admin-customers__ghost"
                            disabled={rewardsBusy}
                            onClick={() => setEditingRewardId(null)}
                          >
                            İptal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="admin-customers__reward-main">
                          <strong>{rule.title}</strong>
                          <em>{rule.pointsCost} puan</em>
                          {rule.description ? <p>{rule.description}</p> : null}
                        </div>
                        <div className="admin-customers__reward-actions">
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
                      </>
                    )}
                  </li>
                ))
              )}
            </ul>

            <form
              className="admin-customers__reward-form"
              onSubmit={(e) => {
                e.preventDefault();
                void addReward();
              }}
            >
              <h3>Yeni ödül kuralı</h3>
              <div className="admin-customers__reward-form-grid">
                <input
                  type="text"
                  placeholder="Başlık (ör. Bedava çay)"
                  value={newRewardTitle}
                  onChange={(e) => setNewRewardTitle(e.target.value)}
                  aria-label="Yeni ödül başlığı"
                />
                <input
                  inputMode="numeric"
                  placeholder="Puan maliyeti"
                  value={newRewardPoints}
                  onChange={(e) =>
                    setNewRewardPoints(sanitizeNumberInput(e.target.value))
                  }
                  aria-label="Yeni ödül puan maliyeti"
                />
                <input
                  type="text"
                  placeholder="Kısa açıklama"
                  value={newRewardDesc}
                  onChange={(e) => setNewRewardDesc(e.target.value)}
                  aria-label="Yeni ödül açıklaması"
                />
                <button
                  type="submit"
                  className="admin-customers__primary"
                  disabled={rewardsBusy}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ekle
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      {deleteTarget ? (
        <div
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
            className="admin-customers__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customers-delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="customers-delete-title">Müşteriyi sil</h3>
            <p>
              <strong>{deleteTarget.fullName}</strong> kalıcı olarak silinecek. Onaylamak
              için yönetici şifrenizi girin.
            </p>
            <label className="admin-customers__modal-field">
              <span>Şifre</span>
              <input
                type="password"
                autoFocus
                autoComplete="current-password"
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
                {deleteBusy ? 'Siliniyor…' : 'Kalıcı sil'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
