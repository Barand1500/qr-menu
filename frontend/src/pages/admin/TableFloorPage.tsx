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
  status?: string;
  openedAt: string | null;
  openedBy: string | null;
  sessionId: number | null;
  guestName?: string | null;
  expectedAt?: string | null;
  paidAt?: string | null;
  orders: FloorOrder[];
  total: number;
  mergedTables?: string[];
  mergePrimary?: string | null;
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
  groupId?: number;
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

function toLocalInputValue(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function printBill(opts: {
  restaurant: string;
  tableName: string;
  orders: FloorOrder[];
  total: number;
  guestName?: string | null;
}) {
  const rows = opts.orders
    .map(
      (o) =>
        `<tr><td>${o.qty}× ${o.name}</td><td style="text-align:right">${formatMoney(o.price * o.qty)}</td></tr>`
    )
    .join('');
  const html = `<!doctype html><html><head><title>Hesap</title>
    <style>body{font-family:system-ui,sans-serif;padding:24px;color:#222}
    h1{font-size:18px;margin:0 0 4px} p{margin:0 0 12px;color:#666;font-size:13px}
    table{width:100%;border-collapse:collapse} td{padding:6px 0;border-bottom:1px solid #eee;font-size:14px}
    .total{font-size:18px;font-weight:800;margin-top:16px;text-align:right}</style></head><body>
    <h1>${opts.restaurant}</h1>
    <p>${opts.tableName}${opts.guestName ? ` · ${opts.guestName}` : ''}</p>
    <table>${rows || '<tr><td>Sipariş yok</td><td></td></tr>'}</table>
    <div class="total">${formatMoney(opts.total)}</div>
    <script>window.onload=()=>window.print()</script></body></html>`;
  const w = window.open('', '_blank', 'noopener,noreferrer,width=420,height=640');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export default function TableFloorPage() {
  const { user } = useAuth();
  const [data, setData] = useState<FloorPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string>('');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [selectedGroupSlug, setSelectedGroupSlug] = useState<string>('');
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [orderSaving, setOrderSaving] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [catalogGroup, setCatalogGroup] = useState<string>('all');
  const [guestName, setGuestName] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [pickMode, setPickMode] = useState<null | 'move' | 'merge'>(null);
  const [mergePick, setMergePick] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<null | {
    kind: 'move' | 'merge';
    targetCode?: string;
    targetName?: string;
    targetGroupId?: string;
    targetGroupName?: string;
  }>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const attempts = silent ? 1 : 10;
    let lastErr: unknown = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await api<FloorPayload>('/api/admin/table-floor');
        setData(res);
        setError(null);
        setGroupId((prev) => {
          if (prev && res.groups.some((g) => g.id === prev)) return prev;
          return res.groups[0]?.id || '';
        });
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        if (i < attempts - 1) {
          await new Promise((r) => window.setTimeout(r, 400 + i * 250));
        }
      }
    }
    if (lastErr) {
      setError(lastErr instanceof Error ? lastErr.message : 'Yüklenemedi');
    }
    if (!silent) setLoading(false);
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

  const selectedGroup = useMemo(
    () => data?.groups.find((g) => g.id === (selectedGroupSlug || groupId)) || null,
    [data, selectedGroupSlug, groupId]
  );

  const selected = useMemo(() => {
    if (!selectedCode || !selectedGroup) return null;
    return selectedGroup.tables.find((t) => t.code === selectedCode) || null;
  }, [selectedGroup, selectedCode]);

  const sourceGroupName = selectedGroup?.name || '';

  useEffect(() => {
    if (!selected) {
      setGuestName('');
      setExpectedAt('');
      return;
    }
    setGuestName(selected.guestName || '');
    setExpectedAt(toLocalInputValue(selected.expectedAt));
  }, [selected?.code, selected?.sessionId, selected?.guestName, selected?.expectedAt]);

  useEffect(() => {
    if (!pickMode && selectedCode && activeGroup && selectedGroupSlug === activeGroup.id) {
      if (!activeGroup.tables.some((t) => t.code === selectedCode)) setSelectedCode(null);
    }
  }, [activeGroup, selectedCode, pickMode, selectedGroupSlug]);

  function cancelPick() {
    setPickMode(null);
    setMergePick([]);
    setConfirm(null);
  }

  function startMove() {
    if (!selected || !selected.occupied || selected.status === 'merged') return;
    setPickMode('move');
    setMergePick([]);
    setConfirm(null);
  }

  function startMerge() {
    if (!selected || !selected.occupied || selected.status === 'merged') return;
    setPickMode('merge');
    setMergePick([]);
    setConfirm(null);
    // merge: stay on source group view
    if (selectedGroupSlug) setGroupId(selectedGroupSlug);
  }

  function handleTableClick(table: FloorTable) {
    if (pickMode === 'move') {
      if (table.code === selectedCode && groupId === selectedGroupSlug) return;
      if (table.occupied || table.status === 'merged') return;
      setConfirm({
        kind: 'move',
        targetCode: table.code,
        targetName: table.name,
        targetGroupId: groupId,
        targetGroupName: activeGroup?.name || '',
      });
      return;
    }
    if (pickMode === 'merge') {
      if (groupId !== selectedGroupSlug) return;
      if (table.code === selectedCode) return;
      if (table.status === 'merged') return;
      setMergePick((prev) =>
        prev.includes(table.code) ? prev.filter((c) => c !== table.code) : [...prev, table.code]
      );
      return;
    }
    setSelectedCode(table.code);
    setSelectedGroupSlug(groupId);
  }

  function openConfirmMerge() {
    if (!mergePick.length || !selected) return;
    setConfirm({ kind: 'merge' });
  }

  async function openTable(table: FloorTable) {
    if (!activeGroup || busy) return;
    setBusy(true);
    try {
      await api('/api/admin/table-floor/open', {
        method: 'POST',
        body: JSON.stringify({ tableNumber: table.code, groupSlug: selectedGroupSlug || activeGroup.id }),
      });
      await load(true);
    } finally {
      setBusy(false);
    }
  }

  async function closeTable(table: FloorTable, paid = false) {
    if (!activeGroup || busy) return;
    setBusy(true);
    try {
      await api('/api/admin/table-floor/close', {
        method: 'POST',
        body: JSON.stringify({
          tableNumber: table.code,
          groupSlug: selectedGroupSlug || activeGroup.id,
          sessionId: table.sessionId,
          paid,
        }),
      });
      await load(true);
      if (paid) {
        setSelectedCode(null);
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveReservation() {
    if (!selected || !activeGroup || busy) return;
    setBusy(true);
    try {
      await api('/api/admin/table-floor/reserve', {
        method: 'POST',
        body: JSON.stringify({
          tableNumber: selected.code,
          groupSlug: selectedGroupSlug,
          guestName,
          expectedAt: expectedAt ? new Date(expectedAt).toISOString() : null,
        }),
      });
      await load(true);
    } finally {
      setBusy(false);
    }
  }

  async function moveTable() {
    if (!selected || !confirm || confirm.kind !== 'move' || !confirm.targetCode || busy) return;
    setBusy(true);
    try {
      await api('/api/admin/table-floor/move', {
        method: 'POST',
        body: JSON.stringify({
          fromTable: selected.code,
          toTable: confirm.targetCode,
          groupSlug: selectedGroupSlug,
          toGroupSlug: confirm.targetGroupId,
        }),
      });
      setSelectedCode(confirm.targetCode);
      setSelectedGroupSlug(confirm.targetGroupId || selectedGroupSlug);
      if (confirm.targetGroupId) setGroupId(confirm.targetGroupId);
      cancelPick();
      await load(true);
    } finally {
      setBusy(false);
    }
  }

  async function mergeTables() {
    if (!selected || !mergePick.length || busy) return;
    setBusy(true);
    try {
      await api('/api/admin/table-floor/merge', {
        method: 'POST',
        body: JSON.stringify({
          primaryTable: selected.code,
          otherTables: mergePick,
          groupSlug: selectedGroupSlug,
        }),
      });
      cancelPick();
      await load(true);
    } finally {
      setBusy(false);
    }
  }

  async function splitMerged(code: string) {
    if (!selected || !activeGroup || busy) return;
    setBusy(true);
    try {
      await api('/api/admin/table-floor/split', {
        method: 'POST',
        body: JSON.stringify({
          primaryTable: selected.code,
          splitTable: code,
          groupSlug: selectedGroupSlug,
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
          groupSlug: selectedGroupSlug,
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
    const map = new Map<string, string>();
    for (const p of catalog) {
      const id = p.groupId != null ? String(p.groupId) : '';
      const name = p.groupName?.trim();
      if (id && name) map.set(id, name);
      else if (name) map.set(name, name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [catalog]);

  const filteredCatalog = catalog.filter((p) => {
    if (catalogGroup !== 'all') {
      const id = p.groupId != null ? String(p.groupId) : p.groupName;
      if (id !== catalogGroup) return false;
    }
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
                if (!pickMode) {
                  setSelectedCode(null);
                  setSelectedGroupSlug('');
                }
              }}
            >
              {g.name}
              <em>{g.count}</em>
            </button>
          ))}
        </div>
      </header>

      {pickMode ? (
        <div className={`table-floor__pickbar table-floor__pickbar--${pickMode}`}>
          <div className="table-floor__pickbar-copy">
            <strong>{pickMode === 'move' ? 'Masa taşı' : 'Masa birleştir'}</strong>
            <span>
              {pickMode === 'move'
                ? `${selected?.name || 'Masa'} nereye taşınsın? Boş bir masaya tıklayın — grup değiştirebilirsiniz.`
                : `${selected?.name || 'Masa'} ile birleştirilecek masaları seçin, sonra onaylayın.`}
            </span>
          </div>
          <div className="table-floor__pickbar-actions">
            {pickMode === 'merge' ? (
              <button
                type="button"
                className="table-floor__pickbar-ok"
                disabled={!mergePick.length}
                onClick={openConfirmMerge}
              >
                Birleştir ({mergePick.length})
              </button>
            ) : null}
            <button type="button" className="table-floor__pickbar-cancel" onClick={cancelPick}>
              İptal
            </button>
          </div>
        </div>
      ) : null}

      <main className={`table-floor__main${pickMode ? ' is-picking' : ''}`}>
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
              const isSource =
                selectedCode === table.code && selectedGroupSlug === activeGroup.id;
              const isMergePick = pickMode === 'merge' && mergePick.includes(table.code);
              const moveSelectable =
                pickMode === 'move' && !table.occupied && table.status !== 'merged';
              const mergeSelectable =
                pickMode === 'merge' &&
                selectedGroupSlug === groupId &&
                table.code !== selectedCode &&
                table.status !== 'merged';
              const primaryName =
                table.mergePrimary &&
                activeGroup.tables.find((t) => t.code === table.mergePrimary)?.name;

              return (
                <button
                  key={table.code}
                  type="button"
                  className={`floor-table${table.occupied ? ' is-occupied' : ''}${
                    table.status === 'reserved' ? ' is-reserved' : ''
                  }${table.status === 'merged' ? ' is-merged' : ''}${
                    alerting ? ' is-alerting' : ''
                  }${isSource ? ' is-selected' : ''}${isMergePick ? ' is-merge-pick' : ''}${
                    moveSelectable ? ' is-pickable' : ''
                  }${pickMode && !moveSelectable && !mergeSelectable && !isSource ? ' is-dimmed' : ''}`}
                  onClick={() => handleTableClick(table)}
                >
                  <span className="floor-table__label">{table.name}</span>
                  {table.status === 'merged' && primaryName ? (
                    <span className="floor-table__link">{primaryName} ile</span>
                  ) : null}
                  {(table.mergedTables || []).length > 0 ? (
                    <span className="floor-table__link">
                      +{(table.mergedTables || []).length} birleşik
                    </span>
                  ) : null}
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
                    {table.status === 'reserved' ? (
                      <span className="floor-table__meta">Rezerve</span>
                    ) : table.status === 'merged' ? (
                      <span className="floor-table__meta">Birleşik</span>
                    ) : table.occupied ? (
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

      <aside
        className={`table-floor__drawer${selected && !pickMode ? ' is-open' : ''}`}
        aria-hidden={!selected || Boolean(pickMode)}
      >
        {selected && activeGroup && !pickMode ? (
          <>
            <div className="table-floor__drawer-head">
              <div>
                <p className="table-floor__drawer-eyebrow">
                  {sourceGroupName || activeGroup.name}
                </p>
                <h2>{selected.name}</h2>
              </div>
              <button
                type="button"
                className="table-floor__icon-btn"
                aria-label="Kapat"
                onClick={() => {
                  setSelectedCode(null);
                  setSelectedGroupSlug('');
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="table-floor__status-row">
              <span
                className={`table-floor__pill${
                  selected.status === 'reserved'
                    ? ' is-wait'
                    : selected.occupied
                      ? ' is-busy'
                      : ''
                }`}
              >
                {selected.status === 'reserved'
                  ? 'Rezerve'
                  : selected.status === 'merged'
                    ? `Birleşik → ${selected.mergePrimary}`
                    : selected.occupied
                      ? 'Dolu'
                      : 'Boş'}
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

            {selected.status === 'merged' ? (
              <p className="table-floor__hint">
                Bu masa {selected.mergePrimary} hesabına birleşik. Ana masadan yönetin.
              </p>
            ) : (
              <>
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

                {!selected.occupied || selected.status === 'reserved' ? (
                  <div className="table-floor__tool">
                    <h3>Rezervasyon</h3>
                    <input
                      type="text"
                      className="table-floor__input"
                      placeholder="Misafir adı"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                    />
                    <input
                      type="datetime-local"
                      className="table-floor__input"
                      value={expectedAt}
                      onChange={(e) => setExpectedAt(e.target.value)}
                    />
                    <button
                      type="button"
                      className="table-floor__secondary"
                      disabled={busy}
                      onClick={() => void saveReservation()}
                    >
                      Rezervasyonu kaydet
                    </button>
                  </div>
                ) : null}

                {selected.occupied && selected.status === 'open' ? (
                  <div className="table-floor__action-row">
                    <button type="button" className="table-floor__secondary" onClick={startMove}>
                      Masa taşı
                    </button>
                    <button type="button" className="table-floor__secondary" onClick={startMerge}>
                      Birleştir
                    </button>
                  </div>
                ) : null}

                {(selected.mergedTables || []).length > 0 ? (
                  <div className="table-floor__split-row">
                    {(selected.mergedTables || []).map((code) => {
                      const t = selectedGroup?.tables.find((x) => x.code === code);
                      return (
                        <button
                          key={code}
                          type="button"
                          className="table-floor__pill-btn"
                          disabled={busy}
                          onClick={() => void splitMerged(code)}
                        >
                          {t?.name || code} ayır
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <div className="table-floor__orders">
                  <div className="table-floor__orders-head">
                    <h3>Siparişler</h3>
                    <button
                      type="button"
                      className="table-floor__text-btn"
                      onClick={() => void openOrderModal()}
                    >
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
                  <div className="table-floor__action-row">
                    <button
                      type="button"
                      className="table-floor__secondary"
                      onClick={() =>
                        printBill({
                          restaurant: data?.restaurant?.name || user?.restaurant?.name || 'Restoran',
                          tableName: selected.name,
                          orders: selected.orders,
                          total: selected.total,
                          guestName: selected.guestName,
                        })
                      }
                    >
                      Hesap yazdır
                    </button>
                    {selected.occupied ? (
                      <button
                        type="button"
                        className="table-floor__primary"
                        disabled={busy}
                        onClick={() => void closeTable(selected, true)}
                      >
                        Ödeme alındı
                      </button>
                    ) : null}
                  </div>
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
                      onClick={() => void closeTable(selected, false)}
                    >
                      Masayı kapat / boşalt
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        ) : null}
      </aside>

      {selected && !pickMode ? (
        <button
          type="button"
          className="table-floor__scrim"
          aria-label="Paneli kapat"
          onClick={() => {
            setSelectedCode(null);
            setSelectedGroupSlug('');
          }}
        />
      ) : null}

      {confirm ? (
        <div className="table-floor-modal table-floor-confirm" role="dialog" aria-modal="true">
          <button
            type="button"
            className="table-floor-modal__backdrop"
            aria-label="Kapat"
            onClick={() => setConfirm(null)}
          />
          <div className="table-floor-modal__panel table-floor-confirm__panel">
            <header>
              <div>
                <p>{confirm.kind === 'move' ? 'Masa taşı' : 'Masaları birleştir'}</p>
                <h3>
                  {confirm.kind === 'move'
                    ? `${selected?.name} → ${confirm.targetName}`
                    : `${selected?.name} + ${mergePick.length} masa`}
                </h3>
              </div>
              <button type="button" className="table-floor__icon-btn" onClick={() => setConfirm(null)}>
                <X className="w-5 h-5" />
              </button>
            </header>
            <div className="table-floor-confirm__body">
              {confirm.kind === 'move' ? (
                <p>
                  <strong>{selected?.name}</strong> masası{' '}
                  <strong>
                    {confirm.targetGroupName} / {confirm.targetName}
                  </strong>{' '}
                  konumuna taşınacak. Siparişler ve süre birlikte gider.
                </p>
              ) : (
                <p>
                  Seçilen masalar <strong>{selected?.name}</strong> hesabına birleşecek. Ortak
                  sipariş listesi oluşur; birleşik masalar turuncu görünür.
                </p>
              )}
            </div>
            <footer className="table-floor-confirm__footer">
              <button type="button" className="table-floor__secondary" onClick={() => setConfirm(null)}>
                Vazgeç
              </button>
              <button
                type="button"
                className="table-floor__primary"
                disabled={busy}
                onClick={() => void (confirm.kind === 'move' ? moveTable() : mergeTables())}
              >
                {busy ? 'İşleniyor…' : 'Onayla'}
              </button>
            </footer>
          </div>
        </div>
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
                    key={g.id}
                    type="button"
                    role="tab"
                    aria-selected={catalogGroup === g.id}
                    className={`table-floor-modal__pill${catalogGroup === g.id ? ' is-active' : ''}`}
                    onClick={() => setCatalogGroup(g.id)}
                  >
                    {g.name}
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
