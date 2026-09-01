import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Layers,
  UtensilsCrossed,
  Eye,
  Users,
  AlertCircle,
  ExternalLink,
  Settings,
  GripVertical,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { adminPreviewMenuUrl } from '@/lib/tableContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useDemoData } from '@/contexts/DemoDataContext';
import {
  DEMO_SUMMARY,
  DEMO_TOP_GROUPS,
  DEMO_TOP_PRODUCTS,
  DEMO_CHART_MONTHS,
  DEMO_STATS,
  type DashboardSummary,
  type TopItem,
} from '@/lib/demoData';
import { Spinner } from '@/components/ui';
import DashboardCalendar from '@/components/DashboardCalendar';

type StatId =
  | 'stat-aktif'
  | 'stat-pasif'
  | 'stat-basarili'
  | 'stat-hatali'
  | 'stat-goruntuleme'
  | 'stat-tekil';

type MiddleId = 'chart' | 'calendar';
type BottomId = 'top-groups' | 'top-products';
type WidgetId = StatId | MiddleId | BottomId;

type ChartViewId = 'survey' | 'top-groups' | 'top-products' | 'status' | 'traffic';

const DEFAULT_STAT_ORDER: StatId[] = [
  'stat-aktif',
  'stat-pasif',
  'stat-basarili',
  'stat-hatali',
  'stat-goruntuleme',
  'stat-tekil',
];

const DEFAULT_MIDDLE_ORDER: MiddleId[] = ['chart', 'calendar'];
const DEFAULT_BOTTOM_ORDER: BottomId[] = ['top-groups', 'top-products'];
const DEFAULT_CHART_ORDER: ChartViewId[] = [
  'survey',
  'top-groups',
  'top-products',
  'status',
  'traffic',
];

const LAYOUT_KEY = 'menu_qr_dashboard_layout_v2';
const CHART_PREFS_KEY = 'menu_qr_dashboard_charts_v1';
const RANK_PREFS_KEY = 'menu_qr_dashboard_ranks_v1';

type RankPanelId = 'groups' | 'products';
type RankViewId = string;

interface RankViewDef {
  id: RankViewId;
  title: string;
  subtitle: string;
}

const DEFAULT_GROUP_VIEWS: RankViewDef[] = [
  {
    id: 'top-groups',
    title: 'Bugün En Çok Görüntülenen Gruplar',
    subtitle: 'En popüler kategoriler',
  },
  {
    id: 'low-groups',
    title: 'En Az Görüntülenen Gruplar',
    subtitle: 'Dikkat isteyen kategoriler',
  },
  {
    id: 'languages',
    title: 'Dil Tercihleri',
    subtitle: 'Menü dili dağılımı',
  },
  {
    id: 'operating-systems',
    title: 'İşletim Sistemleri',
    subtitle: 'Ziyaretçi cihaz sistemleri',
  },
];

const DEFAULT_PRODUCT_VIEWS: RankViewDef[] = [
  {
    id: 'top-products',
    title: 'Bugün En Çok Görüntülenen Ürünler',
    subtitle: 'En popüler ürünler',
  },
  {
    id: 'low-products',
    title: 'En Az Görüntülenen Ürünler',
    subtitle: 'Daha az ilgi gören ürünler',
  },
  {
    id: 'devices',
    title: 'Cihaz Dağılımı',
    subtitle: 'Ziyaretçi cihaz markaları',
  },
  {
    id: 'products-rest',
    title: 'Diğer Popüler Ürünler',
    subtitle: '6–10. sıradaki ürünler',
  },
];

interface RankPrefs {
  groups: { order: RankViewId[]; index: number };
  products: { order: RankViewId[]; index: number };
}

function defaultRankPrefs(): RankPrefs {
  return {
    groups: {
      order: DEFAULT_GROUP_VIEWS.map((v) => v.id),
      index: 0,
    },
    products: {
      order: DEFAULT_PRODUCT_VIEWS.map((v) => v.id),
      index: 0,
    },
  };
}

