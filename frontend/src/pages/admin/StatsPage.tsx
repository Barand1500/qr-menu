import { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Calendar, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Card, PageHeader, Select, Spinner } from '@/components/ui';
import {
  AdminFilterBar,
  FilterSection,
} from '@/components/AdminFilterBar';
import { useDemoData } from '@/contexts/DemoDataContext';
import { DEMO_STATS } from '@/lib/demoData';

interface TopItem {
  id: number;
  name: string;
  count: number;
}

const COLORS = [
  '#2563eb',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#f97316',
  '#64748b',
];

const MONTHS = [
  { value: '1', label: 'Ocak' },
  { value: '2', label: 'Şubat' },
  { value: '3', label: 'Mart' },
  { value: '4', label: 'Nisan' },
  { value: '5', label: 'Mayıs' },
  { value: '6', label: 'Haziran' },
  { value: '7', label: 'Temmuz' },
  { value: '8', label: 'Ağustos' },
  { value: '9', label: 'Eylül' },
  { value: '10', label: 'Ekim' },
  { value: '11', label: 'Kasım' },
  { value: '12', label: 'Aralık' },
];

function StatsBlock({
  title,
  data,
}: {
  title: string;
  data: TopItem[];
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = data.map((d) => ({ name: d.name, value: d.count }));

  return (
    <Card className="overflow-hidden !p-0">
      <div
        className="px-5 py-3.5"
        style={{
          background: 'var(--admin-input-bg)',
          borderBottom: '1px solid var(--admin-card-border)',
        }}
      >
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--admin-text)]">
          {title}
        </h3>
      </div>

      {data.length === 0 ? (
        <p className="text-sm admin-text-muted py-12 text-center">Veri bulunamadı</p>
      ) : (
        <div className="p-5 grid lg:grid-cols-2 gap-6 lg:gap-8 items-start">
          <div className="min-w-0">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-xs uppercase tracking-wide admin-text-muted"
                  style={{ borderBottom: '1px solid var(--admin-card-border)' }}
                >
                  <th className="pb-2.5 font-semibold">Adı</th>
                  <th className="pb-2.5 font-semibold text-right">Görüntülenme Sayısı</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b last:border-0"
                    style={{ borderColor: 'var(--admin-card-border)' }}
                  >
                    <td className="py-2.5 pr-3 text-[var(--admin-text)] truncate max-w-[200px]">
                      {item.name}
                    </td>
                    <td className="py-2.5 text-right font-semibold tabular-nums text-[var(--admin-text)]">
                      {item.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="min-w-0">
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={72}
                    innerRadius={28}
                    paddingAngle={2}
                  >
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value} (${total ? Math.round((value / total) * 100) : 0}%)`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 justify-center lg:justify-start">
              {data.map((item, i) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-1.5 text-xs admin-text-muted"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <span className="truncate max-w-[120px]">{item.name}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function StatsPage() {
  const { demoEnabled } = useDemoData();
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState(currentMonth);
  const [fullYearMode, setFullYearMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const [topGroups, setTopGroups] = useState<TopItem[]>([]);
  const [topProducts, setTopProducts] = useState<TopItem[]>([]);
  const [languages, setLanguages] = useState<TopItem[]>([]);
  const [operatingSystems, setOperatingSystems] = useState<TopItem[]>([]);
  const [devices, setDevices] = useState<TopItem[]>([]);

  const yearOptions = Array.from({ length: 5 }, (_, i) => ({
    value: String(currentYear - i),
    label: String(currentYear - i),
  }));

  function monthRange(y: string, m: string) {
    const start = new Date(Number(y), Number(m) - 1, 1);
    const end = new Date(Number(y), Number(m), 0);
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    };
  }

  function yearRange(y: string) {
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }

  async function load(range?: { from: string; to: string }) {
    setLoading(true);
    try {
      if (demoEnabled) {
        setTopGroups(DEMO_STATS.topGroups);
        setTopProducts(DEMO_STATS.topProducts);
        setLanguages(DEMO_STATS.languages);
        setOperatingSystems(DEMO_STATS.operatingSystems);
        setDevices(DEMO_STATS.devices);
        return;
      }

      const params = new URLSearchParams();
      if (range?.from) params.set('from', range.from);
      if (range?.to) params.set('to', range.to);
      const qs = params.toString() ? `?${params}` : '';

      const [g, p, l, os, d] = await Promise.all([
        api<TopItem[]>(`/api/admin/stats/top-groups${qs}`),
        api<TopItem[]>(`/api/admin/stats/top-products${qs}`),
        api<TopItem[]>(`/api/admin/stats/languages${qs}`),
        api<TopItem[]>(`/api/admin/stats/operating-systems${qs}`),
        api<TopItem[]>(`/api/admin/stats/devices${qs}`),
      ]);
      setTopGroups(g);
      setTopProducts(p);
      setLanguages(l);
      setOperatingSystems(os);
      setDevices(d);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(monthRange(year, month));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoEnabled]);

  function applyMonthFilter() {
    if (!month) return;
    setFullYearMode(false);
    load(monthRange(year, month));
  }

  function applyYearFilter() {
    setFullYearMode(true);
    load(yearRange(year));
  }

  function resetFilters() {
    const y = String(currentYear);
    const m = currentMonth;
    setYear(y);
    setMonth(m);
    setFullYearMode(false);
    load(monthRange(y, m));
  }

  const periodLabel = fullYearMode
    ? `${year} (tüm yıl)`
    : `${MONTHS.find((m) => m.value === month)?.label} ${year}`;

  const activeFilterCount = useMemo(() => {
    const isDefault =
      year === String(currentYear) && month === currentMonth && !fullYearMode;
    return isDefault ? 0 : 1;
  }, [year, month, fullYearMode, currentYear, currentMonth]);

  return (
    <div className="space-y-5 w-full">
      <PageHeader title="İstatistikler" />

      {demoEnabled && (
        <div
          className="px-4 py-3 rounded-2xl text-sm font-medium"
          style={{
            background: 'var(--admin-accent-soft)',
            color: 'var(--admin-accent-text)',
            border: '1px dashed var(--admin-accent)',
          }}
        >
          Sahte veri modu aktif — örnek istatistikler gösteriliyor
        </div>
      )}

      <Card className="overflow-hidden !p-0">
        <AdminFilterBar
          filterOpen={filterOpen}
          onFilterToggle={() => setFilterOpen(!filterOpen)}
          activeFilterCount={activeFilterCount}
          recordLabel={periodLabel}
          onClear={resetFilters}
        >
          <FilterSection className="min-w-[120px]">
            <Select
              label="Yıl"
              value={year}
              options={yearOptions}
              onChange={(e) => setYear(e.target.value)}
            />
          </FilterSection>
          <FilterSection className="min-w-[140px]">
            <Select
              label="Ay"
              value={month}
              options={MONTHS}
              onChange={(e) => {
                setMonth(e.target.value);
                setFullYearMode(false);
              }}
            />
          </FilterSection>
          <FilterSection>
            <Button variant="secondary" onClick={applyYearFilter} className="whitespace-nowrap">
              <Calendar className="w-4 h-4" />
              Tüm Yılı Göster
            </Button>
          </FilterSection>
          <FilterSection>
            <Button onClick={applyMonthFilter} className="whitespace-nowrap" disabled={!month}>
              <Search className="w-4 h-4" />
              Filtrele
            </Button>
          </FilterSection>
        </AdminFilterBar>
      </Card>

      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-5">
          <StatsBlock title="En Çok Görüntülenen 10 Grup" data={topGroups} />
          <StatsBlock title="En Çok Görüntülenen 10 Ürün" data={topProducts} />
          <StatsBlock title="Diller" data={languages} />
          <StatsBlock title="İşletim Sistemleri" data={operatingSystems} />
          <StatsBlock title="Cihazlar" data={devices} />
        </div>
      )}
    </div>
  );
}
