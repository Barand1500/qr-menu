import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Clock3,
  Plus,
  Receipt,
  UtensilsCrossed,
  X,
  HandHelping,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import '@/table-floor.css';

type FloorOrder = {
  id: string;
  productId?: number | null;
  name: string;
  qty: number;
  price: number;
  createdAt: string;
  source: 'admin' | 'customer';
};

type FloorTable = {
  index: number;
  code: string;
  name: string;
  colorId?: string;
  occupied: boolean;
  openedAt: string | null;
  openedBy: string | null;
  sessionId: number | null;
  orders: FloorOrder[];
  total: number;
  waiterAlertMs: number;
};

type FloorGroup = {
  id: string;
  name: string;
  prefix: string;
  count: number;
  tables: FloorTable[];
};

type FloorPayload = {
  restaurant: { id: number; name: string; slug: string } | null;
  groups: FloorGroup[];
  polledAt: string;
};

type CatalogProduct = {
  id: number;
  name: string;
  price: number;
  groupName: string;
  currency?: { code?: string; symbol?: string } | null;
};

const QR_COLORS: { id: string; fg: string; bg: string }[] = [
  { id: 'black', fg: '#0f172a', bg: '#ffffff' },
  { id: 'navy', fg: '#1e3a5f', bg: '#f8fafc' },
  { id: 'ocean', fg: '#0369a1', bg: '#f0f9ff' },
  { id: 'sky', fg: '#0284c7', bg: '#e0f2fe' },
  { id: 'teal', fg: '#0f766e', bg: '#f0fdfa' },
  { id: 'forest', fg: '#14532d', bg: '#f0fdf4' },
  { id: 'emerald', fg: '#047857', bg: '#ecfdf5' },
  { id: 'wine', fg: '#7f1d1d', bg: '#fff1f2' },
  { id: 'rose', fg: '#be123c', bg: '#fff1f2' },
  { id: 'coral', fg: '#c2410c', bg: '#fff7ed' },
  { id: 'gold', fg: '#78350f', bg: '#fffbeb' },
  { id: 'amber', fg: '#b45309', bg: '#fffbeb' },
  { id: 'purple', fg: '#5b21b6', bg: '#f5f3ff' },
  { id: 'slate', fg: '#475569', bg: '#f8fafc' },
];

