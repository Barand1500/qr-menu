import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { api } from '@/lib/api';
import { Card, Input, PageHeader, Spinner } from '@/components/ui';

interface TopItem {
  id: number;
  name: string;
  count: number;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b'];

function StatsSection({ title, data }: { title: string; data: TopItem[] }) {
  const chartData = data.map((d) => ({ name: d.name, value: d.count }));

  return (
    <Card className="p-5 mb-6">
      <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center">Veri bulunamadı</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2">Adı</th>
                <th className="pb-2 text-right">Görüntüleme</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, i) => (
                <tr key={item.id} className="border-b border-slate-50">
                  <td className="py-2.5">
                    <span className="text-slate-400 mr-2">{i + 1}.</span>
                    {item.name}
                  </td>
                  <td className="py-2.5 text-right font-medium">{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function StatsPage() {
  const [topGroups, setTopGroups] = useState<TopItem[]>([]);
  const [topProducts, setTopProducts] = useState<TopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString() ? `?${params}` : '';

    const [g, p] = await Promise.all([
      api<TopItem[]>(`/api/admin/stats/top-groups${qs}`),
      api<TopItem[]>(`/api/admin/stats/top-products${qs}`),
    ]);
    setTopGroups(g);
    setTopProducts(p);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <PageHeader
        title="İstatistikler"
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
            <span className="text-slate-400">—</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
            <button
              onClick={load}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              Filtrele
            </button>
          </div>
        }
      />

      {loading ? (
        <Spinner />
      ) : (
        <>
          <StatsSection title="En Çok Görüntülenen 10 Grup" data={topGroups} />
          <StatsSection title="En Çok Görüntülenen 10 Ürün" data={topProducts} />
        </>
      )}
    </div>
  );
}
