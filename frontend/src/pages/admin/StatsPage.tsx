import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import {
  ChevronDown,
  Calendar,
  Search,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Card, PageHeader, Select, Spinner } from '@/components/ui';
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

function StatsSection({
  title,
  data,
  defaultOpen = true,
}: {
  title: string;
  data: TopItem[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const chartData = data.map((d) => ({ name: d.name, value: d.count }));

  return (
    <Card className="overflow-hidden !p-0 mb-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition hover:bg-[var(--admin-accent-soft)]/30"
        style={{ borderBottom: open ? '1px solid var(--admin-card-border)' : 'none' }}
      >
        <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--admin-text)]">
          {title}
        </h3>
        <ChevronDown
          className={`w-5 h-5 admin-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="p-5">
          {data.length === 0 ? (
            <p className="text-sm admin-text-muted py-8 text-center">Veri bulunamadı</p>
          ) : (
            <div className="grid lg:grid-cols-2 gap-6 items-start">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      className="text-left text-xs uppercase tracking-wide admin-text-muted"
                      style={{ borderBottom: '1px solid var(--admin-card-border)' }}
                    >
                      <th className="pb-2 font-semibold">Adı</th>
                      <th className="pb-2 font-semibold text-right">Görüntülenme Sayısı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b last:border-0"
                        style={{ borderColor: 'var(--admin-card-border)' }}
                      >
                        <td className="py-2.5 text-[var(--admin-text)]">{item.name}</td>
                        <td className="py-2.5 text-right font-semibold text-[var(--admin-text)]">
                          {item.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="h-64 min-h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      outerRadius={78}
                      label={({ name, percent }) =>
                        `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                      }
                      labelLine={false}
                    >
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function StatsPage() {
  const { demoEnabled } = useDemoData();
  const currentYear = new Date().getFullYear();
  const [filterOpen, setFilterOpen] = useState(true);
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
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
    load(monthRange(year, month));
  }

  function applyYearFilter() {
    load(yearRange(year));
  }

  function resetFilters() {
    const y = String(currentYear);
    const m = String(new Date().getMonth() + 1);
    setYear(y);
    setMonth(m);
    load(monthRange(y, m));
  }

  const selectedMonthLabel = MONTHS.find((m) => m.value === month)?.label || '';

  return (
    <div className="space-y-5">
      <PageHeader title="İstatistikler" />

      <Card className="overflow-hidden !p-0">
        <button
          type="button"
          onClick={() => setFilterOpen(!filterOpen)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
          style={{ borderBottom: filterOpen ? '1px solid var(--admin-card-border)' : 'none' }}
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--admin-text)]">
            <SlidersHorizontal className="w-4 h-4" style={{ color: 'var(--admin-accent)' }} />
            Filtreler
          </span>
          <ChevronDown
            className={`w-5 h-5 admin-text-muted transition-transform ${filterOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {filterOpen && (
          <div className="p-5 space-y-4" style={{ background: 'var(--admin-input-bg)' }}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              <Select
                label="Yıl"
                value={year}
                options={yearOptions}
                onChange={(e) => setYear(e.target.value)}
              />

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide admin-text-muted mb-2">
                  Ay
                </p>
                <div
                  className="flex flex-wrap gap-2 min-h-[46px] items-center px-3 py-2 rounded-xl"
                  style={{
                    background: 'var(--admin-card)',
                    border: '1px solid var(--admin-card-border)',
                  }}
                >
                  {month ? (
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-semibold"
                      style={{
                        background: 'var(--admin-accent-soft)',
                        color: 'var(--admin-accent-text)',
                      }}
                    >
                      {selectedMonthLabel.toUpperCase()}
                      <button
                        type="button"
                        onClick={() => setMonth('')}
                        className="opacity-70 hover:opacity-100"
                      >
                        ×
                      </button>
                    </span>
                  ) : (
                    <span className="text-sm admin-text-muted">Ay seçilmedi</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {MONTHS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMonth(m.value)}
                      className="px-2 py-1 rounded-lg text-xs font-medium transition"
                      style={{
                        background:
                          month === m.value ? 'var(--admin-accent)' : 'var(--admin-card)',
                        color:
                          month === m.value
                            ? 'var(--admin-btn-primary-text)'
                            : 'var(--admin-text-muted)',
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button variant="secondary" onClick={applyYearFilter} className="w-full">
                <Calendar className="w-4 h-4" />
                Tüm Yılı Göster
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <RotateCcw className="w-4 h-4" />
                Sıfırla
              </Button>
              <Button onClick={applyMonthFilter} disabled={!month}>
                <Search className="w-4 h-4" />
                Filtrele
              </Button>
            </div>
          </div>
        )}
      </Card>

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

      {loading ? (
        <Spinner />
      ) : (
        <>
          <StatsSection title="En Çok Görüntülenen 10 Grup" data={topGroups} />
          <StatsSection title="En Çok Görüntülenen 10 Ürün" data={topProducts} />
          <StatsSection title="Diller" data={languages} />
          <StatsSection title="İşletim Sistemleri" data={operatingSystems} />
          <StatsSection title="Cihazlar" data={devices} />
        </>
      )}
    </div>
  );
}
