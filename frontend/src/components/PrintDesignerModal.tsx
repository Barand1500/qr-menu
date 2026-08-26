import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  ArrowRight,
  Award,
  Beer,
  Cake,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Coffee,
  CupSoda,
  Eye,
  EyeOff,
  Flame,
  FolderOpen,
  Heart,
  IceCream,
  Layers,
  Leaf,
  Lock,
  LockOpen,
  MapPin,
  Martini,
  Milk,
  Phone,
  Pizza,
  Plus,
  Printer,
  RotateCcw,
  RotateCw,
  Sandwich,
  Scissors,
  Soup,
  Sparkles,
  Star,
  Store,
  Trash2,
  Type,
  UtensilsCrossed,
  Wifi,
  Wine,
  X,
  type LucideIcon,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui';

type LayerKind = 'title' | 'subtitle' | 'url' | 'custom' | 'qr' | 'icon';

type CanvasLayer = {
  id: string;
  kind: LayerKind;
  text: string;
  iconName?: string;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  /** text = font px, qr/icon = box px */
  size: number;
  /** 0 yatay, 90 / 270 dikey */
  rotate: number;
  /** çizim sırası — QR her zaman en üstte */
  z: number;
};

type CutBox = { x: number; y: number; w: number; h: number };

type PrintLayout = {
  showCutMarks: boolean;
  cut: CutBox;
  layers: CanvasLayer[];
};

type IconDef = { name: string; label: string; Icon: LucideIcon };
type IconCategory = { id: string; label: string; items: IconDef[] };

const PRINT_LAYOUT_KEY = 'menu-qr-print-layout-v1';

const ICON_CATEGORIES: IconCategory[] = [
  {
    id: 'yemek',
    label: 'Yemek',
    items: [
      { name: 'utensils', label: 'Çatal', Icon: UtensilsCrossed },
      { name: 'pizza', label: 'Pizza', Icon: Pizza },
      { name: 'soup', label: 'Çorba', Icon: Soup },
      { name: 'sandwich', label: 'Sandviç', Icon: Sandwich },
      { name: 'cake', label: 'Pasta', Icon: Cake },
      { name: 'icecream', label: 'Dondurma', Icon: IceCream },
    ],
  },
  {
    id: 'icecek',
    label: 'İçecek',
    items: [
      { name: 'coffee', label: 'Kahve', Icon: Coffee },
      { name: 'wine', label: 'Şarap', Icon: Wine },
      { name: 'beer', label: 'Bira', Icon: Beer },
      { name: 'soda', label: 'Soda', Icon: CupSoda },
      { name: 'martini', label: 'Kokteyl', Icon: Martini },
      { name: 'milk', label: 'Süt', Icon: Milk },
    ],
  },
  {
    id: 'mekan',
    label: 'Mekan',
    items: [
      { name: 'store', label: 'Mağaza', Icon: Store },
      { name: 'wifi', label: 'Wi‑Fi', Icon: Wifi },
      { name: 'clock', label: 'Saat', Icon: Clock },
      { name: 'map', label: 'Konum', Icon: MapPin },
      { name: 'phone', label: 'Telefon', Icon: Phone },
      { name: 'heart', label: 'Kalp', Icon: Heart },
    ],
  },
  {
    id: 'sembol',
    label: 'Sembol',
    items: [
      { name: 'star', label: 'Yıldız', Icon: Star },
      { name: 'check', label: 'Onay', Icon: Check },
      { name: 'sparkles', label: 'Parıltı', Icon: Sparkles },
      { name: 'leaf', label: 'Yaprak', Icon: Leaf },
      { name: 'flame', label: 'Ateş', Icon: Flame },
      { name: 'award', label: 'Ödül', Icon: Award },
      { name: 'arrow', label: 'Ok', Icon: ArrowRight },
    ],
  },
];

const ICON_MAP = Object.fromEntries(
  ICON_CATEGORIES.flatMap((c) => c.items.map((i) => [i.name, i]))
) as Record<string, IconDef>;