function loadRankPrefs(): RankPrefs {
  const fallback = defaultRankPrefs();
  try {
    const raw = localStorage.getItem(RANK_PREFS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as RankPrefs;
    const normalize = (
      panel: RankPanelId,
      defs: RankViewDef[],
      saved?: { order?: RankViewId[]; index?: number }
    ) => {
      const allowed = new Set(defs.map((d) => d.id));
      const order = (saved?.order || []).filter((id) => allowed.has(id));
      const complete =
        order.length === defs.length && defs.every((d) => order.includes(d.id));
      if (!complete) return fallback[panel];
      return {
        order,
        index: Math.min(Math.max(0, saved?.index || 0), order.length - 1),
      };
    };
    return {
      groups: normalize('groups', DEFAULT_GROUP_VIEWS, parsed.groups),
      products: normalize('products', DEFAULT_PRODUCT_VIEWS, parsed.products),
    };
  } catch {
    return fallback;
  }
}

function saveRankPrefs(prefs: RankPrefs) {
  localStorage.setItem(RANK_PREFS_KEY, JSON.stringify(prefs));
}

const CHART_META: Record<
  ChartViewId,
  { title: string; subtitle: string }
> = {
  survey: {
    title: 'Menü Görüntüleme Anketi',
    subtitle: 'Grup ve ürün görüntüleme dağılımı',
  },
  'top-groups': {
    title: 'Popüler Gruplar',
    subtitle: 'En çok görüntülenen kategoriler',
  },
  'top-products': {
    title: 'Popüler Ürünler',
    subtitle: 'En çok görüntülenen ürünler',
  },
  status: {
    title: 'Menü Durumu',
    subtitle: 'Aktif / pasif grup ve ürün durumu',
  },
  traffic: {
    title: 'Bugünkü Trafik',
    subtitle: 'Toplam görüntüleme ve tekil ziyaretçi',
  },
};

interface DashboardLayout {
  stats: StatId[];
  middle: MiddleId[];
  bottom: BottomId[];
}

interface ChartPrefs {
  order: ChartViewId[];
  index: number;
}

function isStatId(id: string): id is StatId {
  return id.startsWith('stat-');
}

function isMiddleId(id: string): id is MiddleId {
  return id === 'chart' || id === 'calendar';
}

function isBottomId(id: string): id is BottomId {
  return id === 'top-groups' || id === 'top-products';
}

function isChartViewId(id: string): id is ChartViewId {
  return DEFAULT_CHART_ORDER.includes(id as ChartViewId);
}

function loadChartPrefs(): ChartPrefs {
  try {
    const raw = localStorage.getItem(CHART_PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ChartPrefs;
      const order = (parsed.order || []).filter(isChartViewId);
      const complete =
        order.length === DEFAULT_CHART_ORDER.length &&
        DEFAULT_CHART_ORDER.every((id) => order.includes(id));
      if (complete) {
        const index = Math.min(
          Math.max(0, parsed.index || 0),
          order.length - 1
        );
        return { order, index };
      }
    }
  } catch {
    /* defaults */
  }
  return { order: [...DEFAULT_CHART_ORDER], index: 0 };
}

function saveChartPrefs(prefs: ChartPrefs) {
  localStorage.setItem(CHART_PREFS_KEY, JSON.stringify(prefs));
}

function loadLayout(): DashboardLayout {
  const fallback = {
    stats: DEFAULT_STAT_ORDER,
    middle: DEFAULT_MIDDLE_ORDER,
    bottom: DEFAULT_BOTTOM_ORDER,
  };

  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DashboardLayout;
      const statsValid =
        parsed.stats?.length === DEFAULT_STAT_ORDER.length &&
        DEFAULT_STAT_ORDER.every((id) => parsed.stats.includes(id));
      const middleValid =
        parsed.middle?.length === 2 &&
        parsed.middle.includes('chart') &&
        parsed.middle.includes('calendar');
      const bottomValid =
        parsed.bottom?.length === 2 &&
        parsed.bottom.includes('top-groups') &&
        parsed.bottom.includes('top-products');
      if (statsValid && middleValid && bottomValid) return parsed;
    }

    const legacy = localStorage.getItem('menu_qr_dashboard_layout');
    if (legacy) {
      const old = JSON.parse(legacy) as string[];
      const stats = old.filter(isStatId);
      const middle = old.filter(isMiddleId);
      const bottom = old.filter(isBottomId);
      if (
        stats.length === DEFAULT_STAT_ORDER.length &&
        middle.length === 2 &&
        bottom.length === 2
      ) {
        return { stats, middle, bottom };
      }
    }
  } catch {
    /* use defaults */
  }

  return fallback;
}

