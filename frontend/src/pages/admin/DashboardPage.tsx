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
  TrendingUp,
  AlertCircle,
  ExternalLink,
  Settings,
  GripVertical,
  Check,
} from 'lucide-react';
import { api } from '@/lib/api';
import { adminPreviewMenuUrl } from '@/lib/tableContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useDemoData } from '@/contexts/DemoDataContext';
import {
  DEMO_SUMMARY,
  DEMO_TOP_GROUPS,
  DEMO_TOP_PRODUCTS,
  DEMO_CHART_MONTHS,
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

const LAYOUT_KEY = 'menu_qr_dashboard_layout_v2';

interface DashboardLayout {
  stats: StatId[];
  middle: MiddleId[];
  bottom: BottomId[];
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
  demoMode,
}: {
  groups: TopItem[];
  products: TopItem[];
  demoMode: boolean;
}) {
  const { theme } = useTheme();
  const accent = theme === 'light' ? '#2563eb' : '#facc15';
  const secondary = theme === 'light' ? '#f59e0b' : '#ca8a04';

  const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const chartData = demoMode
    ? DEMO_CHART_MONTHS
    : months.map((month, i) => ({
        month,
        gruplar: groups[i % Math.max(groups.length, 1)]?.count ?? 0,
        urunler: products[i % Math.max(products.length, 1)]?.count ?? 0,
      }));

  return (
    <div className="admin-card p-6 h-full">
      <h3 className="font-semibold text-[var(--admin-text)] mb-1">Menü Görüntüleme Anketi</h3>
      <p className="text-xs admin-text-subtle mb-6">Grup ve ürün görüntüleme dağılımı</p>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-card-border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: 'var(--admin-text-subtle)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--admin-text-subtle)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: 'var(--admin-card)',
                border: '1px solid var(--admin-card-border)',
                borderRadius: 12,
                color: 'var(--admin-text)',
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--admin-text-muted)' }} />
            <Bar dataKey="gruplar" name="Gruplar" fill={accent} radius={[4, 4, 0, 0]} />
            <Bar dataKey="urunler" name="Ürünler" fill={secondary} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TopList({ title, data }: { title: string; data: TopItem[] }) {
  return (
    <div className="admin-card p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide admin-text-muted mb-4">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm admin-text-subtle py-6 text-center">Henüz veri yok</p>
      ) : (
        <div className="space-y-2">
          {data.slice(0, 5).map((item, i) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-2 border-b last:border-0"
              style={{ borderColor: 'var(--admin-card-border)' }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'var(--admin-accent-soft)', color: 'var(--admin-accent-text)' }}
                >
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-[var(--admin-text)] truncate">{item.name}</span>
              </div>
              <span className="text-sm font-semibold admin-accent shrink-0 ml-2">{item.count}</span>
            </div>
          ))}
        </div>
      )}
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
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      api<DashboardSummary>('/api/admin/dashboard/summary'),
      api<TopItem[]>('/api/admin/dashboard/top-groups'),
      api<TopItem[]>('/api/admin/dashboard/top-products'),
    ])
      .then(([s, g, p]) => {
        setSummary(s);
        setTopGroups(g);
        setTopProducts(p);
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
          demoMode={demoEnabled}
        />
      );
    }
    return (
      <div className="admin-card p-6 h-full">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4" style={{ color: 'var(--admin-accent)' }} />
          <h3 className="font-semibold text-[var(--admin-text)]">Takvim</h3>
        </div>
        <DashboardCalendar />
      </div>
    );
  }

  function renderBottom(id: BottomId) {
    if (id === 'top-groups') {
      return <TopList title="Bugün En Çok Görüntülenen Gruplar" data={displayTopGroups} />;
    }
    return <TopList title="Bugün En Çok Görüntülenen Ürünler" data={displayTopProducts} />;
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
          <span>Düzenleme modu — kutuları sürükleyerek yer değiştirin</span>
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