function buildDefaultLayers(
  title: string,
  subtitle: string,
  url: string,
  qrSize: number
): CanvasLayer[] {
  return [
    {
      id: 'title',
      kind: 'title',
      text: title,
      visible: true,
      locked: false,
      x: 50,
      y: 12,
      size: 22,
      rotate: 0,
      z: 2,
    },
    {
      id: 'subtitle',
      kind: 'subtitle',
      text: subtitle,
      visible: !!subtitle,
      locked: false,
      x: 50,
      y: 20,
      size: 14,
      rotate: 0,
      z: 3,
    },
    {
      id: 'url',
      kind: 'url',
      text: url,
      visible: true,
      locked: false,
      x: 50,
      y: 90,
      size: 11,
      rotate: 0,
      z: 1,
    },
    {
      id: 'qr',
      kind: 'qr',
      text: '',
      visible: true,
      locked: false,
      x: 50,
      y: 52,
      size: qrSize,
      rotate: 0,
      z: 1000,
    },
  ];
}

function nextZ(layers: CanvasLayer[]) {
  const max = layers
    .filter((l) => l.kind !== 'qr')
    .reduce((m, l) => Math.max(m, l.z), 0);
  return max + 1;
}

function layersForRender(layers: CanvasLayer[]) {
  const others = layers
    .filter((l) => l.kind !== 'qr')
    .slice()
    .sort((a, b) => a.z - b.z);
  const qr = layers.filter((l) => l.kind === 'qr');
  return [...others, ...qr];
}

function layersForPanel(layers: CanvasLayer[]) {
  const others = layers
    .filter((l) => l.kind !== 'qr')
    .slice()
    .sort((a, b) => b.z - a.z);
  const qr = layers.filter((l) => l.kind === 'qr');
  return [...qr, ...others];
}

function layerLabel(layer: CanvasLayer) {
  if (layer.kind === 'qr') return 'QR kod';
  if (layer.kind === 'title') return layer.text || 'Başlık';
  if (layer.kind === 'subtitle') return layer.text || 'Alt yazı';
  if (layer.kind === 'url') return 'Link';
  if (layer.kind === 'icon') {
    return ICON_MAP[layer.iconName || '']?.label || 'İkon';
  }
  return layer.text || 'Yazı';
}

