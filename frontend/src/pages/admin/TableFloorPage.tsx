import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  KeyRound,
  NotebookPen,
  Plus,
  Receipt,
  RefreshCw,
  Timer,
  UtensilsCrossed,
  X,
  Trash2,
  HandHelping,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { adminPath } from '@/lib/adminPath';
import {
  blockedOptionIds,
  computePreviewUnitPrice,
  effectiveMultiMaxTotalQty,
  groupSelectedQty,
  sanitizeSelections,
  type ProductOptionGroup,
} from '@/lib/productOptions';
import BillReceiptModal from '@/components/BillReceiptModal';
import GarsonCallsPanel from '@/components/admin/GarsonCallsPanel';
import '@/table-floor.css';
import '@/garson-panel.css';

const FLOOR_SKIN_KEY = 'menu_qr_table_floor_skin';
const FLOOR_SKIN_COUNT = 5;

function readFloorSkin(): number {
  try {
    const n = Number(localStorage.getItem(FLOOR_SKIN_KEY));
    if (Number.isInteger(n) && n >= 0 && n < FLOOR_SKIN_COUNT) return n;
  } catch {
    /* ignore */
  }
  return 0;
}
type FloorOrder = {
  id: string;
  productId?: number | null;
  name: string;
  qty: number;
  price: number;
  createdAt: string;
  source: 'admin' | 'customer';
  note?: string;
  freeNote?: string;
  selections?: { groupId: string; optionId: string; qty: number; label?: string }[];
  adjustmentType?: 'extra' | 'discount' | null;
  adjustmentMode?: 'fixed' | 'percent';
  adjustmentValue?: number;
};

type SeatingFeeConfig = {
  enabled: boolean;
  rate: number;
  unit: 'minute' | 'hour';
};

type CartLine = {
  qty: number;
  /** groupId → seçimler */
  selections: Record<string, { optionId: string; qty: number }[]>;
};

const emptyCartLine = (): CartLine => ({
  qty: 0,
  selections: {},
});

function defaultSelections(groups: ProductOptionGroup[]): CartLine['selections'] {
  const out: CartLine['selections'] = {};
  for (const g of groups) {
    const first = g.options.find((o) => o.isActive !== false);
    if (g.type === 'single' && first) {
      out[g.id] = [{ optionId: first.id, qty: 1 }];
    }
  }
  return sanitizeSelections(groups, out);
}

function withPrunedSelections(
  groups: ProductOptionGroup[],
  selections: CartLine['selections']
) {
  return sanitizeSelections(groups, selections);
}

function lineTotal(o: {
  price: number;
  qty: number;
  adjustmentType?: 'extra' | 'discount' | null;
  adjustmentMode?: 'fixed' | 'percent';
  adjustmentValue?: number;
}) {
  const base = (Number(o.price) || 0) * Math.max(1, Number(o.qty) || 1);
  const val = Math.abs(Number(o.adjustmentValue) || 0);
  if (!val || !o.adjustmentType) return base;
  const delta = o.adjustmentMode === 'percent' ? (base * val) / 100 : val;
  if (o.adjustmentType === 'extra') return base + delta;
  if (o.adjustmentType === 'discount') return Math.max(0, base - delta);
  return base;
}

function computeSeatingFee(
  fee: SeatingFeeConfig | null | undefined,
  openedAt: string | null | undefined,
  status: string | null | undefined,
  nowMs: number
) {
  if (!fee?.enabled || !fee.rate || status !== 'open' || !openedAt) return 0;
  const start = new Date(openedAt).getTime();
  if (!Number.isFinite(start)) return 0;
  const elapsedMin = Math.max(0, (nowMs - start) / 60_000);
  const amount = fee.unit === 'hour' ? (elapsedMin / 60) * fee.rate : elapsedMin * fee.rate;
  return Math.round(amount * 100) / 100;
}

function formatAdjLabel(o: FloorOrder) {
  if (!o.adjustmentType || !o.adjustmentValue) return '';
  const sign = o.adjustmentType === 'extra' ? '+' : '−';
  const unit = o.adjustmentMode === 'percent' ? '%' : '₺';
  const label = o.adjustmentType === 'extra' ? 'ekstra' : 'indirim';
  return `${sign}${o.adjustmentValue}${unit} ${label}`;
}

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
  reservationNote?: string | null;
  paidAt?: string | null;
  orders: FloorOrder[];
  seatingFee?: SeatingFeeConfig | null;
  seatingFeeAmount?: number;
  total: number;
  mergedTables?: string[];
  mergePrimary?: string | null;
  waiterAlertMs: number;
  accessCode?: string | null;
  codeExpiresAt?: string | null;
  codeVerifiedAt?: string | null;
  codeStatus?: 'empty' | 'pending' | 'verified' | 'expired';
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
  optionGroups?: ProductOptionGroup[];
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