function saveLayout(layout: DashboardLayout) {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
}

function SortableWidget({
  id,
  editMode,
  wiggleIndex,
  className = '',
  children,
}: {
  id: WidgetId;
  editMode: boolean;
  wiggleIndex: number;
  className?: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !editMode,
  });

  const sortStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <div ref={setNodeRef} style={sortStyle} className={`relative h-full ${className}`}>
      <div
        className={`h-full ${editMode ? 'dashboard-wiggle dashboard-edit-ring' : ''}`}
        style={{ animationDelay: editMode ? `${wiggleIndex * 0.04}s` : undefined }}
      >
        {editMode && (
          <button
            {...attributes}
            {...listeners}
            className="absolute top-2 right-2 z-10 p-2 rounded-xl shadow-md cursor-grab active:cursor-grabbing"
            style={{ background: 'var(--admin-accent)', color: '#fff' }}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

function MiniStatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  sub: string;
  icon: typeof Layers;
}) {
  return (
    <div className="admin-card p-4 flex items-center justify-between gap-3 w-full h-full transition-all hover:scale-[1.02]">
      <div className="min-w-0">
        <p className="text-2xl font-bold text-[var(--admin-text)] leading-none">{value}</p>
        <p className="text-sm font-medium mt-1.5 text-[var(--admin-text)]">{label}</p>
        <p className="text-xs admin-text-subtle mt-1 truncate">{sub}</p>
      </div>
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
        style={{ background: 'var(--admin-accent-soft)' }}
      >
        <Icon className="w-5 h-5" style={{ color: 'var(--admin-accent)' }} />
      </div>
    </div>
  );
}

function FeaturedCard({
  editMode,
  onToggleEdit,
}: {
  editMode: boolean;
  onToggleEdit: () => void;
}) {
  const { user } = useAuth();
  const { theme } = useTheme();

  function openMenu() {
    window.open(adminPreviewMenuUrl(), '_blank');
  }

  return (
    <div
      className={`admin-card p-6 flex flex-col justify-between h-full min-h-[200px] ${
        editMode ? 'dashboard-wiggle dashboard-edit-ring' : ''
      }`}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider admin-text-subtle mb-4">
          Dijital Menü
        </p>
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shrink-0"
            style={{
              background: 'var(--admin-accent-soft)',
              color: 'var(--admin-accent-text)',
            }}
          >
            {user?.restaurant.name.charAt(0)}
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--admin-text)]">{user?.restaurant.name}</h3>
            <p className="text-sm admin-text-muted">QR Menü Aktif</p>
            <p className="text-xs admin-text-subtle mt-1">/menu</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={openMenu}
          disabled={editMode}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full transition hover:opacity-90 disabled:opacity-50"
          style={{
            background: 'var(--admin-accent)',
            color: theme === 'dark' ? '#0c0c0c' : '#ffffff',
          }}
        >
          <ExternalLink className="w-4 h-4" />
          Menüyü Gör
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleEdit();
          }}
          className={`p-2.5 rounded-full transition hover:scale-105 ${
            editMode ? 'ring-2 ring-[var(--admin-accent)]' : ''
          }`}
          style={{ background: editMode ? 'var(--admin-accent)' : 'var(--admin-accent-soft)' }}
          title={editMode ? 'Düzenlemeyi bitir' : 'Kutuları düzenle'}
        >
          {editMode ? (
            <Check className="w-5 h-5 text-white" />
          ) : (
            <Settings className="w-5 h-5" style={{ color: 'var(--admin-accent)' }} />
          )}
        </button>
      </div>
    </div>
  );
}

