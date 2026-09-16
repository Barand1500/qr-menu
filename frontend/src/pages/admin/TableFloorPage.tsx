import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock3,
  Copy,
  NotebookPen,
  Plus,
  Pin,
  PinOff,
  Timer,
  UtensilsCrossed,
  X,
  Trash2,
  HandHelping,
  Volume2,
  VolumeX,
  ArrowRight,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { adminPath } from '@/lib/adminPath';
import { playAdminNotificationSound } from '@/lib/notificationSound';
import {
  blockedOptionIds,
  computePreviewUnitPrice,
  effectiveMultiMaxTotalQty,
  groupSelectedQty,
  sanitizeSelections,
  type ProductOptionGroup,
} from '@/lib/productOptions';
import BillReceiptModal from '@/components/BillReceiptModal';
import KitchenTicketModal from '@/components/KitchenTicketModal';
import GarsonCallsPanel from '@/components/admin/GarsonCallsPanel';
import '@/table-floor.css';
import '@/garson-panel.css';

type PaymentMethod = 'cash' | 'card' | 'mixed';

type FloorSessionMeta = {
  pax?: number;
  serviceNote?: string;
  waiterUserId?: number | null;
  waiterName?: string | null;
  checkDiscount?: { mode: 'fixed' | 'percent'; value: number } | null;
};

type StaffUser = { id: number; fullName: string; role: string };

const FLOOR_SKIN_KEY = 'menu_qr_table_floor_skin';
const FLOOR_SOUND_KEY = 'menu_qr_floor_notify_sound';
const ORDER_RAIL_PIN_KEY = 'tf-order-rail-pinned';
const FLOOR_SKIN_COUNT = 5;

function readOrderRailPinned() {
  try {
    return localStorage.getItem(ORDER_RAIL_PIN_KEY) === '1';
  } catch {
    return false;
  }
}

function readFloorSkin(): number {
  try {
    const n = Number(localStorage.getItem(FLOOR_SKIN_KEY));
    if (Number.isInteger(n) && n >= 0 && n < FLOOR_SKIN_COUNT) return n;
  } catch {
    /* ignore */
  }
  return 0;
}

function readFloorSoundOn() {
  try {
    return localStorage.getItem(FLOOR_SOUND_KEY) !== '0';
  } catch {
    return true;
  }
}