function defaultLayout(
  title: string,
  subtitle: string,
  url: string,
  qrSize: number
): PrintLayout {
  return {
    showCutMarks: true,
    cut: { x: 5, y: 5, w: 90, h: 90 },
    layers: buildDefaultLayers(title, subtitle, url, qrSize),
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

type DragState = {
  id: string;
  mode: 'move' | 'resize' | 'cut-move' | 'cut-tl' | 'cut-tr' | 'cut-bl' | 'cut-br';
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  originSize: number;
  originCut?: CutBox;
  startDist: number;
};

interface PrintDesignerModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  url: string;
  fg: string;
  bg: string;
  logo?: string;
  size?: number;
  frameNode?: ReactNode;
}

export default function PrintDesignerModal({
  open,
  onClose,
  title,
  subtitle,
  url,
  fg,
  bg,
  logo,
  size = 200,
}: PrintDesignerModalProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState(() =>
    defaultLayout(title, subtitle, url, size)
  );
  const [selected, setSelected] = useState<string | 'cut' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [iconPanel, setIconPanel] = useState(false);
  const [iconCat, setIconCat] = useState(ICON_CATEGORIES[0].id);
  const [hasSavedLayout, setHasSavedLayout] = useState(false);
  const seq = useRef(1);
  const openedAtRef = useRef(0);
  const dragRef = useRef<DragState | null>(null);
  const rafRef = useRef(0);
  const pendingRef = useRef<PointerEvent | null>(null);

  useEffect(() => {
    if (!open) return;
    openedAtRef.current = Date.now();
    seq.current = 1;
    setLayout(defaultLayout(title, subtitle, url, size));
    setSelected(null);
    setEditingId(null);
    setIconPanel(false);
    try {
      setHasSavedLayout(!!localStorage.getItem(PRINT_LAYOUT_KEY));
    } catch {
      setHasSavedLayout(false);
    }
  }, [open, title, subtitle, url, size]);

  // Düzen değişince otomatik kaydet (açılıştaki varsayılanı ezmesin)
  useEffect(() => {
    if (!open) return;
    if (Date.now() - openedAtRef.current < 700) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(
          PRINT_LAYOUT_KEY,
          JSON.stringify({ savedAt: Date.now(), layout })
        );
        setHasSavedLayout(true);
      } catch {
        /* ignore */
      }
    }, 450);
    return () => window.clearTimeout(t);
  }, [layout, open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        if (editingId) setEditingId(null);
        else if (iconPanel) setIconPanel(false);
        else onClose();
        return;
      }

      if (typing || editingId) return;

      if (e.key === '1') {
        e.preventDefault();
        addCustomText();
      } else if (e.key === '2') {
        e.preventDefault();
        setIconPanel((v) => !v);
      } else if (e.key === '0') {
        e.preventDefault();
        resetLayout();
      } else if (e.key === 'r' || e.key === 'R') {
        if (selected && selected !== 'cut') {
          e.preventDefault();
          cycleRotate(selected, e.shiftKey ? -1 : 1);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, editingId, iconPanel, selected, title, subtitle, url, size]);

  useEffect(() => {
    function applyMove(e: PointerEvent) {
      const drag = dragRef.current;
      const canvas = canvasRef.current;
      if (!drag || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dx = ((e.clientX - drag.startX) / rect.width) * 100;
      const dy = ((e.clientY - drag.startY) / rect.height) * 100;

      if (drag.mode.startsWith('cut-')) {
        const o = drag.originCut!;
        if (drag.mode === 'cut-move') {
          setLayout((prev) => ({
            ...prev,
            cut: {
              ...prev.cut,
              x: clamp(o.x + dx, 0, 100 - o.w),
              y: clamp(o.y + dy, 0, 100 - o.h),
            },
          }));
          return;
        }
        if (drag.mode === 'cut-br') {
          setLayout((prev) => ({
            ...prev,
            cut: {
              ...prev.cut,
              w: clamp(o.w + dx, 30, 100 - o.x),
              h: clamp(o.h + dy, 30, 100 - o.y),
            },
          }));
          return;
        }
        if (drag.mode === 'cut-tl') {
          const nx = clamp(o.x + dx, 0, o.x + o.w - 30);
          const ny = clamp(o.y + dy, 0, o.y + o.h - 30);
          setLayout((prev) => ({
            ...prev,
            cut: { x: nx, y: ny, w: o.w + (o.x - nx), h: o.h + (o.y - ny) },
          }));
          return;
        }
        if (drag.mode === 'cut-tr') {
          const ny = clamp(o.y + dy, 0, o.y + o.h - 30);
          setLayout((prev) => ({
            ...prev,
            cut: {
              x: o.x,
              y: ny,
              w: clamp(o.w + dx, 30, 100 - o.x),
              h: o.h + (o.y - ny),
            },
          }));
          return;
        }
        if (drag.mode === 'cut-bl') {
          const nx = clamp(o.x + dx, 0, o.x + o.w - 30);
          setLayout((prev) => ({
            ...prev,
            cut: {
              x: nx,
              y: o.y,
              w: o.w + (o.x - nx),
              h: clamp(o.h + dy, 30, 100 - o.y),
            },
          }));
        }
        return;
      }

      if (drag.mode === 'move') {
        setLayout((prev) => ({
          ...prev,
          layers: prev.layers.map((layer) =>
            layer.id === drag.id
              ? {
                  ...layer,
                  x: clamp(drag.originX + dx, 5, 95),
                  y: clamp(drag.originY + dy, 5, 95),
                }
              : layer
          ),
        }));
        return;
      }

      // Smooth scale from center distance
      const cx = rect.left + (drag.originX / 100) * rect.width;
      const cy = rect.top + (drag.originY / 100) * rect.height;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      const ratio = drag.startDist > 4 ? dist / drag.startDist : 1;
      const next = clamp(Math.round(drag.originSize * ratio), 10, 280);

      setLayout((prev) => ({
        ...prev,
        layers: prev.layers.map((layer) =>
          layer.id === drag.id ? { ...layer, size: next } : layer
        ),
      }));
    }

    function onMove(e: PointerEvent) {
      pendingRef.current = e;
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        if (pendingRef.current) applyMove(pendingRef.current);
      });
    }

    function onUp() {
      dragRef.current = null;
      pendingRef.current = null;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!open) return null;

  function patchLayer(id: string, patch: Partial<CanvasLayer>) {
    setLayout((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }

  function cycleRotate(id: string, dir: 1 | -1 = 1) {
    const layer = layout.layers.find((l) => l.id === id);
    if (!layer || layer.locked || layer.kind === 'qr') return;
    const next = ((layer.rotate + dir * 90) % 360 + 360) % 360;
    patchLayer(id, { rotate: next });
  }

  function resetLayout() {
    seq.current = 1;
    setLayout(defaultLayout(title, subtitle, url, size));
    setSelected(null);
    setEditingId(null);
    setIconPanel(false);
  }

  function startLayerDrag(
    e: ReactPointerEvent,
    id: string,
    mode: 'move' | 'resize'
  ) {
    e.preventDefault();
    e.stopPropagation();
    const layer = layout.layers.find((l) => l.id === id);
    if (!layer || layer.locked) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + (layer.x / 100) * rect.width;
    const cy = rect.top + (layer.y / 100) * rect.height;
    setSelected(id);
    dragRef.current = {
      id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      originX: layer.x,
      originY: layer.y,
      originSize: layer.size,
      startDist: Math.max(8, Math.hypot(e.clientX - cx, e.clientY - cy)),
    };
  }

  function startCutDrag(
    e: ReactPointerEvent,
    mode: DragState['mode']
  ) {
    e.preventDefault();
    e.stopPropagation();
    setSelected('cut');
    dragRef.current = {
      id: 'cut',
      mode,
      startX: e.clientX,
      startY: e.clientY,
      originX: layout.cut.x,
      originY: layout.cut.y,
      originSize: 0,
      originCut: { ...layout.cut },
      startDist: 1,
    };
  }

  function removeLayer(id: string) {
    const layer = layout.layers.find((l) => l.id === id);
    if (!layer || layer.locked) return;
    if (layer.kind === 'custom' || layer.kind === 'icon') {
      setLayout((prev) => ({
        ...prev,
        layers: prev.layers.filter((l) => l.id !== id),
      }));
    } else if (layer.kind !== 'qr') {
      patchLayer(id, { visible: false });
    }
    setSelected(null);
    setEditingId(null);
  }

  function toggleLock(id: string) {
    const layer = layout.layers.find((l) => l.id === id);
    if (!layer) return;
    patchLayer(id, { locked: !layer.locked });
  }

  function addCustomText() {
    const id = `custom-${seq.current++}`;
    setLayout((prev) => ({
      ...prev,
      layers: [
        ...prev.layers,
        {
          id,
          kind: 'custom',
          text: 'Yeni yazı',
          visible: true,
          locked: false,
          x: 50,
          y: 34,
          size: 16,
          rotate: 0,
          z: nextZ(prev.layers),
        },
      ],
    }));
    setSelected(id);
    setEditingId(id);
    setIconPanel(false);
  }

  function addIcon(name: string) {
    const id = `icon-${seq.current++}`;
    setLayout((prev) => ({
      ...prev,
      layers: [
        ...prev.layers,
        {
          id,
          kind: 'icon',
          text: '',
          iconName: name,
          visible: true,
          locked: false,
          x: 50,
          y: 34,
          size: 42,
          rotate: 0,
          z: nextZ(prev.layers),
        },
      ],
    }));
    setSelected(id);
    setIconPanel(false);
  }

  function moveLayer(id: string, direction: 'up' | 'down') {
    setLayout((prev) => {
      // Panel sırası: yüksek z üstte
      const others = prev.layers
        .filter((l) => l.kind !== 'qr')
        .slice()
        .sort((a, b) => b.z - a.z);
      const idx = others.findIndex((l) => l.id === id);
      if (idx < 0) return prev;

      const swapWith = direction === 'up' ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= others.length) return prev;

      const next = others.slice();
      const tmp = next[idx];
      next[idx] = next[swapWith];
      next[swapWith] = tmp;

      // Yeniden z ver: listedeki ilk = en yüksek
      const zById = new Map(next.map((l, i) => [l.id, next.length - i]));

      return {
        ...prev,
        layers: prev.layers.map((l) => {
          if (l.kind === 'qr') return { ...l, z: 1000 };
          const z = zById.get(l.id);
          return z !== undefined ? { ...l, z } : l;
        }),
      };
    });
  }

  function saveLayoutToLocal() {
    try {
      localStorage.setItem(
        PRINT_LAYOUT_KEY,
        JSON.stringify({
          savedAt: Date.now(),
          layout,
        })
      );
      setHasSavedLayout(true);
    } catch {
      /* ignore quota */
    }
  }

  function loadLayoutFromLocal() {
    try {
      const raw = localStorage.getItem(PRINT_LAYOUT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { layout?: PrintLayout };
      if (!parsed?.layout?.layers?.length) return;

      const saved = parsed.layout;
      // Mevcut masa/kampanya metinleri + link korunur; konum/boyut/ikonlar gelir
      const mergedLayers = saved.layers.map((l) => {
        if (l.kind === 'title') return { ...l, text: title, z: l.z ?? 2 };
        if (l.kind === 'subtitle') {
          return {
            ...l,
            text: subtitle,
            visible: subtitle ? l.visible : false,
            z: l.z ?? 3,
          };
        }
        if (l.kind === 'url') return { ...l, text: url, z: l.z ?? 1 };
        if (l.kind === 'qr') return { ...l, z: 1000 };
        return { ...l, z: l.z ?? nextZ(saved.layers) };
      });

      // Kayıtta QR yoksa ekle
      if (!mergedLayers.some((l) => l.kind === 'qr')) {
        mergedLayers.push({
          id: 'qr',
          kind: 'qr',
          text: '',
          visible: true,
          locked: false,
          x: 50,
          y: 52,
          size,
          rotate: 0,
          z: 1000,
        });
      }

      setLayout({
        showCutMarks: saved.showCutMarks ?? true,
        cut: saved.cut ?? { x: 5, y: 5, w: 90, h: 90 },
        layers: mergedLayers,
      });
      setSelected(null);
      setEditingId(null);
      setIconPanel(false);
    } catch {
      /* ignore */
    }
  }

  const hiddenBuiltins = layout.layers.filter(
    (l) =>
      !l.visible &&
      (l.kind === 'title' || l.kind === 'subtitle' || l.kind === 'url') &&
      !(l.kind === 'subtitle' && !subtitle)
  );

  function cornerHandles(id: string, locked: boolean) {
    if (locked) return null;
    return (['tl', 'tr', 'bl', 'br'] as const).map((c) => (
      <span
        key={c}
        className={`print-text-handle ${c} barcode-no-print`}
        onPointerDown={(e) => startLayerDrag(e, id, 'resize')}
      />
    ));
  }

  function layerTools(layer: CanvasLayer) {
    return (
      <div className="barcode-print-layer__tools barcode-no-print">
        {layer.kind !== 'qr' && !layer.locked && (
          <>
            <button
              type="button"
              title="Sola döndür / dikey (Shift+R)"
              onClick={(e) => {
                e.stopPropagation();
                cycleRotate(layer.id, -1);
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Sağa döndür / dikey (R)"
              onClick={(e) => {
                e.stopPropagation();
                cycleRotate(layer.id, 1);
              }}
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        <button
          type="button"
          title={layer.locked ? 'Kilidi aç' : 'Kilitle'}
          onClick={(e) => {
            e.stopPropagation();
            toggleLock(layer.id);
          }}
        >
          {layer.locked ? (
            <Lock className="w-3.5 h-3.5" />
          ) : (
            <LockOpen className="w-3.5 h-3.5" />
          )}
        </button>
        {layer.kind !== 'qr' && !layer.locked && (
          <button
            type="button"
            title="Kaldır"
            onClick={(e) => {
              e.stopPropagation();
              removeLayer(layer.id);
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  const activeCat =
    ICON_CATEGORIES.find((c) => c.id === iconCat) || ICON_CATEGORIES[0];

  return (
    <div className="print-designer">
      <div className="print-designer__backdrop barcode-no-print" />

      <div className="print-designer__panel">
        <div className="print-designer__chrome barcode-no-print">
          <div className="print-designer__head">
            <div>
              <h2>Yazdırma düzeni</h2>
              <p>
                Yazı / ikon ekle, QR dahil taşı-boyutlandır, kilitle. Yazdırınca
                aynı görünür.
              </p>
            </div>
            <button
              type="button"
              className="print-designer__close"
              onClick={onClose}
              aria-label="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="barcode-layout-toolbar">
            <button
              type="button"
              className="barcode-layout-chip is-active"
              onClick={addCustomText}
              title="Kısayol: 1"
            >
              <Plus className="w-3.5 h-3.5" />
              Yazı Ekle
            </button>
            <button
              type="button"
              className={`barcode-layout-chip ${iconPanel ? 'is-active' : ''}`}
              onClick={() => setIconPanel((v) => !v)}
              title="Kısayol: 2"
            >
              <Star className="w-3.5 h-3.5" />
              İkon Ekle
            </button>
            <button
              type="button"
              className={`barcode-layout-chip ${layout.showCutMarks ? 'is-active' : ''}`}
              onClick={() =>
                setLayout((prev) => ({
                  ...prev,
                  showCutMarks: !prev.showCutMarks,
                }))
              }
            >
              <Scissors className="w-3.5 h-3.5" />
              Kesik çizgi {layout.showCutMarks ? 'açık' : 'kapalı'}
            </button>
            <button
              type="button"
              className="barcode-layout-chip"
              onClick={resetLayout}
              title="Kısayol: 0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Sıfırla
            </button>
            <button
              type="button"
              className="barcode-layout-chip"
              disabled={!hasSavedLayout}
              title={
                hasSavedLayout
                  ? 'Bu tarayıcıda kaydedilen son yazdırma düzenini yükle'
                  : 'Henüz kayıtlı düzen yok'
              }
              onClick={loadLayoutFromLocal}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Son düzeni getir
            </button>
            {hiddenBuiltins.map((layer) => (
              <button
                key={layer.id}
                type="button"
                className="barcode-layout-chip"
                onClick={() => {
                  patchLayer(layer.id, { visible: true });
                  setSelected(layer.id);
                }}
              >
                <Type className="w-3.5 h-3.5" />+{' '}
                {layer.kind === 'title'
                  ? 'Başlık'
                  : layer.kind === 'subtitle'
                    ? 'Alt yazı'
                    : 'Link'}
              </button>
            ))}
          </div>
          <p className="print-shortcut-hint">
            Bu ekran kısayolları: <kbd>1</kbd> yazı · <kbd>2</kbd> ikon ·{' '}
            <kbd>0</kbd> sıfırla · seçili öğede <kbd>R</kbd> / <kbd>Shift+R</kbd>{' '}
            döndür
          </p>

          {iconPanel && (
            <div className="print-icon-panel">
              <div className="print-icon-cats">
                {ICON_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`print-icon-cat ${iconCat === cat.id ? 'is-active' : ''}`}
                    onClick={() => setIconCat(cat.id)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <div className="print-icon-grid">
                {activeCat.items.map((item) => {
                  const Ico = item.Icon;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      className="print-icon-item"
                      title={item.label}
                      onClick={() => addIcon(item.name)}
                    >
                      <Ico strokeWidth={1.75} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="print-designer__actions">
            <Button type="button" variant="ghost" onClick={onClose}>
              Vazgeç
            </Button>
            <Button
              type="button"
              onClick={() => {
                saveLayoutToLocal();
                window.print();
              }}
            >
              <Printer className="w-4 h-4" /> Yazdır
            </Button>
          </div>
        </div>

        <div className="print-designer__body">
          <aside className="print-layers barcode-no-print">
            <div className="print-layers__head">
              <Layers className="w-4 h-4" />
              <span>Katmanlar</span>
            </div>
            <ul className="print-layers__list">
              {layersForPanel(layout.layers).map((layer, _index, arr) => {
                const isQr = layer.kind === 'qr';
                const nonQr = arr.filter((l) => l.kind !== 'qr');
                const nonQrIdx = nonQr.findIndex((l) => l.id === layer.id);
                const canUp = !isQr && nonQrIdx > 0;
                const canDown = !isQr && nonQrIdx >= 0 && nonQrIdx < nonQr.length - 1;
                return (
                  <li
                    key={layer.id}
                    className={`print-layers__item ${
                      selected === layer.id ? 'is-active' : ''
                    } ${!layer.visible ? 'is-hidden' : ''} ${
                      isQr ? 'is-qr' : ''
                    }`}
                  >
                    <button
                      type="button"
                      className="print-layers__select"
                      onClick={() => {
                        setSelected(layer.id);
                        if (!layer.visible) patchLayer(layer.id, { visible: true });
                      }}
                    >
                      <span className="print-layers__name" title={layerLabel(layer)}>
                        {isQr && <span className="print-layers__pin">Üst</span>}
                        {layerLabel(layer)}
                      </span>
                    </button>
                    <div className="print-layers__ops">
                      {!isQr && (
                        <>
                          <button
                            type="button"
                            title="Öne getir"
                            disabled={!canUp}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              moveLayer(layer.id, 'up');
                            }}
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Arkaya al"
                            disabled={!canDown}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              moveLayer(layer.id, 'down');
                            }}
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        title={layer.visible ? 'Gizle' : 'Göster'}
                        onClick={() =>
                          patchLayer(layer.id, { visible: !layer.visible })
                        }
                      >
                        {layer.visible ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        title={layer.locked ? 'Kilidi aç' : 'Kilitle'}
                        onClick={() => toggleLock(layer.id)}
                      >
                        {layer.locked ? (
                          <Lock className="w-3.5 h-3.5" />
                        ) : (
                          <LockOpen className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="print-layers__note">QR kod her zaman en üstte kalır.</p>
          </aside>

          <div id="print-area" className="barcode-print-root print-designer__stage">
            <div
              ref={canvasRef}
              className="barcode-print-card barcode-print-card--canvas print-designer__canvas"
              style={{ background: bg, color: fg }}
              onClick={() => {
                setSelected(null);
                setEditingId(null);
              }}
            >
            {layout.showCutMarks && (
              <div
                className={`print-cut-box ${selected === 'cut' ? 'is-selected' : ''}`}
                style={{
                  left: `${layout.cut.x}%`,
                  top: `${layout.cut.y}%`,
                  width: `${layout.cut.w}%`,
                  height: `${layout.cut.h}%`,
                }}
                onPointerDown={(e) => startCutDrag(e, 'cut-move')}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected('cut');
                }}
              >
                <span className="print-cut-box__label barcode-no-print">
                  Kesim alanı
                </span>
                <span className="barcode-cut-mark tl" aria-hidden />
                <span className="barcode-cut-mark tr" aria-hidden />
                <span className="barcode-cut-mark bl" aria-hidden />
                <span className="barcode-cut-mark br" aria-hidden />
                <span
                  className="print-cut-handle tl barcode-no-print"
                  onPointerDown={(e) => startCutDrag(e, 'cut-tl')}
                />
                <span
                  className="print-cut-handle tr barcode-no-print"
                  onPointerDown={(e) => startCutDrag(e, 'cut-tr')}
                />
                <span
                  className="print-cut-handle bl barcode-no-print"
                  onPointerDown={(e) => startCutDrag(e, 'cut-bl')}
                />
                <span
                  className="print-cut-handle br barcode-no-print"
                  onPointerDown={(e) => startCutDrag(e, 'cut-br')}
                />
              </div>
            )}

            {layersForRender(layout.layers)
              .filter(
                (layer) =>
                  layer.visible &&
                  (layer.kind === 'qr' ||
                    layer.kind === 'icon' ||
                    layer.text.trim().length > 0 ||
                    editingId === layer.id)
              )
              .map((layer) => {
                const isSelected = selected === layer.id;
                const isEditing = editingId === layer.id;

                if (layer.kind === 'qr') {
                  return (
                    <div
                      key={layer.id}
                      className={`barcode-print-layer barcode-print-layer--qr ${
                        isSelected ? 'is-selected' : ''
                      } ${layer.locked ? 'is-locked' : ''}`}
                      style={{
                        left: `${layer.x}%`,
                        top: `${layer.y}%`,
                        width: layer.size,
                        height: layer.size,
                        transform: `translate(-50%, -50%) rotate(${layer.rotate}deg)`,
                      }}
                      onPointerDown={(e) => {
                        if (!layer.locked) startLayerDrag(e, layer.id, 'move');
                        else {
                          e.stopPropagation();
                          setSelected(layer.id);
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(layer.id);
                      }}
                    >
                      <QRCodeSVG
                        value={url}
                        size={layer.size}
                        level="H"
                        fgColor={fg}
                        bgColor={bg}
                        imageSettings={
                          logo
                            ? {
                                src: logo,
                                height: Math.round(layer.size * 0.26),
                                width: Math.round(layer.size * 0.26),
                                excavate: true,
                              }
                            : undefined
                        }
                      />
                      {isSelected && layerTools(layer)}
                      {isSelected && cornerHandles(layer.id, layer.locked)}
                    </div>
                  );
                }

                if (layer.kind === 'icon') {
                  const def = layer.iconName ? ICON_MAP[layer.iconName] : null;
                  const Ico = def?.Icon;
                  return (
                    <div
                      key={layer.id}
                      className={`barcode-print-layer barcode-print-layer--icon ${
                        isSelected ? 'is-selected' : ''
                      } ${layer.locked ? 'is-locked' : ''}`}
                      style={{
                        left: `${layer.x}%`,
                        top: `${layer.y}%`,
                        width: layer.size,
                        height: layer.size,
                        color: fg,
                        transform: `translate(-50%, -50%) rotate(${layer.rotate}deg)`,
                      }}
                      onPointerDown={(e) => {
                        if (!layer.locked) startLayerDrag(e, layer.id, 'move');
                        else {
                          e.stopPropagation();
                          setSelected(layer.id);
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(layer.id);
                      }}
                    >
                      {Ico ? (
                        <Ico
                          size={layer.size}
                          strokeWidth={1.6}
                          color={fg}
                        />
                      ) : null}
                      {isSelected && layerTools(layer)}
                      {isSelected && cornerHandles(layer.id, layer.locked)}
                    </div>
                  );
                }

                const className =
                  layer.kind === 'title'
                    ? 'barcode-print-title'
                    : layer.kind === 'subtitle'
                      ? 'barcode-print-subtitle'
                      : layer.kind === 'url'
                        ? 'barcode-print-url'
                        : 'barcode-print-custom';

                return (
                  <div
                    key={layer.id}
                    className={`barcode-print-layer ${
                      layer.kind === 'url' ? 'barcode-print-layer--wrap' : ''
                    } ${isSelected ? 'is-selected' : ''} ${
                      layer.locked ? 'is-locked' : ''
                    } ${layer.rotate % 180 !== 0 ? 'is-rotated' : ''}`}
                    style={{
                      left: `${layer.x}%`,
                      top: `${layer.y}%`,
                      fontSize: `${layer.size}px`,
                      color: fg,
                      transform: `translate(-50%, -50%) rotate(${layer.rotate}deg)`,
                    }}
                    onPointerDown={(e) => {
                      if (isEditing) return;
                      if (!layer.locked) startLayerDrag(e, layer.id, 'move');
                      else {
                        e.stopPropagation();
                        setSelected(layer.id);
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(layer.id);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (!layer.locked) {
                        setSelected(layer.id);
                        setEditingId(layer.id);
                      }
                    }}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        className="barcode-qr-title-input"
                        value={layer.text}
                        onChange={(e) =>
                          patchLayer(layer.id, { text: e.target.value })
                        }
                        onBlur={() => setEditingId(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{
                          color: fg,
                          borderColor: fg,
                          fontSize: `${layer.size}px`,
                        }}
                      />
                    ) : (
                      <p
                        className={className}
                        style={{ color: fg, fontSize: 'inherit' }}
                      >
                        {layer.text}
                      </p>
                    )}
                    {isSelected && !isEditing && layerTools(layer)}
                    {isSelected &&
                      !isEditing &&
                      cornerHandles(layer.id, layer.locked)}
                  </div>
                );
              })}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