function SurveyChart({
  groups,
  products,
  summary,
  demoMode,
  editMode,
}: {
  groups: TopItem[];
  products: TopItem[];
  summary: DashboardSummary;
  demoMode: boolean;
  editMode: boolean;
}) {
  const { theme } = useTheme();
  const accent = theme === 'light' ? '#2563eb' : '#facc15';
  const secondary = theme === 'light' ? '#f59e0b' : '#ca8a04';
  const muted = theme === 'light' ? '#94a3b8' : '#64748b';
  const soft = theme === 'light' ? '#38bdf8' : '#eab308';

  const [prefs, setPrefs] = useState<ChartPrefs>(loadChartPrefs);
  const activeId = prefs.order[prefs.index] || prefs.order[0];
  const meta = CHART_META[activeId];

  function updatePrefs(next: ChartPrefs) {
    setPrefs(next);
    saveChartPrefs(next);
  }

  function go(delta: number) {
    if (editMode) {
      const from = prefs.index;
      const to = from + delta;
      if (to < 0 || to >= prefs.order.length) return;
      const order = arrayMove(prefs.order, from, to);
      updatePrefs({ order, index: to });
      return;
    }
    const len = prefs.order.length;
    const index = (prefs.index + delta + len) % len;
    updatePrefs({ ...prefs, index });
  }

  function jumpTo(index: number) {
    if (index < 0 || index >= prefs.order.length) return;
    updatePrefs({ ...prefs, index });
  }

  const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const surveyData = demoMode
    ? DEMO_CHART_MONTHS
    : months.map((month, i) => ({
        month,
        gruplar: groups[i % Math.max(groups.length, 1)]?.count ?? 0,
        urunler: products[i % Math.max(products.length, 1)]?.count ?? 0,
      }));

  const topGroupsData = groups.slice(0, 6).map((g) => ({
    name: g.name.length > 14 ? `${g.name.slice(0, 13)}…` : g.name,
    fullName: g.name,
    count: g.count,
  }));

  const topProductsData = products.slice(0, 6).map((p) => ({
    name: p.name.length > 16 ? `${p.name.slice(0, 15)}…` : p.name,
    fullName: p.name,
    count: p.count,
  }));

  const statusData = [
    { name: 'Aktif grup', value: summary.groups.active, fill: accent },
    { name: 'Pasif grup', value: summary.groups.passive, fill: muted },
    { name: 'Başarılı ürün', value: summary.products.valid, fill: soft },
    { name: 'Hatalı ürün', value: summary.products.invalid, fill: secondary },
  ];

  const trafficData = [
    { name: 'Toplam', value: summary.viewsToday.total, fill: accent },
    { name: 'Tekil', value: summary.viewsToday.unique, fill: secondary },
  ];

  const tooltipStyle = {
    background: 'var(--admin-card)',
    border: '1px solid var(--admin-card-border)',
    borderRadius: 12,
    color: 'var(--admin-text)',
  };

  function renderActiveChart() {
    if (activeId === 'survey') {
      return (
        <BarChart data={surveyData} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-card-border)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: 'var(--admin-text-subtle)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--admin-text-subtle)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--admin-text-muted)' }} />
          <Bar dataKey="gruplar" name="Gruplar" fill={accent} radius={[4, 4, 0, 0]} />
          <Bar dataKey="urunler" name="Ürünler" fill={secondary} radius={[4, 4, 0, 0]} />
        </BarChart>
      );
    }

    if (activeId === 'top-groups') {
      if (topGroupsData.length === 0) {
        return null;
      }
      return (
        <BarChart data={topGroupsData} layout="vertical" margin={{ left: 8, right: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-card-border)" horizontal={false} />
          <XAxis type="number" tick={{ fill: 'var(--admin-text-subtle)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={92}
            tick={{ fill: 'var(--admin-text-muted)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [value as number, 'Görüntüleme']}
            labelFormatter={(_, payload) =>
              (payload?.[0]?.payload as { fullName?: string } | undefined)?.fullName || ''
            }
          />
          <Bar dataKey="count" name="Görüntüleme" fill={accent} radius={[0, 4, 4, 0]} />
        </BarChart>
      );
    }

    if (activeId === 'top-products') {
      if (topProductsData.length === 0) {
        return null;
      }
      return (
        <BarChart data={topProductsData} layout="vertical" margin={{ left: 8, right: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-card-border)" horizontal={false} />
          <XAxis type="number" tick={{ fill: 'var(--admin-text-subtle)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={100}
            tick={{ fill: 'var(--admin-text-muted)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [value as number, 'Görüntüleme']}
            labelFormatter={(_, payload) =>
              (payload?.[0]?.payload as { fullName?: string } | undefined)?.fullName || ''
            }
          />
          <Bar dataKey="count" name="Görüntüleme" fill={secondary} radius={[0, 4, 4, 0]} />
        </BarChart>
      );
    }

    if (activeId === 'status') {
      return (
        <BarChart data={statusData} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-card-border)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: 'var(--admin-text-subtle)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fill: 'var(--admin-text-subtle)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="value" name="Adet" radius={[4, 4, 0, 0]}>
            {statusData.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      );
    }

    return (
      <BarChart data={trafficData} barGap={8}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-card-border)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: 'var(--admin-text-subtle)', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--admin-text-subtle)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="value" name="Bugün" radius={[6, 6, 0, 0]} barSize={56}>
          {trafficData.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    );
  }

  const empty =
    (activeId === 'top-groups' && topGroupsData.length === 0) ||
    (activeId === 'top-products' && topProductsData.length === 0);

  return (
    <div className="admin-card p-6 h-full dash-survey">
      <div className="dash-survey__head">
        <div className="min-w-0">
          <h3 className="font-semibold text-[var(--admin-text)] mb-1 truncate">{meta.title}</h3>
          <p className="text-xs admin-text-subtle">
            {editMode ? 'Düzenleme: oklarla grafik sırasını değiştirin' : meta.subtitle}
          </p>
        </div>
        <div className="dash-survey__nav">
          <button
            type="button"
            className="dash-survey__arrow"
            onClick={() => go(-1)}
            disabled={editMode && prefs.index === 0}
            aria-label={editMode ? 'Sırada geri al' : 'Önceki grafik'}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="dash-survey__page">
            {prefs.index + 1}/{prefs.order.length}
          </span>
          <button
            type="button"
            className="dash-survey__arrow"
            onClick={() => go(1)}
            disabled={editMode && prefs.index === prefs.order.length - 1}
            aria-label={editMode ? 'Sırada ileri al' : 'Sonraki grafik'}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="dash-survey__dots" role="tablist" aria-label="Grafik görünümleri">
        {prefs.order.map((id, i) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={i === prefs.index}
            title={CHART_META[id].title}
            className={`dash-survey__dot${i === prefs.index ? ' is-active' : ''}`}
            onClick={() => jumpTo(i)}
          />
        ))}
      </div>

      {editMode && (
        <div className="dash-survey__chips">
          {prefs.order.map((id, i) => (
            <button
              key={id}
              type="button"
              className={`dash-survey__chip${i === prefs.index ? ' is-active' : ''}`}
              onClick={() => jumpTo(i)}
            >
              {CHART_META[id].title}
            </button>
          ))}
        </div>
      )}

      <div className="h-[240px] mt-3">
        {empty ? (
          <p className="text-sm admin-text-subtle h-full flex items-center justify-center">
            Henüz veri yok
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {renderActiveChart() || <div />}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function TopListCarousel({
  panel,
  editMode,
  views,
  resolveData,
}: {
  panel: RankPanelId;
  editMode: boolean;
  views: RankViewDef[];
  resolveData: (viewId: RankViewId) => TopItem[];
}) {
  const [prefs, setPrefs] = useState<RankPrefs>(loadRankPrefs);
  const panelPrefs = prefs[panel];
  const viewMap = useMemo(
    () => Object.fromEntries(views.map((v) => [v.id, v])) as Record<RankViewId, RankViewDef>,
    [views]
  );
  const activeId = panelPrefs.order[panelPrefs.index] || panelPrefs.order[0];
  const meta = viewMap[activeId] || views[0];
  const data = resolveData(activeId).slice(0, 5);

  function updatePanel(next: { order: RankViewId[]; index: number }) {
    const fresh = loadRankPrefs();
    const updated = { ...fresh, [panel]: next };
    setPrefs(updated);
    saveRankPrefs(updated);
  }

  function go(delta: number) {
    if (editMode) {
      const from = panelPrefs.index;
      const to = from + delta;
      if (to < 0 || to >= panelPrefs.order.length) return;
      updatePanel({ order: arrayMove(panelPrefs.order, from, to), index: to });
      return;
    }
    const len = panelPrefs.order.length;
    updatePanel({
      ...panelPrefs,
      index: (panelPrefs.index + delta + len) % len,
    });
  }

  function jumpTo(index: number) {
    if (index < 0 || index >= panelPrefs.order.length) return;
    updatePanel({ ...panelPrefs, index });
  }

  return (
    <div className="admin-card p-5 h-full dash-rank">
      <div className="dash-rank__head">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold uppercase tracking-wide admin-text-muted truncate">
            {meta.title}
          </h3>
          <p className="text-[11px] admin-text-subtle mt-0.5">
            {editMode ? 'Düzenleme: oklarla liste sırasını değiştirin' : meta.subtitle}
          </p>
        </div>
        <div className="dash-survey__nav">
          <button
            type="button"
            className="dash-survey__arrow"
            onClick={() => go(-1)}
            disabled={editMode && panelPrefs.index === 0}
            aria-label={editMode ? 'Sırada geri al' : 'Önceki liste'}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="dash-survey__page">
            {panelPrefs.index + 1}/{panelPrefs.order.length}
          </span>
          <button
            type="button"
            className="dash-survey__arrow"
            onClick={() => go(1)}
            disabled={editMode && panelPrefs.index === panelPrefs.order.length - 1}
            aria-label={editMode ? 'Sırada ileri al' : 'Sonraki liste'}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="dash-survey__dots" role="tablist" aria-label="Liste görünümleri">
        {panelPrefs.order.map((id, i) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={i === panelPrefs.index}
            title={viewMap[id]?.title || id}
            className={`dash-survey__dot${i === panelPrefs.index ? ' is-active' : ''}`}
            onClick={() => jumpTo(i)}
          />
        ))}
      </div>

      {editMode && (
        <div className="dash-survey__chips">
          {panelPrefs.order.map((id, i) => (
            <button
              key={id}
              type="button"
              className={`dash-survey__chip${i === panelPrefs.index ? ' is-active' : ''}`}
              onClick={() => jumpTo(i)}
            >
              {viewMap[id]?.title || id}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3">
        {data.length === 0 ? (
          <p className="text-sm admin-text-subtle py-6 text-center">Henüz veri yok</p>
        ) : (
          <div className="space-y-2">
            {data.map((item, i) => (
              <div
                key={`${activeId}-${item.id}`}
                className="flex items-center justify-between py-2 border-b last:border-0"
                style={{ borderColor: 'var(--admin-card-border)' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{
                      background: 'var(--admin-accent-soft)',
                      color: 'var(--admin-accent-text)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-[var(--admin-text)] truncate">
                    {item.name}
                  </span>
                </div>
                <span className="text-sm font-semibold admin-accent shrink-0 ml-2">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const WIDGET_LABELS: Record<WidgetId, string> = {
  'stat-aktif': 'Aktif Gruplar',
  'stat-pasif': 'Pasif Gruplar',
  'stat-basarili': 'Başarılı Ürünler',
  'stat-hatali': 'Hatalı Ürünler',
  'stat-goruntuleme': 'Görüntüleme',
  'stat-tekil': 'Tekil Ziyaretçi',
  chart: 'Menü Görüntüleme Anketi',
  calendar: 'Takvim',
  'top-groups': 'Top Gruplar',
  'top-products': 'Top Ürünler',
};

export default function DashboardPage() {
  const { demoEnabled } = useDemoData();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [topGroups, setTopGroups] = useState<TopItem[]>([]);
  const [topProducts, setTopProducts] = useState<TopItem[]>([]);
  const [languages, setLanguages] = useState<TopItem[]>([]);
  const [operatingSystems, setOperatingSystems] = useState<TopItem[]>([]);
  const [devices, setDevices] = useState<TopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [layout, setLayout] = useState<DashboardLayout>(loadLayout);
  const [dragId, setDragId] = useState<WidgetId | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (demoEnabled) {
      setSummary(DEMO_SUMMARY);
      setTopGroups(DEMO_TOP_GROUPS);
      setTopProducts(DEMO_TOP_PRODUCTS);
      setLanguages(DEMO_STATS.languages);
      setOperatingSystems(DEMO_STATS.operatingSystems);
      setDevices(DEMO_STATS.devices);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      api<DashboardSummary>('/api/admin/dashboard/summary'),
      api<TopItem[]>('/api/admin/dashboard/top-groups'),
      api<TopItem[]>('/api/admin/dashboard/top-products'),
      api<TopItem[]>('/api/admin/stats/languages').catch(() => [] as TopItem[]),
      api<TopItem[]>('/api/admin/stats/operating-systems').catch(() => [] as TopItem[]),
      api<TopItem[]>('/api/admin/stats/devices').catch(() => [] as TopItem[]),
    ])
      .then(([s, g, p, langs, os, devs]) => {
        setSummary(s);
        setTopGroups(g);
        setTopProducts(p);
        setLanguages(langs);
        setOperatingSystems(os);
        setDevices(devs);
      })
      .finally(() => setLoading(false));
  }, [demoEnabled]);

  function toggleEditMode() {
    setEditMode((v) => {
      if (v) saveLayout(layout);
      return !v;
    });
  }

  function handleDragStart(e: DragStartEvent) {
    setDragId(e.active.id as WidgetId);
  }

  function handleDragEnd(e: DragEndEvent) {
    setDragId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    setLayout((prev) => {
      let next = prev;

      if (isStatId(activeId) && isStatId(overId)) {
        const oldIndex = prev.stats.indexOf(activeId);
        const newIndex = prev.stats.indexOf(overId);
        next = { ...prev, stats: arrayMove(prev.stats, oldIndex, newIndex) };
      } else if (isMiddleId(activeId) && isMiddleId(overId)) {
        const oldIndex = prev.middle.indexOf(activeId);
        const newIndex = prev.middle.indexOf(overId);
        next = { ...prev, middle: arrayMove(prev.middle, oldIndex, newIndex) };
      } else if (isBottomId(activeId) && isBottomId(overId)) {
        const oldIndex = prev.bottom.indexOf(activeId);
        const newIndex = prev.bottom.indexOf(overId);
        next = { ...prev, bottom: arrayMove(prev.bottom, oldIndex, newIndex) };
      } else {
        return prev;
      }

      saveLayout(next);
      return next;
    });
  }

  const displaySummary = demoEnabled ? DEMO_SUMMARY : summary;
  const displayTopGroups = demoEnabled ? DEMO_TOP_GROUPS : topGroups;
  const displayTopProducts = demoEnabled ? DEMO_TOP_PRODUCTS : topProducts;
  const displayLanguages = demoEnabled ? DEMO_STATS.languages : languages;
  const displayOperatingSystems = demoEnabled
    ? DEMO_STATS.operatingSystems
    : operatingSystems;
  const displayDevices = demoEnabled ? DEMO_STATS.devices : devices;

  const statData = useMemo(() => {
    if (!displaySummary) return null;
    const totalGroups = displaySummary.groups.active + displaySummary.groups.passive;
    return {
      'stat-aktif': {
        label: 'Aktif Gruplar',
        value: displaySummary.groups.active,
        sub: `Toplam ${totalGroups} grup`,
        icon: Layers,
      },
      'stat-pasif': {
        label: 'Pasif Gruplar',
        value: displaySummary.groups.passive,
        sub: 'Devre dışı kategoriler',
        icon: Layers,
      },
      'stat-basarili': {
        label: 'Başarılı Ürünler',
        value: displaySummary.products.valid,
        sub: `Toplam ${displaySummary.products.total} ürün`,
        icon: UtensilsCrossed,
      },
      'stat-hatali': {
        label: 'Hatalı Ürünler',
        value: displaySummary.products.invalid,
        sub: 'Eksik görsel veya fiyat',
        icon: AlertCircle,
      },
      'stat-goruntuleme': {
        label: 'Görüntüleme',
        value: displaySummary.viewsToday.total,
        sub: 'Bugünkü toplam',
        icon: Eye,
      },
      'stat-tekil': {
        label: 'Tekil Ziyaretçi',
        value: displaySummary.viewsToday.unique,
        sub: 'Bugünkü benzersiz',
        icon: Users,
      },
    } as const;
  }, [displaySummary]);

  function renderStat(id: StatId) {
    if (!statData) return null;
    const stat = statData[id];
    const Icon = stat.icon;
    return <MiniStatCard label={stat.label} value={stat.value} sub={stat.sub} icon={Icon} />;
  }

  function renderMiddle(id: MiddleId) {
    if (id === 'chart') {
      return (
        <SurveyChart
          groups={displayTopGroups}
          products={displayTopProducts}
          summary={displaySummary!}
          demoMode={demoEnabled}
          editMode={editMode}
        />
      );
    }
    return (
      <div className="admin-card p-6 h-full">
        <DashboardCalendar showTitle />
      </div>
    );
  }

  function renderBottom(id: BottomId) {
    if (id === 'top-groups') {
      return (
        <TopListCarousel
          panel="groups"
          editMode={editMode}
          views={DEFAULT_GROUP_VIEWS}
          resolveData={(viewId) => {
            if (viewId === 'low-groups') {
              return [...displayTopGroups].sort((a, b) => a.count - b.count);
            }
            if (viewId === 'languages') return displayLanguages;
            if (viewId === 'operating-systems') return displayOperatingSystems;
            return displayTopGroups;
          }}
        />
      );
    }
    return (
      <TopListCarousel
        panel="products"
        editMode={editMode}
        views={DEFAULT_PRODUCT_VIEWS}
        resolveData={(viewId) => {
          if (viewId === 'low-products') {
            return [...displayTopProducts].sort((a, b) => a.count - b.count);
          }
          if (viewId === 'devices') return displayDevices;
          if (viewId === 'products-rest') return displayTopProducts.slice(5, 10);
          return displayTopProducts;
        }}
      />
    );
  }

  if (loading || !displaySummary) return <Spinner />;

  return (
    <div className="space-y-6">
      {demoEnabled && (
        <div
          className="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2"
          style={{ background: 'var(--admin-accent-soft)', color: 'var(--admin-accent-text)' }}
        >
          <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
          Sahte veri modu aktif — test amaçlı gösteriliyor
        </div>
      )}

      {editMode && (
        <div
          className="px-4 py-3 rounded-xl text-sm font-medium flex items-center justify-between gap-3"
          style={{ background: 'var(--admin-accent)', color: '#fff' }}
        >
          <span>Düzenleme modu — kutuları sürükleyin; grafik ve listelerde oklarla sırayı değiştirin</span>
          <button
            onClick={toggleEditMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-semibold shrink-0"
          >
            <Check className="w-3.5 h-3.5" />
            Bitti
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Satır 1: Dijital menü + 6 istatistik kutusu */}
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-1">
            <FeaturedCard editMode={editMode} onToggleEdit={toggleEditMode} />
          </div>
          <div className="lg:col-span-2 grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <SortableContext items={layout.stats} strategy={rectSortingStrategy}>
              {layout.stats.map((id, index) => (
                <SortableWidget key={id} id={id} editMode={editMode} wiggleIndex={index}>
                  {renderStat(id)}
                </SortableWidget>
              ))}
            </SortableContext>
          </div>
        </div>

        {/* Satır 2: Grafik + takvim */}
        <div className="grid lg:grid-cols-3 gap-5">
          <SortableContext items={layout.middle} strategy={rectSortingStrategy}>
            {layout.middle.map((id, index) => (
              <SortableWidget
                key={id}
                id={id}
                editMode={editMode}
                wiggleIndex={index + layout.stats.length}
                className={id === 'chart' ? 'lg:col-span-2' : 'lg:col-span-1'}
              >
                {renderMiddle(id)}
              </SortableWidget>
            ))}
          </SortableContext>
        </div>

        {/* Satır 3: Top listeler */}
        <div className="grid md:grid-cols-2 gap-5">
          <SortableContext items={layout.bottom} strategy={rectSortingStrategy}>
            {layout.bottom.map((id, index) => (
              <SortableWidget
                key={id}
                id={id}
                editMode={editMode}
                wiggleIndex={index + layout.stats.length + layout.middle.length}
              >
                {renderBottom(id)}
              </SortableWidget>
            ))}
          </SortableContext>
        </div>

        <DragOverlay>
          {dragId && (
            <div className="admin-card p-4 shadow-2xl opacity-90 text-sm font-semibold text-[var(--admin-text)]">
              {WIDGET_LABELS[dragId]}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
