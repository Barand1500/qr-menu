import { useEffect, useState } from 'react';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { useDemoData } from '@/contexts/DemoDataContext';
import { DEMO_STATS } from '@/lib/demoData';
import {
  AudiencePanel,
  RankingPanel,
  StatsSkeleton,
  useReducedMotion,
} from '@/components/admin/stats/StatsPanels';
import {
  MONTH_NAMES,
  STAT_ENDPOINTS,
  normalizeStats,
  periodRange,
  type StatKey,
  type StatsPeriod,
  type StatsReport,
} from '@/components/admin/stats/stats-model';
import '@/components/admin/stats/stats.css';

export default function StatsPage() {
  const { demoEnabled } = useDemoData();
  const [today] = useState(() => new Date());
  const currentYear = today.getFullYear();
  const [period, setPeriod] = useState<StatsPeriod>({
    year: currentYear,
    month: today.getMonth() + 1,
    annual: false,
  });
  const [report, setReport] = useState<StatsReport | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const reduced = useReducedMotion();
  const label = period.annual
    ? period.year + ' · Tüm yıl'
    : MONTH_NAMES[period.month - 1] + ' ' + period.year;
  const reportKey =
    period.year +
    '-' +
    period.month +
    '-' +
    period.annual +
    '-' +
    revision +
    '-' +
    demoEnabled;
  const retry = () => setRevision((v) => v + 1);
  const pending = loading || loadedKey !== reportKey;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const range = periodRange(period),
      query = new URLSearchParams(range).toString();
    const keys = Object.keys(STAT_ENDPOINTS) as StatKey[];
    async function load() {
      const results = await Promise.allSettled(
        keys.map(async (key) => {
          const raw = demoEnabled
            ? DEMO_STATS[key]
            : await api<unknown>(
                '/api/admin/stats/' + STAT_ENDPOINTS[key] + '?' + query,
                { signal: controller.signal },
              );
          return normalizeStats(raw);
        }),
      );
      if (controller.signal.aborted) return;
      setReport(
        Object.fromEntries(
          keys.map((key, i) => [
            key,
            {
              items: results[i].status === 'fulfilled' ? results[i].value : [],
              failed: results[i].status === 'rejected',
            },
          ]),
        ) as StatsReport,
      );
      setLoading(false);
      setLoadedKey(reportKey);
    }
    void load();
    return () => controller.abort();
  }, [period, demoEnabled, revision, reportKey]);

  return (
    <div className="ast-page">
      <PageHeader
        title="İstatistikler"
        subtitle="Menünüzde ne ilgi görüyor, birlikte bakalım."
      />
      <div className="ast-toolbar">
        <div className="ast-period-heading">
          <CalendarDays size={19} />
          <div>
            <small>GÖSTERİLEN DÖNEM</small>
            <strong>{label}</strong>
          </div>
        </div>
        <div className="ast-period-controls">
          <div className="ast-period-mode" aria-label="Dönem kapsamı">
            <button
              aria-pressed={!period.annual}
              onClick={() =>
                setPeriod((p) => (p.annual ? { ...p, annual: false } : p))
              }
            >
              Aylık
            </button>
            <button
              aria-pressed={period.annual}
              onClick={() =>
                setPeriod((p) => (p.annual ? p : { ...p, annual: true }))
              }
            >
              Tüm yıl
            </button>
          </div>
          <label className="ast-select">
            <span className="sr-only">Yıl</span>
            <select
              aria-label="Yıl"
              value={period.year}
              onChange={(e) =>
                setPeriod((p) => ({ ...p, year: Number(e.target.value) }))
              }
            >
              {Array.from({ length: 5 }, (_, i) => currentYear - i).map(
                (year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ),
              )}
            </select>
          </label>
          {!period.annual && (
            <label className="ast-select">
              <span className="sr-only">Ay</span>
              <select
                aria-label="Ay"
                value={period.month}
                onChange={(e) =>
                  setPeriod((p) => ({ ...p, month: Number(e.target.value) }))
                }
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            className={'ast-refresh ' + (pending ? 'is-loading' : '')}
            aria-label="İstatistikleri yenile"
            disabled={pending}
            onClick={retry}
          >
            <RefreshCw size={17} />
          </button>
        </div>
      </div>
      <div className="ast-context">
        <span className={demoEnabled ? 'is-demo' : ''}>
          <i />
          {demoEnabled ? 'Örnek veriler gösteriliyor' : 'Menü görüntülenmeleri'}
        </span>
        <p>Satış veya sipariş adedi içermez.</p>
      </div>
      <div
        aria-busy={pending}
        aria-label={label + ' istatistikleri'}
        className="ast-report"
      >
        {pending || !report ? (
          <StatsSkeleton />
        ) : (
          <div key={reportKey}>
            <div className="ast-rankings">
              <RankingPanel
                kind="products"
                result={report.topProducts}
                onRetry={retry}
                reduced={reduced}
              />
              <RankingPanel
                kind="groups"
                result={report.topGroups}
                onRetry={retry}
                reduced={reduced}
              />
            </div>
            <AudiencePanel report={report} onRetry={retry} reduced={reduced} />
          </div>
        )}
      </div>
    </div>
  );
}