function normalizeHex(value: string) {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v.toLowerCase()}`;
  return null;
}

function resolveQrColor(colorId?: string) {
  const id = colorId || 'black';
  const preset = QR_COLORS.find((c) => c.id === id);
  if (preset) return preset;
  const fg = normalizeHex(id) || '#0f172a';
  return { id, fg, bg: '#ffffff' };
}

function formatMoney(n: number) {
  return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

/** Masada: sadece dakika */
function formatDurationMinutes(openedAt: string | null, now: number) {
  if (!openedAt) return '—';
  const ms = Math.max(0, now - new Date(openedAt).getTime());
  const mins = Math.floor(ms / 60_000);
  return `${mins} dk`;
}

/** Sağ panel: dakika + saniye */
function formatDurationPrecise(openedAt: string | null, now: number) {
  if (!openedAt) return '—';
  const ms = Math.max(0, now - new Date(openedAt).getTime());
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs > 0) return `${hrs} sa ${remMins} dk ${secs} sn`;
  return `${mins} dk ${secs} sn`;
}

export default function TableFloorPage() {
  const { user } = useAuth();
  const [data, setData] = useState<FloorPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string>('');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [orderSaving, setOrderSaving] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [catalogGroup, setCatalogGroup] = useState<string>('all');

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api<FloorPayload>('/api/admin/table-floor');
      setData(res);
      setError(null);
      setGroupId((prev) => {
        if (prev && res.groups.some((g) => g.id === prev)) return prev;
        return res.groups[0]?.id || '';
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yüklenemedi');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const poll = window.setInterval(() => void load(true), 4000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [load]);

  const activeGroup = useMemo(
    () => data?.groups.find((g) => g.id === groupId) || data?.groups[0] || null,
    [data, groupId]
  );

  const selected = useMemo(() => {
    if (!activeGroup || !selectedCode) return null;
    return activeGroup.tables.find((t) => t.code === selectedCode) || null;
  }, [activeGroup, selectedCode]);

  useEffect(() => {
    if (selectedCode && activeGroup && !activeGroup.tables.some((t) => t.code === selectedCode)) {
      setSelectedCode(null);
    }
  }, [activeGroup, selectedCode]);

  async function openTable(table: FloorTable) {
    if (!activeGroup || busy) return;
    setBusy(true);
    try {
      await api('/api/admin/table-floor/open', {
        method: 'POST',
        body: JSON.stringify({ tableNumber: table.code, groupSlug: activeGroup.id }),
      });
      await load(true);
    } finally {
      setBusy(false);
    }
  }

  async function closeTable(table: FloorTable) {
    if (!activeGroup || busy) return;
    setBusy(true);
    try {
      await api('/api/admin/table-floor/close', {
        method: 'POST',
        body: JSON.stringify({
          tableNumber: table.code,
          groupSlug: activeGroup.id,
          sessionId: table.sessionId,
        }),
      });
      await load(true);
    } finally {
      setBusy(false);
    }
  }

  async function openOrderModal() {
    setOrderOpen(true);
    setCart({});
    setProductQuery('');
    setCatalogGroup('all');
    if (!catalog.length) {
      const list = await api<CatalogProduct[]>('/api/admin/table-floor/products');
      setCatalog(list);
    }
  }

  async function submitOrder() {
    if (!selected || !activeGroup) return;
    const items = Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const p = catalog.find((c) => c.id === Number(id));
        return {
          productId: Number(id),
          name: p?.name,
          qty,
          price: p?.price,
        };
      });
    if (!items.length) return;
    setOrderSaving(true);
    try {
      await api('/api/admin/table-floor/orders', {
        method: 'POST',
        body: JSON.stringify({
          tableNumber: selected.code,
          groupSlug: activeGroup.id,
          items,
        }),
      });
      setOrderOpen(false);
      setCart({});
      await load(true);
    } finally {
      setOrderSaving(false);
    }
  }

  const catalogGroups = useMemo(() => {
    const names = new Set<string>();
    for (const p of catalog) {
      const g = p.groupName?.trim();
      if (g) names.add(g);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [catalog]);

  const filteredCatalog = catalog.filter((p) => {
    if (catalogGroup !== 'all' && p.groupName !== catalogGroup) return false;
    const q = productQuery.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.groupName.toLowerCase().includes(q);
  });

  return (
    <div className="table-floor">
      <header className="table-floor__top">
        <Link to="/admin" className="table-floor__back" aria-label="Admin panele dön">
          <ArrowLeft className="w-5 h-5" />
          <span>Geri</span>
        </Link>
        <div className="table-floor__brand">
          <p>Masa görünümü</p>
          <strong>{data?.restaurant?.name || user?.restaurant?.name || 'Restoran'}</strong>
        </div>
        <div className="table-floor__filters" role="tablist" aria-label="Masa grupları">
          {(data?.groups || []).map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={g.id === activeGroup?.id}
              className={`table-floor__chip${g.id === activeGroup?.id ? ' is-active' : ''}`}
              onClick={() => {
                setGroupId(g.id);
                setSelectedCode(null);
              }}
            >
              {g.name}
              <em>{g.count}</em>
            </button>
          ))}
        </div>
      </header>

      <main className="table-floor__main">
        {loading && !data ? (
          <div className="table-floor__empty">Masalar yükleniyor…</div>
        ) : error ? (
          <div className="table-floor__empty">{error}</div>
        ) : !activeGroup?.tables.length ? (
          <div className="table-floor__empty">
            Bu grupta masa yok. Barkod Yazdır sayfasından ekleyin.
          </div>
        ) : (
          <div className="table-floor__grid">
            {activeGroup.tables.map((table) => {
              const menuUrl = `${origin}/menu?masa=${encodeURIComponent(table.code)}&grup=${activeGroup.id}`;
              const alerting = table.waiterAlertMs > 0;
              const qrColor = resolveQrColor(table.colorId);
              return (
                <button
                  key={table.code}
                  type="button"
                  className={`floor-table${table.occupied ? ' is-occupied' : ''}${
                    alerting ? ' is-alerting' : ''
                  }${selectedCode === table.code ? ' is-selected' : ''}`}
                  onClick={() => setSelectedCode(table.code)}
                >
                  <span className="floor-table__label">{table.name}</span>
                  <span className="floor-table__chair floor-table__chair--n" aria-hidden />
                  <span className="floor-table__chair floor-table__chair--e" aria-hidden />
                  <span className="floor-table__chair floor-table__chair--s" aria-hidden />
                  <span className="floor-table__chair floor-table__chair--w" aria-hidden />
                  <span className="floor-table__top">
                    <span className="floor-table__qr" style={{ background: qrColor.bg }}>
                      <QRCodeSVG
                        value={menuUrl}
                        size={44}
                        level="M"
                        includeMargin={false}
                        fgColor={qrColor.fg}
                        bgColor={qrColor.bg}
                      />
                    </span>
                    {table.occupied ? (
                      <span className="floor-table__meta">
                        <Clock3 className="w-3 h-3" />
                        {formatDurationMinutes(table.openedAt, now)}
                      </span>
                    ) : (
                      <span className="floor-table__meta floor-table__meta--free">Boş</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </main>

      <aside className={`table-floor__drawer${selected ? ' is-open' : ''}`} aria-hidden={!selected}>
        {selected && activeGroup ? (
          <>
            <div className="table-floor__drawer-head">
              <div>
                <p className="table-floor__drawer-eyebrow">{activeGroup.name}</p>
                <h2>{selected.name}</h2>
              </div>
              <button
                type="button"
                className="table-floor__icon-btn"
                aria-label="Kapat"
                onClick={() => setSelectedCode(null)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="table-floor__status-row">
              <span className={`table-floor__pill${selected.occupied ? ' is-busy' : ''}`}>
                {selected.occupied ? 'Dolu' : 'Boş'}
              </span>
              {selected.waiterAlertMs > 0 ? (
                <span className="table-floor__pill is-wait">
                  <HandHelping className="w-3.5 h-3.5" />
                  Garson
                </span>
              ) : null}
              {selected.openedBy ? (
                <span className="table-floor__pill is-muted">
                  {selected.openedBy === 'admin' ? 'Admin açtı' : 'QR okutuldu'}
                </span>
              ) : null}
            </div>

            <div className="table-floor__stats">
              <div>
                <Clock3 className="w-4 h-4" />
                <div>
                  <span>Oturma</span>
                  <strong>{formatDurationPrecise(selected.openedAt, now)}</strong>
                </div>
              </div>
              <div>
                <Receipt className="w-4 h-4" />
                <div>
                  <span>Toplam</span>
                  <strong>{formatMoney(selected.total)}</strong>
                </div>
              </div>
            </div>

            <div className="table-floor__orders">
              <div className="table-floor__orders-head">
                <h3>Siparişler</h3>
                <button type="button" className="table-floor__text-btn" onClick={() => void openOrderModal()}>
                  <Plus className="w-4 h-4" />
                  Yemek ekle
                </button>
              </div>
              {selected.orders.length === 0 ? (
                <p className="table-floor__hint">Henüz sipariş yok.</p>
              ) : (
                <ul>
                  {selected.orders.map((o) => (
                    <li key={o.id}>
                      <div>
                        <strong>
                          {o.qty}× {o.name}
                        </strong>
                        <span>{o.source === 'admin' ? 'Admin' : 'Müşteri'}</span>
                      </div>
                      <em>{formatMoney(o.price * o.qty)}</em>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="table-floor__drawer-actions">
              {!selected.occupied ? (
                <button
                  type="button"
                  className="table-floor__primary"
                  disabled={busy}
                  onClick={() => void openTable(selected)}
                >
                  <UtensilsCrossed className="w-4 h-4" />
                  Masayı aç
                </button>
              ) : (
                <button
                  type="button"
                  className="table-floor__danger"
                  disabled={busy}
                  onClick={() => void closeTable(selected)}
                >
                  Masayı kapat / boşalt
                </button>
              )}
            </div>
          </>
        ) : null}
      </aside>

      {selected ? (
        <button
          type="button"
          className="table-floor__scrim"
          aria-label="Paneli kapat"
          onClick={() => setSelectedCode(null)}
        />
      ) : null}

      {orderOpen ? (
        <div className="table-floor-modal" role="dialog" aria-modal="true" aria-label="Yemek ekle">
          <button
            type="button"
            className="table-floor-modal__backdrop"
            aria-label="Kapat"
            onClick={() => setOrderOpen(false)}
          />
          <div className="table-floor-modal__panel">
            <header>
              <div>
                <p>Sipariş ekle</p>
                <h3>{selected?.name}</h3>
              </div>
              <button type="button" className="table-floor__icon-btn" onClick={() => setOrderOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </header>
            <input
              type="search"
              className="table-floor-modal__search"
              placeholder="Ürün ara…"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
            />
            {catalogGroups.length > 0 ? (
              <div className="table-floor-modal__pills" role="tablist" aria-label="Ürün grupları">
                <button
                  type="button"
                  role="tab"
                  aria-selected={catalogGroup === 'all'}
                  className={`table-floor-modal__pill${catalogGroup === 'all' ? ' is-active' : ''}`}
                  onClick={() => setCatalogGroup('all')}
                >
                  Tümü
                </button>
                {catalogGroups.map((g) => (
                  <button
                    key={g}
                    type="button"
                    role="tab"
                    aria-selected={catalogGroup === g}
                    className={`table-floor-modal__pill${catalogGroup === g ? ' is-active' : ''}`}
                    onClick={() => setCatalogGroup(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="table-floor-modal__list">
              {filteredCatalog.length === 0 ? (
                <p className="table-floor__hint" style={{ padding: '0.5rem 0.25rem' }}>
                  Bu filtrede ürün yok.
                </p>
              ) : (
                filteredCatalog.map((p) => {
                const qty = cart[p.id] || 0;
                return (
                  <div key={p.id} className="table-floor-modal__row">
                    <div>
                      <strong>{p.name}</strong>
                      <span>
                        {p.groupName} · {formatMoney(p.price)}
                      </span>
                    </div>
                    <div className="table-floor-modal__qty">
                      <button
                        type="button"
                        onClick={() =>
                          setCart((c) => ({ ...c, [p.id]: Math.max(0, (c[p.id] || 0) - 1) }))
                        }
                      >
                        −
                      </button>
                      <em>{qty}</em>
                      <button
                        type="button"
                        onClick={() => setCart((c) => ({ ...c, [p.id]: (c[p.id] || 0) + 1 }))}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })
              )}
            </div>
            <footer>
              <button
                type="button"
                className="table-floor__primary"
                disabled={orderSaving || !Object.values(cart).some((q) => q > 0)}
                onClick={() => void submitOrder()}
              >
                {orderSaving ? 'Kaydediliyor…' : 'Siparişi kaydet'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