function formatCodeCountdown(expiresAt: string | null | undefined, nowMs: number) {
  if (!expiresAt) return { label: '—', urgent: false, expired: true };
  const left = Math.max(0, new Date(expiresAt).getTime() - nowMs);
  const expired = left <= 0;
  const totalSec = Math.floor(left / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return {
    label: `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`,
    urgent: !expired && left <= 5 * 60_000,
    expired,
  };
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
  settledAt?: string | null;
};

type FloorPayment = {
  id: string;
  amount: number;
  method: PaymentMethod;
  itemIds: string[];
  seatingFee: number;
  createdAt: string;
  note?: string;
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
  payments?: FloorPayment[];
  paidTotal?: number;
  remaining?: number;
  seatingFee?: SeatingFeeConfig | null;
  seatingFeeAmount?: number;
  seatingFeePaid?: number;
  total: number;
  mergedTables?: string[];
  mergePrimary?: string | null;
  waiterAlertMs: number;
  meta?: FloorSessionMeta;
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

/** Masa üstü süre (dakika:saniye) */
function formatDurationMinutes(openedAt: string | null, now: number) {
  if (!openedAt) return '—';
  const ms = Math.max(0, now - new Date(openedAt).getTime());
  const totalSecs = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/** Son sipariş satırından idle süre */
function lastOrderAtIso(orders: FloorOrder[] | undefined) {
  if (!orders?.length) return null;
  let max = 0;
  for (const o of orders) {
    const t = new Date(o.createdAt).getTime();
    if (Number.isFinite(t) && t > max) max = t;
  }
  return max > 0 ? new Date(max).toISOString() : null;
}

function idleUrgency(openedOrOrderAt: string | null, now: number): 'ok' | 'warn' | 'hot' {
  if (!openedOrOrderAt) return 'ok';
  const mins = (now - new Date(openedOrOrderAt).getTime()) / 60_000;
  if (mins >= 20) return 'hot';
  if (mins >= 10) return 'warn';
  return 'ok';
}

function orderOptionsLine(o: FloorOrder) {
  if (o.selections?.length) {
    return o.selections
      .map((s) => {
        const label = s.label?.trim() || 'Seçenek';
        return s.qty > 1 ? `${label} ×${s.qty}` : label;
      })
      .join(' · ');
  }
  return (o.freeNote || '').trim();
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
  const [soundOn, setSoundOn] = useState(readFloorSoundOn);
  const [statusFilter, setStatusFilter] = useState<'all' | 'occupied'>('all');
  const [occupiedOpen, setOccupiedOpen] = useState({
    pending: true,
    filled: true,
    merged: true,
  });
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [selectedGroupSlug, setSelectedGroupSlug] = useState<string>('');
  const [now, setNow] = useState(() => Date.now());
  const pendingKeysRef = useRef<Set<string>>(new Set());
  const pendingSoundReadyRef = useRef(false);
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;
  const [busy, setBusy] = useState(false);
  const [codeTtlMenuOpen, setCodeTtlMenuOpen] = useState(false);
  const [orderRailOpen, setOrderRailOpen] = useState(false);
  const [orderRailPinned, setOrderRailPinned] = useState(readOrderRailPinned);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [orderSaving, setOrderSaving] = useState(false);
  const [railStep, setRailStep] = useState<'categories' | 'products'>('categories');
  const [railCategoryId, setRailCategoryId] = useState<string | null>(null);
  const [railProduct, setRailProduct] = useState<CatalogProduct | null>(null);
  const [railQty, setRailQty] = useState(1);
  const [railSelections, setRailSelections] = useState<CartLine['selections']>({});
  const [guestName, setGuestName] = useState('');
  const [expectedAt, setExpectedAt] = useState('');
  const [reservationNote, setReservationNote] = useState('');
  const [feeEnabled, setFeeEnabled] = useState(false);
  const [feeRate, setFeeRate] = useState('');
  const [feeUnit, setFeeUnit] = useState<'minute' | 'hour'>('minute');
  const [feePanelOpen, setFeePanelOpen] = useState(false);
  const [notePanelOpen, setNotePanelOpen] = useState(false);
  const [waiterPopOpen, setWaiterPopOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<FloorOrder | null>(null);
  const [editQty, setEditQty] = useState(1);
  const [editFreeNote, setEditFreeNote] = useState('');
  const [billOpen, setBillOpen] = useState(false);
  const [kitchenOpen, setKitchenOpen] = useState(false);
  const [payMode, setPayMode] = useState(false);
  const [payUnits, setPayUnits] = useState<Record<string, number>>({});
  const [payIncludeSeat, setPayIncludeSeat] = useState(false);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payTendered, setPayTendered] = useState('');
  const [payTip, setPayTip] = useState('');
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [metaBusy, setMetaBusy] = useState(false);
  const [receiptFocus, setReceiptFocus] = useState<{
    orders: FloorOrder[];
    seatingFee: number;
    total: number;
    paidTotal?: number;
    remaining?: number;
    methodLabel?: string;
    docTitle?: string;
  } | null>(null);
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

  function clearTableFocusParams() {
    setSearchParams(
      (prev) => {
        if (!prev.get('masa') && !prev.get('grup')) return prev;
        const next = new URLSearchParams(prev);
        next.delete('masa');
        next.delete('grup');
        return next;
      },
      { replace: true }
    );
  }

  function closeTableDrawer() {
    setSelectedCode(null);
    setSelectedGroupSlug('');
    setCodeTtlMenuOpen(false);
    setKitchenOpen(false);
    setBillOpen(false);
    setWaiterPopOpen(false);
    setFeePanelOpen(false);
    setNotePanelOpen(false);
    if (!orderRailPinned) setOrderRailOpen(false);
    resetOrderRailDraft();
    setReceiptFocus(null);
    exitPayMode();
    clearTableFocusParams();
  }

  useEffect(() => {
    setCodeTtlMenuOpen(false);
  }, [selectedCode, selectedGroupSlug]);

  /** Bildirim / deep-link: paneli bir kez aç, URL'den masa-grup'u sil (poll her seferinde yeniden açmasın) */
  useEffect(() => {
    const masa = searchParams.get('masa');
    const grup = searchParams.get('grup');
    if (!masa || !data) return;
    if (grup && data.groups.some((g) => g.id === grup)) setGroupId(grup);
    setSelectedCode(masa);
    setSelectedGroupSlug(grup || data.groups[0]?.id || '');
    setSearchParams(
      (prev) => {
        if (!prev.get('masa') && !prev.get('grup')) return prev;
        const next = new URLSearchParams(prev);
        next.delete('masa');
        next.delete('grup');
        return next;
      },
      { replace: true }
    );
  }, [data, searchParams, setSearchParams]);

  useEffect(() => {
    const poll = window.setInterval(() => void load(true), 4000);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [load]);

  useEffect(() => {
    if (!data) return;
    const next = new Set<string>();
    for (const g of data.groups) {
      for (const t of g.tables) {
        if (t.codeStatus === 'pending') next.add(`${g.id}::${t.code}`);
      }
    }
    if (pendingSoundReadyRef.current && soundOnRef.current) {
      for (const key of next) {
        if (!pendingKeysRef.current.has(key)) {
          playAdminNotificationSound();
          break;
        }
      }
    }
    pendingKeysRef.current = next;
    pendingSoundReadyRef.current = true;
  }, [data]);

  function toggleFloorSound() {
    setSoundOn((v) => {
      const next = !v;
      try {
        localStorage.setItem(FLOOR_SOUND_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const activeGroup = useMemo(
    () => data?.groups.find((g) => g.id === groupId) || data?.groups[0] || null,
    [data, groupId]
  );

  const occupiedCount = useMemo(() => {
    let occupied = 0;
    for (const g of data?.groups || []) {
      for (const t of g.tables) {
        if (t.occupied) occupied += 1;
      }
    }
    return occupied;
  }, [data]);

  type FloorDisplayRow = { table: FloorTable; groupId: string; groupName: string };

  const displayTables = useMemo((): FloorDisplayRow[] => {
    if (statusFilter !== 'all' || !activeGroup) return [];
    return activeGroup.tables.map((table) => ({
      table,
      groupId: activeGroup.id,
      groupName: activeGroup.name,
    }));
  }, [activeGroup, statusFilter]);

  const occupiedSections = useMemo(() => {
    const pending: FloorDisplayRow[] = [];
    const filled: FloorDisplayRow[] = [];
    const merged: FloorDisplayRow[] = [];
    if (statusFilter !== 'occupied') return { pending, filled, merged };
    for (const g of data?.groups || []) {
      for (const table of g.tables) {
        const row = { table, groupId: g.id, groupName: g.name };
        // Büyük birleşmiş kart — sadece ana masa
        if ((table.mergedTables || []).length > 0) {
          merged.push(row);
        }
        // Dolu / kod bekleyen: ana + katılan (uydu) hepsi
        if (!table.occupied) continue;
        if (table.codeStatus === 'pending') pending.push(row);
        else filled.push(row);
      }
    }
    return { pending, filled, merged };
  }, [data, statusFilter]);

  function joinedTableNames(table: FloorTable, tableGroupId: string) {
    const groupTables = data?.groups.find((g) => g.id === tableGroupId)?.tables || [];
    return (table.mergedTables || []).map(
      (code) => groupTables.find((t) => t.code === code)?.name || code
    );
  }

  const selectedGroup = useMemo(
    () => data?.groups.find((g) => g.id === (selectedGroupSlug || groupId)) || null,
    [data, selectedGroupSlug, groupId]
  );

  const selected = useMemo(() => {
    if (!selectedCode || !selectedGroup) return null;
    return selectedGroup.tables.find((t) => t.code === selectedCode) || null;
  }, [selectedGroup, selectedCode]);

  const sourceGroupName = selectedGroup?.name || '';

  const mergePrimaryTarget = useMemo(() => {
    const code = selected?.mergePrimary;
    if (!code || !data?.groups?.length) return null;
    for (const g of data.groups) {
      const table = g.tables.find((t) => t.code === code);
      if (table) {
        return { table, groupId: g.id, groupName: g.name };
      }
    }
    return null;
  }, [selected?.mergePrimary, data]);

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

  useEffect(() => {
    let cancelled = false;
    api<{ data: (StaffUser & { isActive?: boolean })[] }>('/api/admin/users?limit=100')
      .then((res) => {
        if (!cancelled) {
          setStaffUsers(
            (res.data || []).filter((u) => u.role && u.isActive !== false)
          );
        }
      })
      .catch(() => {
        if (!cancelled) setStaffUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveSessionMeta(patch: {
    pax?: number | null;
    serviceNote?: string | null;
    waiterUserId?: number | null;
    waiterName?: string | null;
    checkDiscount?: { mode: 'fixed' | 'percent'; value: number } | null;
  }) {
    if (!selected) return;
    setMetaBusy(true);
    try {
      await api('/api/admin/table-floor/meta', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: selected.sessionId,
          tableNumber: selected.code,
          groupSlug: selectedGroupSlug || undefined,
          ...patch,
        }),
      });
      await load(true);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setMetaBusy(false);
    }
  }

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

  const livePaidTotal = selected?.paidTotal ?? 0;
  const liveSeatPaid = selected?.seatingFeePaid ?? 0;
  const liveDiscount = selected?.meta?.checkDiscount ?? null;
  const liveRemaining = useMemo(() => {
    if (!selected) return 0;
    const unpaidSum = selected.orders
      .filter((o) => !o.settledAt)
      .reduce((s, o) => s + lineTotal(o), 0);
    const seatLeftAmt = Math.max(0, liveSeatingFee - liveSeatPaid);
    const gross = unpaidSum + seatLeftAmt;
    let disc = 0;
    if (liveDiscount?.value) {
      disc =
        liveDiscount.mode === 'percent'
          ? (gross * liveDiscount.value) / 100
          : liveDiscount.value;
      disc = Math.min(gross, Math.max(0, Math.round(disc * 100) / 100));
    }
    return Math.round((gross - disc) * 100) / 100;
  }, [selected, liveSeatingFee, liveSeatPaid, liveDiscount]);
  const liveGrossRemaining = useMemo(() => {
    if (!selected) return 0;
    const unpaidSum = selected.orders
      .filter((o) => !o.settledAt)
      .reduce((s, o) => s + lineTotal(o), 0);
    const seatLeftAmt = Math.max(0, liveSeatingFee - liveSeatPaid);
    return Math.round((unpaidSum + seatLeftAmt) * 100) / 100;
  }, [selected, liveSeatingFee, liveSeatPaid]);
  const liveDiscountAmount = Math.max(0, Math.round((liveGrossRemaining - liveRemaining) * 100) / 100);

  const seatLeft = Math.max(0, Math.round((liveSeatingFee - liveSeatPaid) * 100) / 100);

  const paySelectedAmount = useMemo(() => {
    if (!selected) return 0;
    let sum = 0;
    let payingAllUnits = true;
    for (const o of selected.orders) {
      if (o.settledAt) continue;
      const units = Math.max(0, Math.min(o.qty, payUnits[o.id] || 0));
      if (units < o.qty) payingAllUnits = false;
      if (units > 0) sum += lineTotal({ ...o, qty: units });
    }
    if (payIncludeSeat) sum += seatLeft;
    else if (seatLeft > 0.009) payingAllUnits = false;
    if (payingAllUnits && liveDiscountAmount > 0) {
      sum = Math.max(0, sum - liveDiscountAmount);
    }
    return Math.round(sum * 100) / 100;
  }, [selected, payUnits, payIncludeSeat, seatLeft, liveDiscountAmount]);

  const payTipAmt = Math.max(0, Math.round((Number(String(payTip).replace(',', '.')) || 0) * 100) / 100);
  const payTenderedAmt = Math.round((Number(String(payTendered).replace(',', '.')) || 0) * 100) / 100;
  const payChangeAmt =
    payMethod === 'cash' && payTenderedAmt > 0
      ? Math.max(0, Math.round((payTenderedAmt - paySelectedAmount - payTipAmt) * 100) / 100)
      : 0;

  useEffect(() => {
    if (!payMode || payMethod !== 'cash') return;
    setPayTendered(String(paySelectedAmount || ''));
  }, [payMode, payMethod, paySelectedAmount]);

  function methodLabel(m: PaymentMethod) {
    if (m === 'card') return 'Kart';
    if (m === 'mixed') return 'Karışık';
    return 'Nakit';
  }

  function enterPayMode() {
    if (!selected) return;
    const next: Record<string, number> = {};
    for (const o of selected.orders) {
      if (!o.settledAt) next[o.id] = o.qty;
    }
    setPayUnits(next);
    setPayIncludeSeat(seatLeft > 0.009);
    setPayMethod('cash');
    setPayTendered('');
    setPayTip('');
    if (!orderRailPinned) {
      setOrderRailOpen(false);
      resetOrderRailDraft();
    }
    setPayMode(true);
  }

  function exitPayMode() {
    setPayMode(false);
    setPayUnits({});
    setPayIncludeSeat(false);
    setPayTendered('');
    setPayTip('');
  }

  function togglePayItem(id: string, maxQty: number) {
    setPayUnits((prev) => {
      const cur = prev[id] || 0;
      const nextUnits = cur >= maxQty ? 0 : cur + 1;
      const next = { ...prev };
      if (nextUnits <= 0) delete next[id];
      else next[id] = nextUnits;
      return next;
    });
  }

  async function submitPayment(payload?: {
    itemIds: string[];
    itemQtys?: Record<string, number>;
    includeSeatingFee: boolean;
    method: PaymentMethod;
  }) {
    if (!selected?.sessionId) return;
    const itemQtys =
      payload?.itemQtys ||
      Object.fromEntries(
        Object.entries(payUnits).filter(([, q]) => q > 0)
      );
    const body = payload || {
      itemIds: Object.keys(itemQtys),
      itemQtys,
      includeSeatingFee: payIncludeSeat && seatLeft > 0.009,
      method: payMethod,
    };
    if (!body.itemIds.length && !body.includeSeatingFee) {
      window.alert('Ödenecek kalem seçin');
      return;
    }
    setBusy(true);
    try {
      await api('/api/admin/table-floor/payment', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: selected.sessionId,
          tableNumber: selected.code,
          groupSlug: selectedGroupSlug,
          itemIds: body.itemIds,
          itemQtys: body.itemQtys,
          includeSeatingFee: body.includeSeatingFee,
          method: body.method,
          tendered: body.method === 'cash' && payTenderedAmt > 0 ? payTenderedAmt : undefined,
          tip: payTipAmt > 0 ? payTipAmt : undefined,
        }),
      });
      await load();
      exitPayMode();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Ödeme kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }

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

  function handleTableClick(table: FloorTable, tableGroupId?: string) {
    const gId = tableGroupId || groupId;
    if (pickMode === 'move') {
      if (table.code === selectedCode && gId === selectedGroupSlug) return;
      if (table.occupied || table.status === 'merged') return;
      setConfirm({
        kind: 'move',
        targetCode: table.code,
        targetName: table.name,
        targetGroupId: gId,
        targetGroupName:
          data?.groups.find((g) => g.id === gId)?.name || activeGroup?.name || '',
      });
      return;
    }
    if (pickMode === 'merge') {
      if (gId !== selectedGroupSlug) return;
      if (table.code === selectedCode) return;
      if (table.status === 'merged') return;
      setMergePick((prev) =>
        prev.includes(table.code) ? prev.filter((c) => c !== table.code) : [...prev, table.code]
      );
      return;
    }
    setSelectedCode(table.code);
    setSelectedGroupSlug(gId);
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

  async function approveTableCode(table: FloorTable) {
    if (!activeGroup || busy) return;
    setBusy(true);
    try {
      await api('/api/admin/table-floor/approve-code', {
        method: 'POST',
        body: JSON.stringify({
          tableNumber: table.code,
          groupSlug: selectedGroupSlug || activeGroup.id,
          sessionId: table.sessionId,
        }),
      });
      await load(true);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Kod onaylanamadı');
    } finally {
      setBusy(false);
    }
  }

  async function adjustCodeTtl(table: FloorTable, deltaMinutes: number) {
    if (!activeGroup || busy) return;
    setBusy(true);
    try {
      await api('/api/admin/table-floor/adjust-code-ttl', {
        method: 'POST',
        body: JSON.stringify({
          tableNumber: table.code,
          groupSlug: selectedGroupSlug || activeGroup.id,
          sessionId: table.sessionId,
          deltaMinutes,
        }),
      });
      await load(true);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Süre güncellenemedi');
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

  function resetOrderRailDraft() {
    setRailStep('categories');
    setRailCategoryId(null);
    setRailProduct(null);
    setRailQty(1);
    setRailSelections({});
  }

  async function ensureCatalog() {
    try {
      const list = await api<CatalogProduct[]>('/api/admin/table-floor/products');
      setCatalog(list);
    } catch {
      /* keep previous catalog */
    }
  }

  async function openOrderRail() {
    setOrderRailOpen(true);
    resetOrderRailDraft();
    await ensureCatalog();
  }

  function closeOrderRail() {
    if (orderRailPinned) return;
    setOrderRailOpen(false);
    resetOrderRailDraft();
  }

  function toggleOrderRailPin() {
    setOrderRailPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(ORDER_RAIL_PIN_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      if (next) setOrderRailOpen(true);
      return next;
    });
  }

  function pickRailCategory(id: string) {
    setRailCategoryId(id);
    setRailStep('products');
    setRailProduct(null);
    setRailQty(1);
    setRailSelections({});
  }

  function pickRailProduct(p: CatalogProduct) {
    const groups = p.optionGroups || [];
    setRailProduct(p);
    setRailQty(1);
    setRailSelections(defaultSelections(groups));
  }

  async function addRailProduct() {
    if (!selected || !railProduct || railQty < 1) return;
    const groups = railProduct.optionGroups || [];
    for (const g of groups) {
      if (!g.required) continue;
      const picks = railSelections[g.id] || [];
      if (!picks.length) {
        window.alert(`${g.name || 'Seçenek'} zorunlu`);
        return;
      }
    }
    const selections = Object.entries(railSelections).flatMap(([groupId, picks]) =>
      picks.map((pick) => ({
        groupId,
        optionId: pick.optionId,
        qty: pick.qty,
      }))
    );
    const unit = groups.length
      ? computePreviewUnitPrice(railProduct.price, groups, railSelections)
      : railProduct.price;
    setOrderSaving(true);
    try {
      await api('/api/admin/table-floor/orders', {
        method: 'POST',
        body: JSON.stringify({
          tableNumber: selected.code,
          groupSlug: selectedGroupSlug,
          items: [
            {
              productId: railProduct.id,
              name: railProduct.name,
              qty: railQty,
              price: unit,
              ...(selections.length ? { selections } : {}),
            },
          ],
        }),
      });
      setRailProduct(null);
      setRailQty(1);
      setRailSelections({});
      await load(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Sipariş eklenemedi');
    } finally {
      setOrderSaving(false);
    }
  }

  function setRailOptionSelections(next: CartLine['selections']) {
    if (!railProduct) return;
    setRailSelections(withPrunedSelections(railProduct.optionGroups || [], next));
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

  const railProducts = useMemo(() => {
    if (!railCategoryId) return [];
    return catalog.filter((p) => {
      const id = p.groupId != null ? String(p.groupId) : p.groupName.trim() || 'other';
      return id === railCategoryId;
    });
  }, [catalog, railCategoryId]);

  const railPreviewUnit = useMemo(() => {
    if (!railProduct) return 0;
    const groups = railProduct.optionGroups || [];
    if (!groups.length) return railProduct.price;
    return computePreviewUnitPrice(railProduct.price, groups, railSelections);
  }, [railProduct, railSelections]);

  useEffect(() => {
    const inRoomNow = Boolean(selectedCode && !pickMode);
    if (!inRoomNow) {
      if (!orderRailPinned) setOrderRailOpen(false);
      setWaiterPopOpen(false);
      return;
    }
    if (orderRailPinned) {
      setOrderRailOpen(true);
      void ensureCatalog();
    }
  }, [selectedCode, selectedGroupSlug, pickMode, orderRailPinned]);

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

  function renderMergedFloorUnit({ table, groupId: tableGroupId, groupName }: FloorDisplayRow) {
    const menuUrl = `${origin}/menu?masa=${encodeURIComponent(table.code)}&grup=${tableGroupId}`;
    const alerting = table.waiterAlertMs > 0;
    const qrColor = resolveQrColor(table.colorId);
    const isSource = selectedCode === table.code && selectedGroupSlug === tableGroupId;
    const joined = joinedTableNames(table, tableGroupId);
    const codeWaiting = table.occupied && table.codeStatus === 'pending';
    const codeExpiredTable = table.occupied && table.codeStatus === 'expired';
    const codeOccupied =
      table.occupied &&
      !codeWaiting &&
      !codeExpiredTable &&
      (table.codeStatus === 'verified' || table.codeStatus === 'empty' || !table.codeStatus);

    return (
      <button
        key={`combined-${tableGroupId}-${table.code}`}
        type="button"
        className={`floor-table floor-table--combined${codeOccupied ? ' is-occupied' : ''}${
          codeWaiting ? ' is-code-waiting' : ''
        }${codeExpiredTable ? ' is-code-expired-table' : ''}${
          alerting ? ' is-alerting' : ''
        }${isSource ? ' is-selected' : ''}`}
        onClick={() => handleTableClick(table, tableGroupId)}
      >
        <span className="floor-table__chair floor-table__chair--n" aria-hidden />
        <span className="floor-table__chair floor-table__chair--ne" aria-hidden />
        <span className="floor-table__chair floor-table__chair--nw" aria-hidden />
        <span className="floor-table__chair floor-table__chair--e" aria-hidden />
        <span className="floor-table__chair floor-table__chair--w" aria-hidden />
        <span className="floor-table__chair floor-table__chair--s" aria-hidden />
        <span className="floor-table__chair floor-table__chair--se" aria-hidden />
        <span className="floor-table__chair floor-table__chair--sw" aria-hidden />
        <span className="floor-table__top">
          <span className="floor-table__badges">
            {table.occupied ? (
              <span className="floor-table__meta is-session" title="Oturum süresi">
                <Clock3 className="w-3 h-3" />
                {formatDurationMinutes(table.openedAt, now)}
              </span>
            ) : null}
            {table.occupied ? (
              <span
                className={`floor-table__meta is-idle is-${idleUrgency(
                  lastOrderAtIso(table.orders),
                  now
                )}`}
                title="Son siparişten beri"
              >
                <Timer className="w-3 h-3" />
                {lastOrderAtIso(table.orders)
                  ? formatDurationMinutes(lastOrderAtIso(table.orders), now)
                  : '—'}
              </span>
            ) : null}
            {table.codeStatus === 'pending' ? (
              <span className="floor-table__meta is-code is-pending">Kod bekliyor</span>
            ) : null}
            {table.codeStatus === 'verified' ? (
              <span className="floor-table__meta is-code is-ok">Kod OK</span>
            ) : null}
            {table.codeStatus === 'expired' ? (
              <span className="floor-table__meta is-code is-expired">Süre doldu</span>
            ) : null}
          </span>
          <span className="floor-table__qr" style={{ background: qrColor.bg }}>
            <QRCodeSVG
              value={menuUrl}
              size={40}
              level="M"
              includeMargin={false}
              fgColor={qrColor.fg}
              bgColor={qrColor.bg}
            />
          </span>
        </span>
        <span className="floor-table__caption">
          <span className="floor-table__label">{table.name}</span>
          {joined.length > 0 ? (
            <span className="floor-table__combined-members" title={joined.join(', ')}>
              {joined.length} katıldı
            </span>
          ) : (
            <span className="floor-table__caption-slot" aria-hidden>
              {statusFilter !== 'all' ? groupName : '\u00a0'}
            </span>
          )}
        </span>
      </button>
    );
  }

  function renderFloorTableRow({ table, groupId: tableGroupId, groupName }: FloorDisplayRow) {
    const menuUrl = `${origin}/menu?masa=${encodeURIComponent(table.code)}&grup=${tableGroupId}`;
    const alerting = table.waiterAlertMs > 0;
    const qrColor = resolveQrColor(table.colorId);
    const isSource = selectedCode === table.code && selectedGroupSlug === tableGroupId;
    const isMergePick = pickMode === 'merge' && mergePick.includes(table.code);
    const moveSelectable =
      pickMode === 'move' && !table.occupied && table.status !== 'merged';
    const mergeSelectable =
      pickMode === 'merge' &&
      selectedGroupSlug === tableGroupId &&
      table.code !== selectedCode &&
      table.status !== 'merged';
    const groupTables = data?.groups.find((g) => g.id === tableGroupId)?.tables || [];
    const primaryName =
      table.mergePrimary && groupTables.find((t) => t.code === table.mergePrimary)?.name;
    const codeWaiting = table.occupied && table.codeStatus === 'pending';
    const codeExpiredTable = table.occupied && table.codeStatus === 'expired';
    const codeOccupied =
      table.occupied &&
      !codeWaiting &&
      !codeExpiredTable &&
      (table.codeStatus === 'verified' || table.codeStatus === 'empty' || !table.codeStatus);

    return (
      <button
        key={`${tableGroupId}-${table.code}`}
        type="button"
        className={`floor-table${codeOccupied ? ' is-occupied' : ''}${
          codeWaiting ? ' is-code-waiting' : ''
        }${codeExpiredTable ? ' is-code-expired-table' : ''}${
          table.status === 'reserved' ? ' is-reserved' : ''
        }${table.status === 'merged' ? ' is-merged' : ''}${alerting ? ' is-alerting' : ''}${
          isSource ? ' is-selected' : ''
        }${isMergePick ? ' is-merge-pick' : ''}${moveSelectable ? ' is-pickable' : ''}${
          pickMode && !moveSelectable && !mergeSelectable && !isSource ? ' is-dimmed' : ''
        }`}
        onClick={() => handleTableClick(table, tableGroupId)}
      >
        <span className="floor-table__chair floor-table__chair--n" aria-hidden />
        <span className="floor-table__chair floor-table__chair--e" aria-hidden />
        <span className="floor-table__chair floor-table__chair--s" aria-hidden />
        <span className="floor-table__chair floor-table__chair--w" aria-hidden />
        <span className="floor-table__top">
          <span className="floor-table__badges">
            {table.status === 'reserved' ? (
              <span className="floor-table__meta is-session">
                {table.expectedAt
                  ? new Date(table.expectedAt).toLocaleTimeString('tr-TR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Rezerve'}
              </span>
            ) : table.status === 'merged' ? (
              <span className="floor-table__meta is-session">Birleşik</span>
            ) : table.occupied ? (
              <span className="floor-table__meta is-session" title="Oturum süresi">
                <Clock3 className="w-3 h-3" />
                {formatDurationMinutes(table.openedAt, now)}
              </span>
            ) : (
              <span className="floor-table__meta floor-table__meta--free is-session">
                Boş
                {table.seatingFee?.enabled ? ' · Ücretli' : ''}
              </span>
            )}
            {table.occupied && table.status === 'open' ? (
              <span
                className={`floor-table__meta is-idle is-${idleUrgency(
                  lastOrderAtIso(table.orders),
                  now
                )}`}
                title="Son siparişten beri"
              >
                <Timer className="w-3 h-3" />
                {lastOrderAtIso(table.orders)
                  ? formatDurationMinutes(lastOrderAtIso(table.orders), now)
                  : '—'}
              </span>
            ) : null}
            {table.occupied && table.codeStatus === 'empty' ? (
              <span className="floor-table__meta is-code is-empty">Kod yok</span>
            ) : null}
            {table.codeStatus === 'pending' ? (
              <span className="floor-table__meta is-code is-pending">Kod bekliyor</span>
            ) : null}
            {table.codeStatus === 'verified' ? (
              <span className="floor-table__meta is-code is-ok">Kod OK</span>
            ) : null}
            {table.codeStatus === 'expired' ? (
              <span className="floor-table__meta is-code is-expired">Süre doldu</span>
            ) : null}
          </span>
          <span className="floor-table__qr" style={{ background: qrColor.bg }}>
            <QRCodeSVG
              value={menuUrl}
              size={40}
              level="M"
              includeMargin={false}
              fgColor={qrColor.fg}
              bgColor={qrColor.bg}
            />
          </span>
        </span>
        <span className="floor-table__caption">
          <span className="floor-table__label">{table.name}</span>
          <span className="floor-table__caption-slot" aria-hidden>
            {table.status === 'merged' && primaryName
              ? `${primaryName} ile`
              : (table.mergedTables || []).length > 0
                ? `+${(table.mergedTables || []).length} birleşik`
                : statusFilter !== 'all'
                  ? groupName
                  : '\u00a0'}
          </span>
        </span>
      </button>
    );
  }

  return (
    <div
      className={`table-floor table-floor--skin-${floorSkin}${
        selected && !pickMode && panelMode === 'floor' ? ' is-room' : ''
      }`}
    >
      <header className="table-floor__top">
        {selected && !pickMode && panelMode === 'floor' ? (
          <div className="table-floor__top-lead">
            <button
              type="button"
              className="table-floor__back"
              aria-label="Masalara dön"
              onClick={closeTableDrawer}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Masalar</span>
            </button>
            <p className="table-floor__room-title is-phrase">
              <em>{sourceGroupName || activeGroup?.name}</em>
              <span> grubundaki </span>
              <strong>{selected.name}</strong>
              <span> masası</span>
            </p>
          </div>
        ) : (
          <Link to={adminPath()} className="table-floor__back" aria-label="Admin panele dön">
            <ArrowLeft className="w-4 h-4" />
            <span>Geri</span>
          </Link>
        )}
        <div className="table-floor__brand">
          {!(selected && !pickMode && panelMode === 'floor') ? (
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
              <p>{panelMode === 'garson' ? user?.fullName || 'Garson' : 'Masa görünümü'}</p>
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
          ) : null}
          {selected && !pickMode && panelMode === 'floor' ? (
            <div className="table-floor__header-status" aria-label="Masa durumu">
              <div className="table-floor__header-pills">
                <span
                  className={`table-floor__pill is-compact${
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
                      ? mergePrimaryTarget
                        ? `Birleşik · ${mergePrimaryTarget.table.name}`
                        : 'Birleşik'
                      : selected.occupied
                        ? 'Dolu'
                        : 'Boş'}
                </span>
                {selected.waiterAlertMs > 0 ? (
                  <span className="table-floor__pill is-wait is-compact">
                    <HandHelping className="w-3.5 h-3.5" />
                    Garson
                  </span>
                ) : null}
                {selected.codeStatus === 'pending' ? (
                  <span className="table-floor__pill is-code-pending is-compact">Kod bekleniyor</span>
                ) : null}
                {selected.codeStatus === 'verified' ? (
                  <span className="table-floor__pill is-code-ok is-compact">Kod girildi</span>
                ) : null}
                {selected.codeStatus === 'expired' ? (
                  <span className="table-floor__pill is-code-expired is-compact">Süre doldu</span>
                ) : null}
                {selected.openedBy ? (
                  <span className="table-floor__pill is-muted is-compact">
                    {selected.openedBy === 'admin' ? 'Admin' : 'QR'}
                  </span>
                ) : null}
              </div>
              {selected.occupied && selected.status === 'open' ? (
                <div className="table-floor__header-timers" aria-label="Masa sayaçları">
                  <div
                    className={`table-floor__header-timer is-${idleUrgency(selected.openedAt, now)}`}
                    title="Oturum süresi"
                  >
                    <Clock3 className="w-3.5 h-3.5" aria-hidden />
                    <div>
                      <span>Oturum</span>
                      <strong>{formatDurationMinutes(selected.openedAt, now)}</strong>
                    </div>
                  </div>
                  <div
                    className={`table-floor__header-timer is-${idleUrgency(
                      lastOrderAtIso(selected.orders),
                      now
                    )}`}
                    title="Son siparişten beri"
                  >
                    <Timer className="w-3.5 h-3.5" aria-hidden />
                    <div>
                      <span>Son sipariş</span>
                      <strong>
                        {lastOrderAtIso(selected.orders)
                          ? formatDurationMinutes(lastOrderAtIso(selected.orders), now)
                          : '—'}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="table-floor__brand-row">
              <strong>{data?.restaurant?.name || user?.restaurant?.name || 'Restoran'}</strong>
              <button
                type="button"
                className={`table-floor__sound-btn${soundOn ? '' : ' is-muted'}`}
                onClick={toggleFloorSound}
                title={soundOn ? 'Bildirim sesi açık' : 'Bildirim sesi kapalı'}
                aria-label={soundOn ? 'Bildirim sesini kapat' : 'Bildirim sesini aç'}
              >
                {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
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
          )}
        </div>
        {panelMode === 'floor' && !(selected && !pickMode) ? (
          <div className="table-floor__nav-filters">
            <button
              type="button"
              className={`table-floor__chip table-floor__chip--occupied${
                statusFilter === 'occupied' ? ' is-active' : ''
              }`}
              onClick={() => {
                setStatusFilter((prev) => (prev === 'occupied' ? 'all' : 'occupied'));
                if (!pickMode) closeTableDrawer();
              }}
            >
              Dolu masalar
              <em>{occupiedCount}</em>
            </button>
            <div className="table-floor__filters" role="tablist" aria-label="Masa grupları">
              {(data?.groups || []).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === 'all' && g.id === activeGroup?.id}
                  className={`table-floor__chip${
                    statusFilter === 'all' && g.id === activeGroup?.id ? ' is-active' : ''
                  }`}
                  onClick={() => {
                    setStatusFilter('all');
                    setGroupId(g.id);
                    if (!pickMode) closeTableDrawer();
                  }}
                >
                  {g.name}
                  <em>{g.count}</em>
                </button>
              ))}
            </div>
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
      <main
        className={`table-floor__main${pickMode ? ' is-picking' : ''}${
          selected && !pickMode ? ' is-away' : ''
        }`}
      >
        {loading && !data ? (
          <div className="table-floor__empty">Masalar yükleniyor…</div>
        ) : error ? (
          <div className="table-floor__empty">{error}</div>
        ) : statusFilter === 'occupied' ? (
          occupiedCount === 0 ? (
            <div className="table-floor__empty">Dolu masa yok.</div>
          ) : (
            <div className="table-floor__occupied-view">
              {occupiedSections.pending.length > 0 ? (
                <section
                  className={`table-floor__section table-floor__section--pending${
                    occupiedOpen.pending ? ' is-open' : ' is-collapsed'
                  }`}
                >
                  <button
                    type="button"
                    className="table-floor__section-head"
                    aria-expanded={occupiedOpen.pending}
                    onClick={() =>
                      setOccupiedOpen((prev) => ({ ...prev, pending: !prev.pending }))
                    }
                  >
                    <h3>Kod beklenen masalar</h3>
                    <em>{occupiedSections.pending.length}</em>
                    <ChevronDown
                      className="table-floor__section-chevron"
                      strokeWidth={2.4}
                      aria-hidden
                    />
                  </button>
                  {occupiedOpen.pending ? (
                    <div className="table-floor__grid table-floor__grid--units">
                      {occupiedSections.pending.map(renderFloorTableRow)}
                    </div>
                  ) : null}
                </section>
              ) : null}
              <section
                className={`table-floor__section table-floor__section--filled${
                  occupiedOpen.filled ? ' is-open' : ' is-collapsed'
                }`}
              >
                <button
                  type="button"
                  className="table-floor__section-head"
                  aria-expanded={occupiedOpen.filled}
                  onClick={() =>
                    setOccupiedOpen((prev) => ({ ...prev, filled: !prev.filled }))
                  }
                >
                  <h3>Dolu masalar</h3>
                  <em>{occupiedSections.filled.length}</em>
                  <ChevronDown
                    className="table-floor__section-chevron"
                    strokeWidth={2.4}
                    aria-hidden
                  />
                </button>
                {occupiedOpen.filled ? (
                  occupiedSections.filled.length ? (
                    <div className="table-floor__grid table-floor__grid--units">
                      {occupiedSections.filled.map(renderFloorTableRow)}
                    </div>
                  ) : (
                    <p className="table-floor__section-empty">Kod OK dolu masa yok.</p>
                  )
                ) : null}
              </section>
              {occupiedSections.merged.length > 0 ? (
                <section
                  className={`table-floor__section table-floor__section--merged${
                    occupiedOpen.merged ? ' is-open' : ' is-collapsed'
                  }`}
                >
                  <button
                    type="button"
                    className="table-floor__section-head"
                    aria-expanded={occupiedOpen.merged}
                    onClick={() =>
                      setOccupiedOpen((prev) => ({ ...prev, merged: !prev.merged }))
                    }
                  >
                    <h3>Birleşmiş masalar</h3>
                    <em>{occupiedSections.merged.length}</em>
                    <ChevronDown
                      className="table-floor__section-chevron"
                      strokeWidth={2.4}
                      aria-hidden
                    />
                  </button>
                  {occupiedOpen.merged ? (
                    <div className="table-floor__grid table-floor__grid--units">
                      {occupiedSections.merged.map(renderMergedFloorUnit)}
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>
          )
        ) : !displayTables.length ? (
          <div className="table-floor__empty">
            Bu grupta masa yok. Barkod Yazdır sayfasından ekleyin.
          </div>
        ) : (
          <div className="table-floor__grid">{displayTables.map(renderFloorTableRow)}</div>
        )}
      </main>

      <aside
        className={`table-floor__room${selected && !pickMode ? ' is-open' : ''}`}
        aria-hidden={!selected || Boolean(pickMode)}
      >
        {selected && activeGroup && !pickMode ? (
          <>
            {notePanelOpen && selected.reservationNote?.trim() ? (
              <div className="table-floor__pop is-note is-mini">
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

            <div className="table-floor__room-body">
              {orderRailOpen ? (
                <aside
                  className={`table-floor__order-rail${railProduct ? ' has-config' : ''}`}
                  aria-label="Yemek ekle"
                >
                  <header className="table-floor__order-rail-head">
                    <div>
                      <p>Sipariş ekle</p>
                      <h3>
                        {railStep === 'categories'
                          ? 'Kategoriler'
                          : catalogGroups.find((g) => g.id === railCategoryId)?.name || 'Ürünler'}
                      </h3>
                    </div>
                    <div className="table-floor__order-rail-tools">
                      <button
                        type="button"
                        className={`table-floor__icon-btn is-tiny${orderRailPinned ? ' is-active' : ''}`}
                        title={orderRailPinned ? 'Sabitlemeyi kaldır' : 'Paneli sabitle'}
                        aria-label={orderRailPinned ? 'Sabitlemeyi kaldır' : 'Paneli sabitle'}
                        onClick={toggleOrderRailPin}
                      >
                        {orderRailPinned ? (
                          <PinOff className="w-3.5 h-3.5" />
                        ) : (
                          <Pin className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {!orderRailPinned ? (
                        <button
                          type="button"
                          className="table-floor__icon-btn is-tiny"
                          aria-label="Kapat"
                          onClick={closeOrderRail}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </header>
                  {railStep === 'products' ? (
                    <button
                      type="button"
                      className="table-floor__order-rail-back"
                      onClick={() => {
                        setRailStep('categories');
                        setRailCategoryId(null);
                        setRailProduct(null);
                      }}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Kategoriler
                    </button>
                  ) : null}
                  <div className="table-floor__order-rail-body">
                    {railStep === 'categories' ? (
                      <div className="table-floor__order-rail-cats">
                        {catalogGroups.length === 0 ? (
                          <p className="table-floor__hint">Ürün yok.</p>
                        ) : (
                          catalogGroups.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              className="table-floor__order-rail-cat"
                              onClick={() => pickRailCategory(g.id)}
                            >
                              <span>{g.name}</span>
                              <em>{g.count}</em>
                            </button>
                          ))
                        )}
                      </div>
                    ) : (
                      <div
                        className={`table-floor__order-rail-split${
                          railProduct ? ' has-config' : ''
                        }`}
                      >
                        <div className="table-floor__order-rail-products">
                          {railProducts.length === 0 ? (
                            <p className="table-floor__hint">Bu kategoride ürün yok.</p>
                          ) : (
                            railProducts.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className={`table-floor__order-rail-product${
                                  railProduct?.id === p.id ? ' is-on' : ''
                                }`}
                                onClick={() => pickRailProduct(p)}
                              >
                                <strong>{p.name}</strong>
                                <span>{formatMoney(p.price)}</span>
                              </button>
                            ))
                          )}
                        </div>
                        {railProduct ? (
                          <div className="table-floor__order-rail-config">
                            <h4>{railProduct.name}</h4>
                            {(railProduct.optionGroups || []).map((g) => {
                              const picks = railSelections[g.id] || [];
                              const blocked = blockedOptionIds(
                                railProduct.optionGroups || [],
                                railSelections
                              );
                              const activeOpts = g.options.filter((o) => o.isActive !== false);
                              if (g.type === 'single') {
                                const visible = activeOpts.filter(
                                  (o) => !blocked.has(o.id) || picks[0]?.optionId === o.id
                                );
                                return (
                                  <label key={g.id} className="table-floor__field">
                                    <span>
                                      {g.name}
                                      {g.required ? ' *' : ''}
                                    </span>
                                    <select
                                      className="table-floor__input"
                                      value={picks[0]?.optionId || ''}
                                      onChange={(e) => {
                                        const optionId = e.target.value;
                                        const next = { ...railSelections };
                                        if (!optionId) delete next[g.id];
                                        else next[g.id] = [{ optionId, qty: 1 }];
                                        setRailOptionSelections(next);
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
                                  <div key={g.id} className="table-floor__order-rail-choice">
                                    <span>
                                      {g.name}
                                      {g.required ? ' *' : ''}
                                    </span>
                                    <div className="table-floor__order-rail-chips">
                                      {visible.map((o) => {
                                        const on = picks.some((x) => x.optionId === o.id);
                                        return (
                                          <button
                                            key={o.id}
                                            type="button"
                                            className={on ? 'is-on' : undefined}
                                            onClick={() => {
                                              const nextPicks = on
                                                ? picks.filter((x) => x.optionId !== o.id)
                                                : [...picks, { optionId: o.id, qty: 1 }];
                                              const next = { ...railSelections };
                                              if (nextPicks.length) next[g.id] = nextPicks;
                                              else delete next[g.id];
                                              setRailOptionSelections(next);
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
                              const groupQty = groupSelectedQty(railSelections, g.id);
                              const maxQty = effectiveMultiMaxTotalQty(
                                railProduct.optionGroups || [],
                                railSelections,
                                g
                              );
                              const atMax = maxQty > 0 && groupQty >= maxQty;
                              const visible = activeOpts.filter((o) => !blocked.has(o.id));
                              return (
                                <div key={g.id} className="table-floor__order-rail-multi">
                                  <span>
                                    {g.name}
                                    {g.required ? ' *' : ''}
                                    {maxQty > 0 ? ` · max ${maxQty}` : ''}
                                  </span>
                                  {visible.map((o) => {
                                    const cur = picks.find((x) => x.optionId === o.id);
                                    const q = cur?.qty || 0;
                                    return (
                                      <div key={o.id} className="table-floor__order-rail-multi-row">
                                        <div>
                                          <strong>{o.name}</strong>
                                          <em>
                                            {o.price > 0
                                              ? `+${formatMoney(o.price)}`
                                              : 'Ücretsiz'}
                                          </em>
                                        </div>
                                        <div className="table-floor-modal__qty table-floor-modal__qty--sm">
                                          <button
                                            type="button"
                                            disabled={q <= 0}
                                            onClick={() => {
                                              const nextPicks = picks.filter(
                                                (x) => x.optionId !== o.id
                                              );
                                              if (q > 1)
                                                nextPicks.push({ optionId: o.id, qty: q - 1 });
                                              const next = { ...railSelections };
                                              if (nextPicks.length) next[g.id] = nextPicks;
                                              else delete next[g.id];
                                              setRailOptionSelections(next);
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
                                              const nextPicks = picks.filter(
                                                (x) => x.optionId !== o.id
                                              );
                                              nextPicks.push({ optionId: o.id, qty: q + 1 });
                                              setRailOptionSelections({
                                                ...railSelections,
                                                [g.id]: nextPicks,
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
                            <div className="table-floor__order-rail-qty">
                              <span>Adet</span>
                              <div className="table-floor-modal__qty">
                                <button
                                  type="button"
                                  onClick={() => setRailQty((q) => Math.max(1, q - 1))}
                                >
                                  −
                                </button>
                                <em>{railQty}</em>
                                <button
                                  type="button"
                                  onClick={() => setRailQty((q) => Math.min(99, q + 1))}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                            <p className="table-floor__order-rail-price">
                              Birim <strong>{formatMoney(railPreviewUnit)}</strong>
                            </p>
                            <button
                              type="button"
                              className="table-floor__primary"
                              disabled={orderSaving}
                              onClick={() => void addRailProduct()}
                            >
                              {orderSaving ? 'Ekleniyor…' : 'Ekle'}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </aside>
              ) : null}

              <div className="table-floor__room-main">
            {selected.status === 'merged' ? (
              <div className="table-floor__merge-callout">
                <p className="table-floor__merge-callout-kicker">Birleşmiş masa</p>
                <p className="table-floor__merge-callout-copy">
                  <strong>{selected.name}</strong>
                  {mergePrimaryTarget ? (
                    <>
                      , <strong>{mergePrimaryTarget.groupName}</strong> grubundaki{' '}
                      <strong>{mergePrimaryTarget.table.name}</strong> masasına katıldı.
                    </>
                  ) : (
                    <> ana masaya katıldı.</>
                  )}{' '}
                  Sipariş ve hesap ana masadan yönetilir.
                </p>
                {mergePrimaryTarget ? (
                  <button
                    type="button"
                    className="table-floor__merge-callout-link"
                    onClick={() =>
                      handleTableClick(mergePrimaryTarget.table, mergePrimaryTarget.groupId)
                    }
                  >
                    <span>
                      {mergePrimaryTarget.groupName} · {mergePrimaryTarget.table.name}
                    </span>
                    <em>
                      Ana masaya git
                      <ArrowRight className="w-3.5 h-3.5" />
                    </em>
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <div className="table-floor__stats">
                  <div className="table-floor__bill-card">
                    <div className="table-floor__bill-metrics">
                      <div>
                        <span>Toplam</span>
                        <strong>{formatMoney(liveTotal)}</strong>
                      </div>
                      {selected.occupied && selected.status === 'open' ? (
                        <>
                          <div>
                            <span>Ödenen</span>
                            <strong>{formatMoney(livePaidTotal)}</strong>
                          </div>
                          <div>
                            <span>Kalan</span>
                            <strong className={liveRemaining > 0.009 ? 'is-warn' : 'is-ok'}>
                              {formatMoney(liveRemaining)}
                            </strong>
                          </div>
                        </>
                      ) : selected.status === 'reserved' ? (
                        <div>
                          <span>Beklenen</span>
                          <strong>{formatExpectedAt(selected.expectedAt)}</strong>
                        </div>
                      ) : null}
                    </div>
                    {selected.status !== 'merged' ? (
                      <div className="table-floor__bill-tools">
                        {selected.reservationNote?.trim() && selected.status === 'open' ? (
                          <button
                            type="button"
                            className={`table-floor__icon-btn is-compact${notePanelOpen ? ' is-active' : ''}`}
                            title="Rezervasyon notu"
                            aria-label="Rezervasyon notu"
                            onClick={() => {
                              setNotePanelOpen((v) => !v);
                              setFeePanelOpen(false);
                              setWaiterPopOpen(false);
                            }}
                          >
                            <NotebookPen className="w-4 h-4" />
                          </button>
                        ) : null}
                        <div className="table-floor__fee-mini-wrap">
                          <button
                            type="button"
                            className={`table-floor__bill-tool${
                              feePanelOpen || selected.seatingFee?.enabled ? ' is-on' : ''
                            }`}
                            title="Oturma ücreti"
                            aria-expanded={feePanelOpen}
                            onClick={() => {
                              setFeePanelOpen((v) => !v);
                              setWaiterPopOpen(false);
                              setNotePanelOpen(false);
                            }}
                          >
                            <Timer className="w-3.5 h-3.5" />
                            Ücret
                          </button>
                          {feePanelOpen ? (
                            <div className="table-floor__pop is-mini is-fee-pop">
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
                                Aktif
                              </label>
                              <div className="table-floor__fee-row is-mini">
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
                                  onChange={(e) =>
                                    setFeeUnit(e.target.value as 'minute' | 'hour')
                                  }
                                >
                                  <option value="minute">/dk</option>
                                  <option value="hour">/saat</option>
                                </select>
                              </div>
                              <button
                                type="button"
                                className="table-floor__secondary is-mini"
                                disabled={busy}
                                onClick={() => void saveSeatingFee()}
                              >
                                Kaydet
                              </button>
                            </div>
                          ) : null}
                        </div>
                        {selected.occupied && selected.status === 'open' ? (
                          <div className="table-floor__waiter-wrap">
                            <button
                              type="button"
                              className={`table-floor__bill-tool${waiterPopOpen ? ' is-on' : ''}${
                                selected.meta?.waiterName ? ' has-waiter' : ''
                              }`}
                              aria-expanded={waiterPopOpen}
                              disabled={metaBusy}
                              onClick={() => {
                                setWaiterPopOpen((v) => !v);
                                setFeePanelOpen(false);
                                setNotePanelOpen(false);
                              }}
                            >
                              <HandHelping className="w-3.5 h-3.5" />
                              {selected.meta?.waiterName || 'Garson'}
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            {waiterPopOpen ? (
                              <div
                                className="table-floor__waiter-pop"
                                role="listbox"
                                aria-label="Garson seç"
                              >
                                <button
                                  type="button"
                                  role="option"
                                  className={!selected.meta?.waiterUserId ? 'is-on' : undefined}
                                  onClick={() => {
                                    void saveSessionMeta({
                                      waiterUserId: null,
                                      waiterName: null,
                                    });
                                    setWaiterPopOpen(false);
                                  }}
                                >
                                  Atanmadı
                                </button>
                                {staffUsers.map((u) => (
                                  <button
                                    key={u.id}
                                    type="button"
                                    role="option"
                                    className={
                                      selected.meta?.waiterUserId === u.id ? 'is-on' : undefined
                                    }
                                    onClick={() => {
                                      void saveSessionMeta({
                                        waiterUserId: u.id,
                                        waiterName: u.fullName,
                                      });
                                      setWaiterPopOpen(false);
                                    }}
                                  >
                                    {u.fullName}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                {!selected.occupied || selected.status === 'reserved' ? (
                  <div className="table-floor__tool is-reserve-compact">
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
                      rows={2}
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
                    <h3>{payMode ? 'Ödeme seçimi' : 'Siparişler'}</h3>
                    {payMode ? (
                      <div className="table-floor__pay-tools">
                        <button
                          type="button"
                          className="table-floor__text-btn"
                          onClick={() => {
                            const next: Record<string, number> = {};
                            for (const o of selected.orders) {
                              if (!o.settledAt) next[o.id] = o.qty;
                            }
                            setPayUnits(next);
                            setPayIncludeSeat(seatLeft > 0.009);
                          }}
                        >
                          Tümünü seç
                        </button>
                        <button
                          type="button"
                          className="table-floor__text-btn"
                          onClick={() => {
                            setPayUnits({});
                            setPayIncludeSeat(false);
                          }}
                        >
                          Temizle
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={`table-floor__text-btn${orderRailOpen ? ' is-on' : ''}`}
                        onClick={() => {
                          if (orderRailOpen && !orderRailPinned) closeOrderRail();
                          else void openOrderRail();
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        Yemek ekle
                      </button>
                    )}
                  </div>
                  {selected.orders.length === 0 && liveSeatingFee <= 0 ? (
                    <p className="table-floor__hint">Henüz sipariş yok.</p>
                  ) : (
                    <ul className={payMode ? 'is-pay-mode' : undefined}>
                      {selected.orders.map((o) => {
                        const opted = orderOptionsLine(o);
                        const units = payUnits[o.id] || 0;
                        const checked = units > 0;
                        const canPick = payMode && !o.settledAt;
                        return (
                          <li
                            key={o.id}
                            className={`${o.settledAt ? 'is-settled' : ''}${
                              canPick && checked ? ' is-pay-on' : ''
                            }${canPick ? ' is-pay-pick' : ''}`.trim()}
                            onClick={() => {
                              if (canPick) {
                                togglePayItem(o.id, o.qty);
                                return;
                              }
                              if (selected.status === 'open' && !o.settledAt && !payMode) {
                                openOrderEdit(o);
                              }
                            }}
                            title={
                              o.settledAt
                                ? 'Ödendi'
                                : payMode
                                  ? 'Birim seç (adet)'
                                  : selected.status === 'open'
                                    ? 'Düzenlemek için dokun'
                                    : undefined
                            }
                          >
                            {canPick ? (
                              <span
                                className={`table-floor__pay-check${checked ? ' is-on' : ''}`}
                                aria-hidden
                              >
                                {checked ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : null}
                              </span>
                            ) : null}
                            <div className="table-floor__order-body">
                              <strong>
                                {o.qty}× {o.name}
                                {o.settledAt ? ' · ödendi' : ''}
                                {canPick && checked ? (
                                  <span className="table-floor__pay-units">
                                    {units}/{o.qty}
                                  </span>
                                ) : null}
                              </strong>
                              <span>
                                {o.source === 'admin' ? 'Admin' : 'Müşteri'}
                                {formatAdjLabel(o) ? ` · ${formatAdjLabel(o)}` : ''}
                              </span>
                              {opted ? (
                                <em className="table-floor__order-note">{opted}</em>
                              ) : null}
                            </div>
                            <div className="table-floor__order-side">
                              <em className="table-floor__order-price">
                                {formatMoney(
                                  canPick && units > 0
                                    ? lineTotal({ ...o, qty: units })
                                    : lineTotal(o)
                                )}
                              </em>
                              {!payMode && selected.status === 'open' && !o.settledAt ? (
                                <div className="table-floor__order-actions">
                                  <button
                                    type="button"
                                    className="table-floor__icon-btn is-tiny"
                                    title="Satırı çoğalt (aynı ürün ayrı satır)"
                                    disabled={busy}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void orderItemAction(o.id, 'copy');
                                    }}
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    className="table-floor__icon-btn is-tiny is-danger"
                                    title="Satırı sil"
                                    disabled={busy}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void orderItemAction(o.id, 'remove');
                                    }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                      {liveSeatingFee > 0 ? (
                        <li
                          className={`is-fee${
                            payMode && seatLeft > 0.009
                              ? payIncludeSeat
                                ? ' is-pay-pick is-pay-on'
                                : ' is-pay-pick'
                              : ''
                          }${seatLeft <= 0.009 ? ' is-settled' : ''}`}
                          onClick={() => {
                            if (payMode && seatLeft > 0.009) {
                              setPayIncludeSeat((v) => !v);
                            }
                          }}
                        >
                          {payMode && seatLeft > 0.009 ? (
                            <span
                              className={`table-floor__pay-check${payIncludeSeat ? ' is-on' : ''}`}
                              aria-hidden
                            >
                              {payIncludeSeat ? (
                                <Check className="w-3.5 h-3.5" strokeWidth={3} />
                              ) : null}
                            </span>
                          ) : null}
                          <div className="table-floor__order-body">
                            <strong>
                              Oturma ücreti
                              {seatLeft <= 0.009 ? ' · ödendi' : ''}
                            </strong>
                            <span>
                              {selected.seatingFee?.rate}
                              {selected.seatingFee?.unit === 'hour' ? ' ₺/saat' : ' ₺/dk'} ·
                              birikiyor
                            </span>
                          </div>
                          <em className="table-floor__order-price">
                            {formatMoney(payMode ? seatLeft || liveSeatingFee : liveSeatingFee)}
                          </em>
                        </li>
                      ) : null}
                    </ul>
                  )}
                </div>

                <div className="table-floor__drawer-actions">
                  {selected.occupied && selected.status === 'open' ? (
                    <div className="table-floor__access-code">
                      <div className="table-floor__access-code-row">
                        <div
                          className={`table-floor__input table-floor__access-code-field${
                            selected.accessCode ? ' has-code' : ''
                          }`}
                          aria-live="polite"
                        >
                          {selected.accessCode || 'Erişim kodu yok'}
                        </div>
                        {selected.accessCode && selected.codeExpiresAt ? (
                          (() => {
                            const cd = formatCodeCountdown(selected.codeExpiresAt, now);
                            return (
                              <div className="table-floor__access-code-ttl">
                                {codeTtlMenuOpen ? (
                                  <div
                                    className="table-floor__access-code-ttl-menu"
                                    role="group"
                                    aria-label="Kod süresini ayarla"
                                  >
                                    {(
                                      [
                                        { d: 10, label: '+10dk' },
                                        { d: 30, label: '+30dk' },
                                        { d: -10, label: '−10dk' },
                                        { d: -30, label: '−30dk' },
                                      ] as const
                                    ).map((b) => (
                                      <button
                                        key={b.d}
                                        type="button"
                                        disabled={busy}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void adjustCodeTtl(selected, b.d);
                                        }}
                                      >
                                        {b.label}
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                                <button
                                  type="button"
                                  className={`table-floor__access-code-countdown${
                                    cd.expired ? ' is-expired' : cd.urgent ? ' is-urgent' : ''
                                  }${codeTtlMenuOpen ? ' is-open' : ''}`}
                                  title={
                                    cd.expired
                                      ? 'Kod süresi doldu — tıkla süre ekle'
                                      : 'Koda kalan süre — tıkla ayarla'
                                  }
                                  aria-expanded={codeTtlMenuOpen}
                                  onClick={() => setCodeTtlMenuOpen((v) => !v)}
                                >
                                  <Timer className="w-3.5 h-3.5" />
                                  {cd.expired ? '00:00' : cd.label}
                                </button>
                              </div>
                            );
                          })()
                        ) : null}
                        {selected.accessCode && selected.codeStatus === 'pending' ? (
                          <button
                            type="button"
                            className="table-floor__access-code-approve"
                            disabled={busy}
                            title="Kodu onayla (müşteri girmiş gibi)"
                            aria-label="Kodu onayla"
                            onClick={() => void approveTableCode(selected)}
                          >
                            <Check className="w-4 h-4" strokeWidth={2.75} />
                          </button>
                        ) : null}
                        {selected.accessCode && selected.codeStatus === 'verified' ? (
                          <div
                            className="table-floor__access-code-approve is-done"
                            title="Kod onaylandı"
                            aria-label="Kod onaylandı"
                          >
                            <Check className="w-4 h-4" strokeWidth={2.75} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {selected.occupied && selected.status === 'open' ? (
                    <div className="table-floor__action-grid">
                      <button
                        type="button"
                        className="table-floor__secondary"
                        onClick={() => {
                          setReceiptFocus(null);
                          setBillOpen(true);
                        }}
                      >
                        Hesap yazdır
                      </button>
                      <button
                        type="button"
                        className="table-floor__secondary"
                        onClick={() => setKitchenOpen(true)}
                      >
                        Mutfak fişi
                      </button>
                      <button
                        type="button"
                        className={`table-floor__primary${payMode ? ' is-active-pay' : ''}`}
                        disabled={busy}
                        onClick={() => (payMode ? exitPayMode() : enterPayMode())}
                      >
                        {payMode ? 'Ödemeyi kapat' : 'Ödeme al'}
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
                  ) : selected.occupied && selected.status === 'open' ? (
                    <button
                      type="button"
                      className="table-floor__danger"
                      disabled={busy}
                      onClick={() =>
                        void closeTable(selected, liveRemaining <= 0.009)
                      }
                    >
                      {liveRemaining <= 0.009
                        ? 'Masayı kapat (ödendi)'
                        : 'Masayı kapat / boşalt'}
                    </button>
                  ) : null}
                </div>
              </>
            )}
              </div>

              {payMode ? (
                <aside className="table-floor__pay-rail" aria-label="Ödeme özeti">
                  <header className="table-floor__pay-rail-head">
                    <div>
                      <p>Ödeme özeti</p>
                      <h3>{selected.name}</h3>
                    </div>
                    <button
                      type="button"
                      className="table-floor__icon-btn is-tiny"
                      aria-label="Ödemeyi kapat"
                      onClick={exitPayMode}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </header>
                  <div className="table-floor__pay-rail-body">
                    <div className="table-floor__pay-dock-stats">
                      <div>
                        <span>Seçilen</span>
                        <strong>{formatMoney(paySelectedAmount)}</strong>
                      </div>
                      <div>
                        <span>Kalan</span>
                        <strong
                          className={
                            liveRemaining - paySelectedAmount > 0.009 ? 'is-warn' : 'is-ok'
                          }
                        >
                          {formatMoney(
                            Math.max(
                              0,
                              Math.round((liveRemaining - paySelectedAmount) * 100) / 100
                            )
                          )}
                        </strong>
                      </div>
                    </div>
                    <div
                      className="table-floor__pay-dock-methods"
                      role="group"
                      aria-label="Ödeme yöntemi"
                    >
                      {(
                        [
                          ['cash', 'Nakit'],
                          ['card', 'Kart'],
                          ['mixed', 'Karışık'],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          className={payMethod === id ? 'is-on' : undefined}
                          onClick={() => setPayMethod(id)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {liveDiscountAmount > 0.009 ? (
                      <p className="table-floor__hint" style={{ margin: 0 }}>
                        Hesap indirimi: −{formatMoney(liveDiscountAmount)} (tümü seçiliyse
                        uygulanır)
                      </p>
                    ) : null}
                    <div className="table-floor__fee-row">
                      <label className="table-floor__field" style={{ flex: 1, margin: 0 }}>
                        <span>Bahşiş</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="table-floor__input"
                          value={payTip}
                          onChange={(e) => setPayTip(e.target.value)}
                          placeholder="0"
                        />
                      </label>
                      {payMethod === 'cash' ? (
                        <label className="table-floor__field" style={{ flex: 1, margin: 0 }}>
                          <span>Alınan</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="table-floor__input"
                            value={payTendered}
                            onChange={(e) => setPayTendered(e.target.value)}
                            placeholder={String(paySelectedAmount + payTipAmt || '')}
                          />
                        </label>
                      ) : null}
                    </div>
                    {payMethod === 'cash' && payTenderedAmt > 0 ? (
                      <div className="table-floor__pay-dock-stats">
                        <div>
                          <span>Para üstü</span>
                          <strong className="is-ok">{formatMoney(payChangeAmt)}</strong>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <footer className="table-floor__pay-rail-foot">
                    <div className="table-floor__pay-dock-row">
                      <button
                        type="button"
                        className="table-floor__pay-dock-btn"
                        disabled={paySelectedAmount <= 0.009}
                        onClick={() => {
                          const lines = selected.orders
                            .filter((o) => (payUnits[o.id] || 0) > 0)
                            .map((o) => ({
                              ...o,
                              qty: payUnits[o.id] || o.qty,
                            }));
                          const seat = payIncludeSeat ? seatLeft : 0;
                          setReceiptFocus({
                            orders: lines,
                            seatingFee: seat,
                            total: paySelectedAmount,
                            paidTotal: paySelectedAmount,
                            remaining: Math.max(
                              0,
                              Math.round((liveRemaining - paySelectedAmount) * 100) / 100
                            ),
                            methodLabel: methodLabel(payMethod),
                            docTitle: 'ÖDEME FİŞİ',
                          });
                          setBillOpen(true);
                        }}
                      >
                        Fiş
                      </button>
                      <button
                        type="button"
                        className="table-floor__pay-dock-btn"
                        onClick={exitPayMode}
                      >
                        Vazgeç
                      </button>
                    </div>
                    <button
                      type="button"
                      className="table-floor__pay-dock-submit"
                      disabled={busy || paySelectedAmount <= 0.009}
                      onClick={() => void submitPayment()}
                    >
                      {busy ? '…' : 'Ödemeyi kaydet'}
                    </button>
                  </footer>
                </aside>
              ) : null}
            </div>
          </>
        ) : null}
      </aside>
      </>
      )}

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
          onClose={() => {
            setBillOpen(false);
            setReceiptFocus(null);
          }}
          restaurantName={data?.restaurant?.name || user?.restaurant?.name || 'Restoran'}
          logoUrl={user?.restaurant?.logoUrl}
          tableName={selected.name}
          guestName={selected.guestName}
          openedAt={selected.openedAt}
          orders={(receiptFocus?.orders || selected.orders).map((o) => ({
            id: o.id,
            name: o.name,
            qty: o.qty,
            price: o.price,
            note: undefined,
            freeNote: (o.freeNote || (!o.selections?.length ? o.note : '') || '').trim() || undefined,
            selections: o.selections,
            adjustmentType: o.adjustmentType,
            adjustmentMode: o.adjustmentMode,
            adjustmentValue: o.adjustmentValue,
            createdAt: o.createdAt,
          }))}
          seatingFee={receiptFocus?.seatingFee ?? liveSeatingFee}
          total={receiptFocus?.total ?? liveTotal}
          paidTotal={receiptFocus?.paidTotal ?? livePaidTotal}
          remaining={receiptFocus?.remaining ?? liveRemaining}
          paymentMethodLabel={receiptFocus?.methodLabel}
          docTitle={receiptFocus?.docTitle || 'HESAP FİŞİ'}
        />
      ) : null}

      {selected && kitchenOpen ? (
        <KitchenTicketModal
          open={kitchenOpen}
          restaurantName={data?.restaurant?.name || user?.restaurant?.name || 'Restoran'}
          tableName={selected.name}
          lines={selected.orders
            .filter((o) => !o.settledAt)
            .map((o) => ({
              id: o.id,
              name: o.name,
              qty: o.qty,
              note: o.note,
              freeNote: o.freeNote,
              selections: o.selections,
              createdAt: o.createdAt,
            }))}
          onClose={() => setKitchenOpen(false)}
        />
      ) : null}

    </div>
  );
}