/** Rezervasyon saati */
function formatExpectedAt(expectedAt: string | null | undefined) {
  if (!expectedAt) return 'Saat yok';
  const d = new Date(expectedAt);
  if (Number.isNaN(d.getTime())) return 'Saat yok';
  return d.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
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

export default function TableFloorPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const panelMode = searchParams.get('panel') === 'garson' ? 'garson' : 'floor';
  const focusCallId = Number(searchParams.get('cagri') || '') || null;
  const [data, setData] = useState<FloorPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string>('');
  const [floorSkin, setFloorSkin] = useState(readFloorSkin);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [selectedGroupSlug, setSelectedGroupSlug] = useState<string>('');
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [cart, setCart] = useState<Record<number, CartLine>>({});
  const [orderSaving, setOrderSaving] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [catalogGroup, setCatalogGroup] = useState<string>('all');
  const [guestName, setGuestName] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [reservationNote, setReservationNote] = useState('');
  const [feeEnabled, setFeeEnabled] = useState(false);
  const [feeRate, setFeeRate] = useState('');
  const [feeUnit, setFeeUnit] = useState<'minute' | 'hour'>('minute');
  const [feePanelOpen, setFeePanelOpen] = useState(false);
  const [notePanelOpen, setNotePanelOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<FloorOrder | null>(null);
  const [editQty, setEditQty] = useState(1);
  const [editFreeNote, setEditFreeNote] = useState('');
  const [billOpen, setBillOpen] = useState(false);
  const [editAdjType, setEditAdjType] = useState<'none' | 'extra' | 'discount'>('none');
  const [editAdjValue, setEditAdjValue] = useState('');
  const [editSelections, setEditSelections] = useState<CartLine['selections']>({});
  const [editGroups, setEditGroups] = useState<ProductOptionGroup[]>([]);
  const [editBasePrice, setEditBasePrice] = useState(0);
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
    const masa = searchParams.get('masa');
    const grup = searchParams.get('grup');
    if (!masa || !data) return;
    if (grup && data.groups.some((g) => g.id === grup)) setGroupId(grup);
    setSelectedCode(masa);
    setSelectedGroupSlug(grup || groupId || data.groups[0]?.id || '');
  }, [data, searchParams, groupId]);

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
    setFeePanelOpen(false);
    setNotePanelOpen(false);
  }, [selected?.code, selected?.sessionId]);

  useEffect(() => {
    if (!selected) {
      setGuestName('');
      setExpectedAt('');
      setReservationNote('');
      setFeeEnabled(false);
      setFeeRate('');
      setFeeUnit('minute');
      return;
    }
    setGuestName(selected.guestName || '');
    setExpectedAt(toLocalInputValue(selected.expectedAt));
    setReservationNote(selected.reservationNote || '');
    setFeeEnabled(Boolean(selected.seatingFee?.enabled));
    setFeeRate(
      selected.seatingFee?.rate != null && selected.seatingFee.rate > 0
        ? String(selected.seatingFee.rate)
        : ''
    );
    setFeeUnit(selected.seatingFee?.unit === 'hour' ? 'hour' : 'minute');
  }, [
    selected?.code,
    selected?.sessionId,
    selected?.guestName,
    selected?.expectedAt,
    selected?.reservationNote,
    selected?.seatingFee?.enabled,
    selected?.seatingFee?.rate,
    selected?.seatingFee?.unit,
  ]);

  const liveSeatingFee = useMemo(
    () =>
      selected
        ? computeSeatingFee(selected.seatingFee, selected.openedAt, selected.status, now)
        : 0,
    [selected, now]
  );

  const liveTotal = useMemo(() => {
    if (!selected) return 0;
    const ordersSum = selected.orders.reduce((s, o) => s + lineTotal(o), 0);
    return Math.round((ordersSum + liveSeatingFee) * 100) / 100;
  }, [selected, liveSeatingFee]);

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
          reservationNote,
        }),
      });
      await load(true);
    } finally {
      setBusy(false);
    }
  }

  async function saveSeatingFee() {
    if (!selected || !selectedGroupSlug || busy) return;
    setBusy(true);
    try {
      await api('/api/admin/table-floor/seating-fee', {
        method: 'PUT',
        body: JSON.stringify({
          groupSlug: selectedGroupSlug,
          tableIndex: selected.index,
          enabled: feeEnabled,
          rate: Number(String(feeRate).replace(',', '.')) || 0,
          unit: feeUnit,
        }),
      });
      setFeePanelOpen(false);
      await load(true);
    } finally {
      setBusy(false);
    }
  }

  async function orderItemAction(itemId: string, action: 'copy' | 'remove') {
    if (!selected?.sessionId || busy) return;
    if (action === 'remove' && !window.confirm('Bu sipariş satırı silinsin mi?')) return;
    setBusy(true);
    try {
      await api('/api/admin/table-floor/orders/item', {
        method: 'PATCH',
        body: JSON.stringify({
          sessionId: selected.sessionId,
          itemId,
          action,
        }),
      });
      if (editingOrder?.id === itemId) setEditingOrder(null);
      await load(true);
    } finally {
      setBusy(false);
    }
  }

  async function openOrderEdit(o: FloorOrder) {
    setEditingOrder(o);
    setEditQty(o.qty);
    setEditFreeNote(o.freeNote || (!o.selections?.length ? o.note || '' : ''));
    setEditAdjType(o.adjustmentType || 'none');
    setEditAdjValue(o.adjustmentValue != null ? String(o.adjustmentValue) : '');
    setEditGroups([]);
    setEditBasePrice(o.price);
    setEditSelections({});

    if (!o.productId) return;
    try {
      let list = catalog;
      if (!list.length) {
        list = await api<CatalogProduct[]>('/api/admin/table-floor/products');
        setCatalog(list);
      }
      const product = list.find((p) => p.id === o.productId);
      const groups = product?.optionGroups || [];
      setEditGroups(groups);
      setEditBasePrice(product?.price ?? o.price);

      if (o.selections?.length) {
        const map: CartLine['selections'] = {};
        for (const s of o.selections) {
          const arr = map[s.groupId] || [];
          arr.push({ optionId: s.optionId, qty: s.qty });
          map[s.groupId] = arr;
        }
        setEditSelections(withPrunedSelections(groups, map));
      } else {
        setEditSelections(defaultSelections(groups));
      }
    } catch {
      /* ignore */
    }
  }

  const editPreviewUnit = useMemo(() => {
    if (!editingOrder) return 0;
    if (editGroups.length) {
      return computePreviewUnitPrice(editBasePrice, editGroups, editSelections);
    }
    return editBasePrice || editingOrder.price;
  }, [editingOrder, editGroups, editBasePrice, editSelections]);

  const editPreviewTotal = useMemo(() => {
    const base = editPreviewUnit * Math.max(1, editQty);
    const val = Math.abs(Number(String(editAdjValue).replace(',', '.')) || 0);
    if (!val || editAdjType === 'none') return base;
    if (editAdjType === 'extra') return base + val;
    return Math.max(0, base - val);
  }, [editPreviewUnit, editQty, editAdjType, editAdjValue]);

  async function saveOrderEdit() {
    if (!selected?.sessionId || !editingOrder || busy) return;
    setBusy(true);
    try {
      const adjVal = Math.abs(Number(String(editAdjValue).replace(',', '.')) || 0);
      const selections = Object.entries(editSelections).flatMap(([groupId, picks]) =>
        picks.map((pick) => ({
          groupId,
          optionId: pick.optionId,
          qty: pick.qty,
        }))
      );
      await api('/api/admin/table-floor/orders/item', {
        method: 'PATCH',
        body: JSON.stringify({
          sessionId: selected.sessionId,
          itemId: editingOrder.id,
          action: 'update',
          patch: {
            qty: editQty,
            freeNote: editFreeNote,
            selections,
            adjustmentType: editAdjType === 'none' ? null : editAdjType,
            adjustmentMode: 'fixed',
            adjustmentValue: editAdjType === 'none' ? 0 : adjVal,
          },
        }),
      });
      setEditingOrder(null);
      await load(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Kaydedilemedi');
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
    try {
      const list = await api<CatalogProduct[]>('/api/admin/table-floor/products');
      setCatalog(list);
    } catch {
      /* keep previous catalog */
    }
  }

  async function submitOrder() {
    if (!selected || !activeGroup) return;
    const items = Object.entries(cart)
      .filter(([, line]) => line.qty > 0)
      .map(([id, line]) => {
        const p = catalog.find((c) => c.id === Number(id));
        const groups = p?.optionGroups || [];
        const selections = Object.entries(line.selections).flatMap(([groupId, picks]) =>
          picks.map((pick) => ({
            groupId,
            optionId: pick.optionId,
            qty: pick.qty,
          }))
        );
        const unit = groups.length
          ? computePreviewUnitPrice(p?.price || 0, groups, line.selections)
          : p?.price;
        return {
          productId: Number(id),
          name: p?.name,
          qty: line.qty,
          price: unit,
          ...(selections.length ? { selections } : {}),
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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Sipariş eklenemedi');
    } finally {
      setOrderSaving(false);
    }
  }

  function setCartQty(productId: number, qty: number) {
    setCart((c) => {
      const prev = c[productId] || emptyCartLine();
      if (qty <= 0) {
        const next = { ...c };
        delete next[productId];
        return next;
      }
      const product = catalog.find((p) => p.id === productId);
      const groups = product?.optionGroups || [];
      const selections =
        prev.qty <= 0 && Object.keys(prev.selections).length === 0
          ? defaultSelections(groups)
          : prev.selections;
      return {
        ...c,
        [productId]: { ...prev, qty, selections },
      };
    });
  }

  function patchCart(productId: number, patch: Partial<CartLine>) {
    setCart((c) => {
      const prev = c[productId] || emptyCartLine();
      if (prev.qty <= 0 && !patch.qty) return c;
      const product = catalog.find((p) => p.id === productId);
      const groups = product?.optionGroups || [];
      const next = { ...prev, ...patch };
      if (patch.selections) {
        next.selections = withPrunedSelections(groups, patch.selections);
      }
      return { ...c, [productId]: next };
    });
  }

  const catalogGroups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const p of catalog) {
      const id = p.groupId != null ? String(p.groupId) : p.groupName.trim() || 'other';
      const name = p.groupName?.trim() || 'Diğer';
      const prev = map.get(id);
      if (prev) prev.count += 1;
      else map.set(id, { id, name, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [catalog]);

  const filteredCatalog = catalog.filter((p) => {
    if (catalogGroup !== 'all') {
      const id = p.groupId != null ? String(p.groupId) : p.groupName.trim() || 'other';
      if (id !== catalogGroup) return false;
    }
    const q = productQuery.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || p.groupName.toLowerCase().includes(q);
  });

  const cycleFloorSkin = (dir: -1 | 1) => {
    setFloorSkin((prev) => {
      const next = (prev + dir + FLOOR_SKIN_COUNT) % FLOOR_SKIN_COUNT;
      try {
        localStorage.setItem(FLOOR_SKIN_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  function openGarsonPanel() {
    const next = new URLSearchParams(searchParams);
    next.set('panel', 'garson');
    setSearchParams(next, { replace: true });
  }

  function openFloorPanel() {
    const next = new URLSearchParams(searchParams);
    next.delete('panel');
    setSearchParams(next, { replace: true });
  }

  async function regenerateCode() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await api('/api/admin/table-floor/regenerate-code', {
        method: 'POST',
        body: JSON.stringify({
          tableNumber: selected.code,
          groupSlug: selectedGroupSlug || groupId,
          sessionId: selected.sessionId,
        }),
      });
      await load(true);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`table-floor table-floor--skin-${floorSkin}`}>
      <header className="table-floor__top">
        <Link to={adminPath()} className="table-floor__back" aria-label="Admin panele dön">
          <ArrowLeft className="w-4 h-4" />
          <span>Geri</span>
        </Link>
        <div className="table-floor__brand">
          <div className="table-floor__brand-title">
            <button
              type="button"
              className="table-floor__skin-btn"
              aria-label="Önceki masa tasarımı"
              title="Önceki tasarım"
              onClick={() => cycleFloorSkin(-1)}
            >
              <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
            <p>{panelMode === 'garson' ? 'Garson' : 'Masa görünümü'}</p>
            <button
              type="button"
              className="table-floor__skin-btn"
              aria-label="Sonraki masa tasarımı"
              title="Sonraki tasarım"
              onClick={() => cycleFloorSkin(1)}
            >
              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
            <span className="table-floor__skin-index" aria-hidden>
              {floorSkin + 1}/{FLOOR_SKIN_COUNT}
            </span>
          </div>
          <div className="table-floor__brand-row">
            <strong>{data?.restaurant?.name || user?.restaurant?.name || 'Restoran'}</strong>
            <button
              type="button"
              className={`table-floor__garson-icon${panelMode === 'garson' ? ' is-active' : ''}`}
              onClick={panelMode === 'garson' ? openFloorPanel : openGarsonPanel}
              title={panelMode === 'garson' ? 'Masalara dön' : 'Garson'}
              aria-label={panelMode === 'garson' ? 'Masalara dön' : 'Garson paneli'}
            >
              G
            </button>
          </div>
        </div>
        {panelMode === 'floor' ? (
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
        ) : null}
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

      {panelMode === 'garson' ? (
        <main className="table-floor__main table-floor__main--garson">
          <GarsonCallsPanel
            focusCallId={focusCallId}
            onOpenTable={(masa, grup) => {
              const next = new URLSearchParams(searchParams);
              next.delete('panel');
              next.set('masa', masa);
              if (grup) next.set('grup', grup);
              else next.delete('grup');
              setSearchParams(next, { replace: true });
              setSelectedCode(masa);
              if (grup) {
                setGroupId(grup);
                setSelectedGroupSlug(grup);
              }
            }}
          />
        </main>
      ) : (
      <>
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
                      <span className="floor-table__meta">
                        {table.expectedAt
                          ? new Date(table.expectedAt).toLocaleTimeString('tr-TR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Rezerve'}
                      </span>
                    ) : table.status === 'merged' ? (
                      <span className="floor-table__meta">Birleşik</span>
                    ) : table.occupied ? (
                      <span className="floor-table__meta">
                        <Clock3 className="w-3 h-3" />
                        {formatDurationMinutes(table.openedAt, now)}
                      </span>
                    ) : (
                      <span className="floor-table__meta floor-table__meta--free">
                        Boş
                        {table.seatingFee?.enabled ? ' · Ücretli' : ''}
                      </span>
                    )}
                  </span>
                  <span className="floor-table__caption">
                    <span className="floor-table__label">{table.name}</span>
                    {table.codeStatus === 'pending' ? (
                      <span className="floor-table__code-badge is-pending">Kod yok</span>
                    ) : null}
                    {table.codeStatus === 'verified' ? (
                      <span className="floor-table__code-badge is-ok">Kod OK</span>
                    ) : null}
                    {table.codeStatus === 'expired' ? (
                      <span className="floor-table__code-badge is-expired">Kod dolu</span>
                    ) : null}
                    {table.status === 'merged' && primaryName ? (
                      <span className="floor-table__link">{primaryName} ile</span>
                    ) : null}
                    {(table.mergedTables || []).length > 0 ? (
                      <span className="floor-table__link">
                        +{(table.mergedTables || []).length} birleşik
                      </span>
                    ) : null}
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
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="table-floor__status-row">
              <div className="table-floor__status-pills">
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
                {selected.codeStatus === 'pending' ? (
                  <span className="table-floor__pill is-code-pending">Kod bekleniyor</span>
                ) : null}
                {selected.codeStatus === 'verified' ? (
                  <span className="table-floor__pill is-code-ok">Kod girildi</span>
                ) : null}
                {selected.codeStatus === 'expired' ? (
                  <span className="table-floor__pill is-code-expired">Kod süresi doldu</span>
                ) : null}
                {selected.openedBy ? (
                  <span className="table-floor__pill is-muted">
                    {selected.openedBy === 'admin' ? 'Admin açtı' : 'QR okutuldu'}
                  </span>
                ) : null}
                {selected.seatingFee?.enabled ? (
                  <span className="table-floor__pill is-fee">Ücretli</span>
                ) : null}
              </div>
              {selected.status !== 'merged' ? (
                <div className="table-floor__status-actions">
                  {selected.reservationNote?.trim() && selected.status === 'open' ? (
                    <button
                      type="button"
                      className={`table-floor__icon-btn is-compact${notePanelOpen ? ' is-active' : ''}`}
                      title="Rezervasyon notu"
                      aria-label="Rezervasyon notu"
                      aria-expanded={notePanelOpen}
                      onClick={() => {
                        setNotePanelOpen((v) => !v);
                        setFeePanelOpen(false);
                      }}
                    >
                      <NotebookPen className="w-4 h-4" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={`table-floor__icon-btn is-compact${
                      feePanelOpen || selected.seatingFee?.enabled ? ' is-active' : ''
                    }${selected.seatingFee?.enabled ? ' is-fee' : ''}`}
                    title="Oturma ücreti"
                    aria-label="Oturma ücreti ayarı"
                    aria-expanded={feePanelOpen}
                    onClick={() => {
                      setFeePanelOpen((v) => !v);
                      setNotePanelOpen(false);
                    }}
                  >
                    <Timer className="w-4 h-4" />
                  </button>
                </div>
              ) : null}
            </div>

            {feePanelOpen && selected.status !== 'merged' ? (
              <div className="table-floor__pop">
                <div className="table-floor__pop-head">
                  <h3>Oturma ücreti</h3>
                  <button
                    type="button"
                    className="table-floor__icon-btn is-tiny"
                    aria-label="Kapat"
                    onClick={() => setFeePanelOpen(false)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <label className="table-floor__check">
                  <input
                    type="checkbox"
                    checked={feeEnabled}
                    onChange={(e) => setFeeEnabled(e.target.checked)}
                  />
                  Bu masa ücretli oturma
                </label>
                <div className="table-floor__fee-row">
                  <input
                    type="text"
                    inputMode="decimal"
                    className="table-floor__input"
                    placeholder="Tutar"
                    value={feeRate}
                    disabled={!feeEnabled}
                    onChange={(e) => setFeeRate(e.target.value)}
                  />
                  <select
                    className="table-floor__input"
                    value={feeUnit}
                    disabled={!feeEnabled}
                    onChange={(e) => setFeeUnit(e.target.value as 'minute' | 'hour')}
                  >
                    <option value="minute">₺ / dakika</option>
                    <option value="hour">₺ / saat</option>
                  </select>
                </div>
                <button
                  type="button"
                  className="table-floor__secondary"
                  disabled={busy}
                  onClick={() => void saveSeatingFee()}
                >
                  Ücreti kaydet
                </button>
              </div>
            ) : null}

            {notePanelOpen && selected.reservationNote?.trim() ? (
              <div className="table-floor__pop is-note">
                <div className="table-floor__pop-head">
                  <h3>Rezervasyon notu</h3>
                  <button
                    type="button"
                    className="table-floor__icon-btn is-tiny"
                    aria-label="Kapat"
                    onClick={() => setNotePanelOpen(false)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="table-floor__hint">{selected.reservationNote}</p>
              </div>
            ) : null}

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
                      {selected.status === 'reserved' ? (
                        <>
                          <span>Beklenen</span>
                          <strong>{formatExpectedAt(selected.expectedAt)}</strong>
                        </>
                      ) : (
                        <>
                          <span>Oturma</span>
                          <strong>{formatDurationPrecise(selected.openedAt, now)}</strong>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <Receipt className="w-4 h-4" />
                    <div>
                      <span>Toplam</span>
                      <strong>{formatMoney(liveTotal)}</strong>
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
                    <textarea
                      className="table-floor__input table-floor__textarea"
                      rows={3}
                      maxLength={1000}
                      placeholder="Not (telefonla istenenler, alerji, özel istek…)"
                      value={reservationNote}
                      onChange={(e) => setReservationNote(e.target.value)}
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
                  {selected.orders.length === 0 && liveSeatingFee <= 0 ? (
                    <p className="table-floor__hint">Henüz sipariş yok.</p>
                  ) : (
                    <ul>
                      {selected.orders.map((o) => (
                        <li
                          key={o.id}
                          onDoubleClick={() => {
                            if (selected.status === 'open') openOrderEdit(o);
                          }}
                          title={
                            selected.status === 'open'
                              ? 'Çift tıkla: düzenle'
                              : undefined
                          }
                        >
                          <div>
                            <strong>
                              {o.qty}× {o.name}
                            </strong>
                            <span>
                              {o.source === 'admin' ? 'Admin' : 'Müşteri'}
                              {formatAdjLabel(o) ? ` · ${formatAdjLabel(o)}` : ''}
                            </span>
                            {o.note?.trim() ? (
                              <em className="table-floor__order-note">{o.note}</em>
                            ) : null}
                          </div>
                          <div className="table-floor__order-side">
                            <em>{formatMoney(lineTotal(o))}</em>
                            {selected.status === 'open' ? (
                              <div className="table-floor__order-actions">
                                <button
                                  type="button"
                                  className="table-floor__icon-btn is-tiny"
                                  title="Satırı çoğalt (aynı ürün ayrı satır)"
                                  disabled={busy}
                                  onClick={() => void orderItemAction(o.id, 'copy')}
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  className="table-floor__icon-btn is-tiny is-danger"
                                  title="Satırı sil"
                                  disabled={busy}
                                  onClick={() => void orderItemAction(o.id, 'remove')}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </li>
                      ))}
                      {liveSeatingFee > 0 ? (
                        <li className="is-fee">
                          <div>
                            <strong>Oturma ücreti</strong>
                            <span>
                              {selected.seatingFee?.rate}
                              {selected.seatingFee?.unit === 'hour' ? ' ₺/saat' : ' ₺/dk'} ·
                              birikiyor
                            </span>
                          </div>
                          <em>{formatMoney(liveSeatingFee)}</em>
                        </li>
                      ) : null}
                    </ul>
                  )}
                </div>

                <div className="table-floor__drawer-actions">
                  {selected.occupied ? (
                    <div className="table-floor__access-code">
                      <p className="table-floor__access-code-label">
                        <KeyRound className="w-3.5 h-3.5" />
                        Erişim kodu
                        {selected.codeExpiresAt && selected.accessCode ? (
                          <em>
                            ·{' '}
                            {new Date(selected.codeExpiresAt).toLocaleTimeString('tr-TR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            ’e kadar
                          </em>
                        ) : null}
                      </p>
                      <div className="table-floor__access-code-row">
                        {selected.accessCode ? (
                          <>
                            <div className="table-floor__access-code-value" aria-live="polite">
                              {selected.accessCode}
                            </div>
                            <button
                              type="button"
                              className="table-floor__icon-btn is-compact"
                              disabled={busy}
                              title="Kodu yenile"
                              aria-label="Kodu yenile"
                              onClick={() => void regenerateCode()}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="table-floor__secondary"
                            disabled={busy}
                            onClick={() => void regenerateCode()}
                          >
                            Üret
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null}
                  {selected.occupied && selected.status === 'open' ? (
                    <div className="table-floor__action-row">
                      <button
                        type="button"
                        className="table-floor__secondary"
                        onClick={() => setBillOpen(true)}
                      >
                        Hesap yazdır
                      </button>
                      <button
                        type="button"
                        className="table-floor__primary"
                        disabled={busy}
                        onClick={() => void closeTable(selected, true)}
                      >
                        Ödeme alındı
                      </button>
                    </div>
                  ) : null}
                  {!selected.occupied || selected.status === 'reserved' ? (
                    <button
                      type="button"
                      className="table-floor__primary"
                      disabled={busy}
                      onClick={() => void openTable(selected)}
                    >
                      <UtensilsCrossed className="w-4 h-4" />
                      {selected.status === 'reserved' ? 'Misafir geldi · Aç' : 'Masayı aç'}
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
      </>
      )}

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
            <div className="table-floor-modal__body">
              {catalogGroups.length > 0 ? (
                <nav className="table-floor-modal__cats" aria-label="Ürün grupları">
                  <button
                    type="button"
                    className={`table-floor-modal__cat${catalogGroup === 'all' ? ' is-active' : ''}`}
                    onClick={() => setCatalogGroup('all')}
                  >
                    <span>Tümü</span>
                    <em>{catalog.length}</em>
                  </button>
                  {catalogGroups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      className={`table-floor-modal__cat${catalogGroup === g.id ? ' is-active' : ''}`}
                      onClick={() => setCatalogGroup(g.id)}
                    >
                      <span>{g.name}</span>
                      <em>{g.count}</em>
                    </button>
                  ))}
                </nav>
              ) : null}
              <div className="table-floor-modal__list">
                {filteredCatalog.length === 0 ? (
                  <p className="table-floor__hint" style={{ padding: '0.5rem 0.25rem' }}>
                    Ürün bulunamadı.
                  </p>
                ) : (
                  filteredCatalog.map((p) => {
                    const line = cart[p.id] || emptyCartLine();
                    const qty = line.qty;
                    return (
                      <div
                        key={p.id}
                        className={`table-floor-modal__row${qty > 0 ? ' is-selected' : ''}`}
                      >
                        <div className="table-floor-modal__row-main">
                          <div className="table-floor-modal__row-top">
                            <div>
                              <strong>{p.name}</strong>
                              <span>
                                {p.groupName} · {formatMoney(p.price)}
                              </span>
                            </div>
                            <div className="table-floor-modal__qty">
                              <button type="button" onClick={() => setCartQty(p.id, qty - 1)}>
                                −
                              </button>
                              <em>{qty}</em>
                              <button type="button" onClick={() => setCartQty(p.id, qty + 1)}>
                                +
                              </button>
                            </div>
                          </div>
                          {qty > 0 && (p.optionGroups?.length || 0) > 0 ? (
                            <div className="table-floor-modal__extras">
                              {(p.optionGroups || []).map((g) => {
                                const picks = line.selections[g.id] || [];
                                const blocked = blockedOptionIds(p.optionGroups || [], line.selections);
                                const activeOpts = g.options.filter((o) => o.isActive !== false);
                                if (g.type === 'single') {
                                  const visible = activeOpts.filter(
                                    (o) => !blocked.has(o.id) || picks[0]?.optionId === o.id
                                  );
                                  return (
                                    <label key={g.id}>
                                      <span>
                                        {g.name}
                                        {g.required ? ' *' : ''}
                                      </span>
                                      <select
                                        value={picks[0]?.optionId || ''}
                                        onChange={(e) => {
                                          const optionId = e.target.value;
                                          const next = { ...line.selections };
                                          if (!optionId) delete next[g.id];
                                          else next[g.id] = [{ optionId, qty: 1 }];
                                          patchCart(p.id, { selections: next });
                                        }}
                                      >
                                        {!g.required ? <option value="">Seçilmedi</option> : null}
                                        {visible.map((o) => (
                                          <option key={o.id} value={o.id}>
                                            {o.name}
                                            {g.pricing === 'replace'
                                              ? ` · ${formatMoney(o.price)}`
                                              : o.price
                                                ? ` · +${formatMoney(o.price)}`
                                                : ''}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                  );
                                }
                                if (g.type === 'choice') {
                                  const visible = activeOpts.filter((o) => !blocked.has(o.id));
                                  return (
                                    <div key={g.id} className="table-floor-modal__choice">
                                      <span className="table-floor-modal__multi-title">
                                        {g.name}
                                        {g.required ? ' *' : ''}
                                      </span>
                                      <div className="table-floor-modal__choice-chips">
                                        {visible.map((o) => {
                                          const on = picks.some((x) => x.optionId === o.id);
                                          return (
                                            <button
                                              key={o.id}
                                              type="button"
                                              className={`table-floor-modal__choice-chip${on ? ' is-on' : ''}`}
                                              onClick={() => {
                                                const nextPicks = on
                                                  ? picks.filter((x) => x.optionId !== o.id)
                                                  : [...picks, { optionId: o.id, qty: 1 }];
                                                const next = { ...line.selections };
                                                if (nextPicks.length) next[g.id] = nextPicks;
                                                else delete next[g.id];
                                                patchCart(p.id, { selections: next });
                                              }}
                                            >
                                              {o.name}
                                              {o.price > 0 ? (
                                                <small>+{formatMoney(o.price)}</small>
                                              ) : null}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                }
                                const groupQty = groupSelectedQty(line.selections, g.id);
                                const maxQty = effectiveMultiMaxTotalQty(
                                  p.optionGroups || [],
                                  line.selections,
                                  g
                                );
                                const atMax = maxQty > 0 && groupQty >= maxQty;
                                const visible = activeOpts.filter((o) => !blocked.has(o.id));
                                return (
                                  <div key={g.id} className="table-floor-modal__multi">
                                    <span className="table-floor-modal__multi-title">
                                      {g.name}
                                      {g.required ? ' *' : ''}
                                      {maxQty > 0 ? (
                                        <em className="table-floor-modal__max-hint">
                                          {' '}
                                          · en fazla {maxQty}
                                          {groupQty > 0 ? ` (${groupQty})` : ''}
                                        </em>
                                      ) : null}
                                    </span>
                                    {visible.map((o) => {
                                      const cur = picks.find((x) => x.optionId === o.id);
                                      const q = cur?.qty || 0;
                                      return (
                                        <div key={o.id} className="table-floor-modal__multi-row">
                                          <div>
                                            <strong>{o.name}</strong>
                                            <em>
                                              {o.price > 0 ? `+${formatMoney(o.price)} / adet` : 'Ücretsiz'}
                                            </em>
                                          </div>
                                          <div className="table-floor-modal__qty table-floor-modal__qty--sm">
                                            <button
                                              type="button"
                                              disabled={q <= 0}
                                              onClick={() => {
                                                const nextPicks = picks.filter((x) => x.optionId !== o.id);
                                                if (q > 1) nextPicks.push({ optionId: o.id, qty: q - 1 });
                                                const next = { ...line.selections };
                                                if (nextPicks.length) next[g.id] = nextPicks;
                                                else delete next[g.id];
                                                patchCart(p.id, { selections: next });
                                              }}
                                            >
                                              −
                                            </button>
                                            <em>{q}</em>
                                            <button
                                              type="button"
                                              disabled={atMax}
                                              onClick={() => {
                                                if (atMax) return;
                                                const nextPicks = picks.filter((x) => x.optionId !== o.id);
                                                nextPicks.push({ optionId: o.id, qty: q + 1 });
                                                patchCart(p.id, {
                                                  selections: { ...line.selections, [g.id]: nextPicks },
                                                });
                                              }}
                                            >
                                              +
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                              <p className="table-floor-modal__line-price">
                                Birim:{' '}
                                <strong>
                                  {formatMoney(
                                    computePreviewUnitPrice(p.price, p.optionGroups || [], line.selections)
                                  )}
                                </strong>
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <footer>
              <button
                type="button"
                className="table-floor__primary"
                disabled={orderSaving || !Object.values(cart).some((line) => line.qty > 0)}
                onClick={() => void submitOrder()}
              >
                {orderSaving ? 'Kaydediliyor…' : 'Siparişi kaydet'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {editingOrder ? (
        <div className="table-floor-modal" role="dialog" aria-modal="true" aria-label="Sipariş düzenle">
          <div className="table-floor-modal__backdrop" aria-hidden />
          <div className="table-floor-modal__panel table-floor-modal__panel--edit">
            <header className="table-floor-edit-header">
              <div>
                <p>Sipariş düzenle</p>
                <h3>{editingOrder.name}</h3>
              </div>
              <button
                type="button"
                className="table-floor__icon-btn"
                onClick={() => setEditingOrder(null)}
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="table-floor-modal__edit-scroll admin-scroll">
              <div className="table-floor-edit-row">
                <span className="table-floor-edit-label">Adet</span>
                <div className="table-floor-modal__qty table-floor-modal__qty--compact">
                  <button type="button" onClick={() => setEditQty((q) => Math.max(1, q - 1))}>
                    −
                  </button>
                  <em>{editQty}</em>
                  <button type="button" onClick={() => setEditQty((q) => Math.min(99, q + 1))}>
                    +
                  </button>
                </div>
              </div>

              {editGroups
                .filter((g) => g.type === 'single')
                .map((g) => {
                  const picked = editSelections[g.id]?.[0]?.optionId || '';
                  const blocked = blockedOptionIds(editGroups, editSelections);
                  const visible = g.options.filter(
                    (o) =>
                      o.isActive !== false &&
                      (!blocked.has(o.id) || picked === o.id)
                  );
                  return (
                    <div key={g.id} className="table-floor-edit-block">
                      <div className="table-floor-edit-row table-floor-edit-row--label">
                        <span className="table-floor-edit-label">{g.name || 'Tür seçimi'}</span>
                        {g.required ? <em className="table-floor-edit-tag">zorunlu</em> : null}
                      </div>
                      <div className="table-floor-edit-chips">
                        {visible.map((o) => {
                          const active = picked === o.id;
                          const priceText =
                            g.pricing === 'replace'
                              ? formatMoney(o.price)
                              : o.price
                                ? `+${formatMoney(o.price)}`
                                : '';
                          return (
                            <button
                              key={o.id}
                              type="button"
                              className={`table-floor-edit-chip${active ? ' is-active' : ''}`}
                              onClick={() =>
                                setEditSelections((prev) =>
                                  withPrunedSelections(editGroups, {
                                    ...prev,
                                    [g.id]: [{ optionId: o.id, qty: 1 }],
                                  })
                                )
                              }
                            >
                              {o.name}
                              {priceText ? <small>{priceText}</small> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

              {editGroups
                .filter((g) => g.type === 'choice')
                .map((g) => {
                  const picks = editSelections[g.id] || [];
                  const blocked = blockedOptionIds(editGroups, editSelections);
                  const visible = g.options.filter(
                    (o) => o.isActive !== false && !blocked.has(o.id)
                  );
                  return (
                    <div key={g.id} className="table-floor-edit-block">
                      <div className="table-floor-edit-row table-floor-edit-row--label">
                        <span className="table-floor-edit-label">{g.name || 'İstekler'}</span>
                        {g.required ? <em className="table-floor-edit-tag">zorunlu</em> : null}
                      </div>
                      <div className="table-floor-edit-chips">
                        {visible.map((o) => {
                          const active = picks.some((x) => x.optionId === o.id);
                          return (
                            <button
                              key={o.id}
                              type="button"
                              className={`table-floor-edit-chip${active ? ' is-active' : ''}`}
                              onClick={() =>
                                setEditSelections((prev) => {
                                  const cur = prev[g.id] || [];
                                  const nextPicks = active
                                    ? cur.filter((x) => x.optionId !== o.id)
                                    : [...cur, { optionId: o.id, qty: 1 }];
                                  const copy = { ...prev };
                                  if (nextPicks.length) copy[g.id] = nextPicks;
                                  else delete copy[g.id];
                                  return withPrunedSelections(editGroups, copy);
                                })
                              }
                            >
                              {o.name}
                              {o.price > 0 ? <small>+{formatMoney(o.price)}</small> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

              {editGroups
                .filter((g) => g.type === 'multi')
                .map((g) => {
                  const picks = editSelections[g.id] || [];
                  const blocked = blockedOptionIds(editGroups, editSelections);
                  const groupQty = groupSelectedQty(editSelections, g.id);
                  const maxQty = effectiveMultiMaxTotalQty(editGroups, editSelections, g);
                  const atMax = maxQty > 0 && groupQty >= maxQty;
                  const visible = g.options.filter(
                    (o) => o.isActive !== false && !blocked.has(o.id)
                  );
                  return (
                    <div key={g.id} className="table-floor-edit-block">
                      <div className="table-floor-edit-row table-floor-edit-row--label">
                        <span className="table-floor-edit-label">{g.name || 'Ekstralar'}</span>
                        {maxQty > 0 ? (
                          <em className="table-floor-edit-tag">
                            en fazla {maxQty}
                            {groupQty > 0 ? ` · ${groupQty}` : ''}
                          </em>
                        ) : null}
                      </div>
                      <div className="table-floor-edit-extras">
                        {visible.map((o) => {
                          const cur = picks.find((x) => x.optionId === o.id);
                          const q = cur?.qty || 0;
                          return (
                            <div key={o.id} className="table-floor-edit-extra">
                              <div className="table-floor-edit-extra__text">
                                <strong>{o.name}</strong>
                                {o.price > 0 ? (
                                  <span>+{formatMoney(o.price)}</span>
                                ) : null}
                              </div>
                              <div className="table-floor-modal__qty table-floor-modal__qty--compact">
                                <button
                                  type="button"
                                  disabled={q <= 0}
                                  onClick={() => {
                                    const next = picks.filter((x) => x.optionId !== o.id);
                                    if (q > 1) next.push({ optionId: o.id, qty: q - 1 });
                                    setEditSelections((prev) => {
                                      const copy = { ...prev };
                                      if (next.length) copy[g.id] = next;
                                      else delete copy[g.id];
                                      return withPrunedSelections(editGroups, copy);
                                    });
                                  }}
                                >
                                  −
                                </button>
                                <em>{q}</em>
                                <button
                                  type="button"
                                  disabled={atMax}
                                  onClick={() => {
                                    if (atMax) return;
                                    const next = picks.filter((x) => x.optionId !== o.id);
                                    next.push({ optionId: o.id, qty: q + 1 });
                                    setEditSelections((prev) =>
                                      withPrunedSelections(editGroups, {
                                        ...prev,
                                        [g.id]: next,
                                      })
                                    );
                                  }}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

              <div className="table-floor-edit-block">
                <div className="table-floor-edit-row table-floor-edit-row--label">
                  <span className="table-floor-edit-label">Not</span>
                  <em className="table-floor-edit-tag">opsiyonel · sonda +/− tutar</em>
                </div>
                <div
                  className={`table-floor-edit-note${editAdjType !== 'none' ? ' has-amount' : ''}`}
                >
                  <input
                    className="table-floor-edit-note__text"
                    value={editFreeNote}
                    maxLength={240}
                    placeholder="Bahşiş, borç, özel istek…"
                    onChange={(e) => setEditFreeNote(e.target.value)}
                  />
                  <div className="table-floor-edit-note__tools" role="group" aria-label="Tutar">
                    <button
                      type="button"
                      title="Fiyat ekle"
                      className={`table-floor-edit-note__op${editAdjType === 'extra' ? ' is-active' : ''}`}
                      onClick={() => setEditAdjType((t) => (t === 'extra' ? 'none' : 'extra'))}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      title="İndirim"
                      className={`table-floor-edit-note__op is-minus${editAdjType === 'discount' ? ' is-active' : ''}`}
                      onClick={() => setEditAdjType((t) => (t === 'discount' ? 'none' : 'discount'))}
                    >
                      −
                    </button>
                    {editAdjType !== 'none' ? (
                      <label className="table-floor-edit-note__amount-wrap">
                        <span>
                          {editAdjType === 'extra' ? 'Eklenecek tutar' : 'İndirim tutarı'}
                        </span>
                        <input
                          className="table-floor-edit-note__amount"
                          type="text"
                          inputMode="decimal"
                          value={editAdjValue}
                          placeholder="0"
                          aria-label={
                            editAdjType === 'extra' ? 'Eklenecek tutar' : 'İndirim tutarı'
                          }
                          onChange={(e) => {
                            const raw = e.target.value.replace(',', '.');
                            if (raw === '' || /^\d*\.?\d{0,2}$/.test(raw)) {
                              setEditAdjValue(e.target.value.replace(/[^\d.,]/g, ''));
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.ctrlKey || e.metaKey || e.altKey) return;
                            const ok = [
                              'Backspace',
                              'Delete',
                              'Tab',
                              'Escape',
                              'Enter',
                              'ArrowLeft',
                              'ArrowRight',
                              'Home',
                              'End',
                            ].includes(e.key);
                            if (ok) return;
                            if (/^\d$/.test(e.key) || e.key === '.' || e.key === ',') return;
                            e.preventDefault();
                          }}
                        />
                      </label>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <footer className="table-floor-modal__edit-footer">
              <div className="table-floor-edit-summary">
                <span>Toplam</span>
                <strong>{formatMoney(editPreviewTotal)}</strong>
              </div>
              <div className="table-floor-edit-footer-actions">
                <button
                  type="button"
                  className="table-floor__secondary"
                  onClick={() => setEditingOrder(null)}
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  className="table-floor__primary"
                  disabled={busy}
                  onClick={() => void saveOrderEdit()}
                >
                  {busy ? '…' : 'Kaydet'}
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}

      {selected && billOpen ? (
        <BillReceiptModal
          open={billOpen}
          onClose={() => setBillOpen(false)}
          restaurantName={data?.restaurant?.name || user?.restaurant?.name || 'Restoran'}
          logoUrl={user?.restaurant?.logoUrl}
          tableName={selected.name}
          guestName={selected.guestName}
          openedAt={selected.openedAt}
          orders={selected.orders.map((o) => ({
            id: o.id,
            name: o.name,
            qty: o.qty,
            price: o.price,
            note: o.note,
            freeNote: o.freeNote,
            selections: o.selections,
            adjustmentType: o.adjustmentType,
            adjustmentMode: o.adjustmentMode,
            adjustmentValue: o.adjustmentValue,
            createdAt: o.createdAt,
          }))}
          seatingFee={liveSeatingFee}
          total={liveTotal}
        />
      ) : null}
    </div>
  );
}
