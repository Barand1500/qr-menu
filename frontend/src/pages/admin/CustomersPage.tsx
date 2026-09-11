import { useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader, Spinner } from '@/components/ui';
import '@/admin-customers.css';

type CustomerDiscount = {
  percent: number;
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
  kind: 'debt' | 'payment' | 'points' | string;
  amount: number;
  note: string | null;
  balanceAfter: number | null;
  pointsAfter: number | null;
  createdAt: string;
};

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
  const [discountDraft, setDiscountDraft] = useState('');
  const [discountNote, setDiscountNote] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtNote, setDebtNote] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');

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

  async function openCustomer(id: number, opts?: { keepTab?: boolean }) {
    setSelectedId(id);
    if (!opts?.keepTab) setDetailTab('manage');
    setDetailLoading(true);
    try {
      const res = await api<{ customer: CustomerRow; ledger: LedgerEntry[] }>(
        `/api/admin/customers/${id}`
      );
      setDetail(res.customer);
      setLedger(res.ledger);
      setPointsDraft(String(res.customer.points));
      setDiscountDraft(String(res.customer.discount?.percent || ''));
      setDiscountNote(res.customer.discount?.note || '');
      setDebtAmount('');
      setDebtNote('');
      setPayAmount(res.customer.debtBalance > 0 ? String(res.customer.debtBalance) : '');
      setPayNote('');
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshSelected() {
    if (selectedId == null) return;
    await loadList();
    await openCustomer(selectedId, { keepTab: true });
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

  async function saveDiscount() {
    if (!detail || busy) return;
    setBusy(true);
    try {
      await api(`/api/admin/customers/${detail.id}/discount`, {
        method: 'PATCH',
        body: JSON.stringify({
          percent: Number(discountDraft) || 0,
          note: discountNote,
        }),
      });
      setToast('İndirim kaydedildi');
      await refreshSelected();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'İndirim kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }

  async function addDebt() {
    if (!detail || busy) return;
    setBusy(true);
    try {
      await api(`/api/admin/customers/${detail.id}/debt`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(debtAmount), note: debtNote }),
      });
      setToast('Borç eklendi');
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
    setBusy(true);
    try {
      await api(`/api/admin/customers/${detail.id}/payment`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(payAmount), note: payNote }),
      });
      setToast('Ödeme kaydedildi');
      setDetailTab('ledger');
      await refreshSelected();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Ödeme kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }

  const empty = !loading && items.length === 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const summary = useMemo(() => {
    if (!detail) return null;
    return [
      { label: 'Puan', value: String(detail.points), icon: Coins },
      {
        label: 'İndirim',
        value: detail.discount ? `%${detail.discount.percent}` : 'Yok',
        icon: Percent,
      },
      {
        label: 'Borç',
        value: formatMoney(detail.debtBalance),
        icon: Wallet,
        warn: detail.debtBalance > 0,
      },
    ];
  }, [detail]);

  return (
    <div className="admin-customers">
      <PageHeader title="Müşteriler" />
      <p className="admin-customers__lead">
        Üye hesapları, puan, özel indirim ve borç takibi — bu restorana özel.
      </p>

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
                    <button
                      type="button"
                      className={`admin-customers__row${selectedId === c.id ? ' is-active' : ''}`}
                      onClick={() => void openCustomer(c.id)}
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
                            %{c.discount.percent}
                          </span>
                        ) : null}
                        {c.debtBalance > 0 ? (
                          <span className="admin-customers__chip is-debt">
                            {formatMoney(c.debtBalance)}
                          </span>
                        ) : null}
                        <span className="admin-customers__chip is-points">{c.points} p</span>
                      </span>
                    </button>
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
          {!selectedId ? (
            <div className="admin-customers__detail-empty">
              <Receipt className="w-9 h-9" />
              <h3>Müşteri seçin</h3>
              <p>Listeden bir üyeye tıklayın; puan, indirim ve hesabı burada yönetirsiniz.</p>
            </div>
          ) : detailLoading || !detail ? (
            <div className="admin-customers__loading">
              <Spinner />
            </div>
          ) : (
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
                      key={s.label}
                      className={`admin-customers__stat${s.warn ? ' is-warn' : ''}`}
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
                    <section className="admin-customers__block">
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
                              onClick={() => void savePoints('delta', n)}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              {n}
                            </button>
                          ))}
                          <button
                            type="button"
                            disabled={busy || detail.points <= 0}
                            onClick={() => void savePoints('delta', -10)}
                          >
                            <Minus className="w-3.5 h-3.5" />
                            10
                          </button>
                        </div>
                      </div>
                      <div className="admin-customers__inline">
                        <input
                          type="number"
                          min={0}
                          value={pointsDraft}
                          onChange={(e) => setPointsDraft(e.target.value)}
                          aria-label="Puan"
                        />
                        <button
                          type="button"
                          className="admin-customers__primary"
                          disabled={busy}
                          onClick={() => void savePoints('set', Number(pointsDraft) || 0)}
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
                        <div className="admin-customers__quick">
                          {[5, 10, 15, 20].map((n) => (
                            <button
                              key={`d-${n}`}
                              type="button"
                              disabled={busy}
                              onClick={() => setDiscountDraft(String(n))}
                            >
                              %{n}
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
                      </div>
                      <div className="admin-customers__inline">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          placeholder="%"
                          value={discountDraft}
                          onChange={(e) => setDiscountDraft(e.target.value)}
                          aria-label="İndirim yüzdesi"
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
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="Tutar"
                              value={debtAmount}
                              onChange={(e) => setDebtAmount(e.target.value)}
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
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="Tutar"
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
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
                                busy || detail.debtBalance <= 0 || !(Number(payAmount) > 0)
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
                      <ul className="admin-customers__ledger">
                        {ledger.map((e, i) => (
                          <li
                            key={e.id}
                            className={`is-${e.kind}`}
                            style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                          >
                            <div>
                              <strong>
                                {e.kind === 'debt'
                                  ? 'Borç'
                                  : e.kind === 'payment'
                                    ? 'Ödeme'
                                    : 'Puan'}
                              </strong>
                              <small>{formatDate(e.createdAt)}</small>
                              {e.note ? <span className="admin-customers__ledger-note">{e.note}</span> : null}
                            </div>
                            <em>
                              {e.kind === 'points'
                                ? `${e.amount > 0 ? '+' : ''}${e.amount} p`
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
          )}
        </aside>
      </div>
    </div>
  );
}
