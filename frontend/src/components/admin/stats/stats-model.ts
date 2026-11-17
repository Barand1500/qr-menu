export interface StatItem {
  id: number;
  name: string;
  count: number;
}
export type StatKey =
  'topProducts' | 'topGroups' | 'languages' | 'devices' | 'operatingSystems';
export type StatResult = { items: StatItem[]; failed: boolean };
export type StatsReport = Record<StatKey, StatResult>;
export type StatsPeriod = { year: number; month: number; annual: boolean };

export const STAT_ENDPOINTS: Record<StatKey, string> = {
  topProducts: 'top-products',
  topGroups: 'top-groups',
  languages: 'languages',
  devices: 'devices',
  operatingSystems: 'operating-systems',
};

export const MONTH_NAMES = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

/** Takvim günleri UTC'ye çevrilmez: Türkiye'de ayın ilk günü bir önceki güne kaymamalı. */
export function periodRange({ year, month, annual }: StatsPeriod) {
  const mm = String(month).padStart(2, '0');
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return annual
    ? { from: year + '-01-01', to: year + '-12-31' }
    : { from: year + '-' + mm + '-01', to: year + '-' + mm + '-' + last };
}

export function normalizeStats(value: unknown): StatItem[] {
  if (!Array.isArray(value)) throw new Error('İstatistik yanıtı geçersiz.');
  return value
    .flatMap((row, index) => {
      if (
        !row ||
        typeof row !== 'object' ||
        typeof row.count !== 'number' ||
        !Number.isFinite(row.count) ||
        row.count < 0
      )
        return [];
      return [
        {
          id: typeof row.id === 'number' ? row.id : index + 1,
          name:
            typeof row.name === 'string' && row.name.trim()
              ? row.name.trim()
              : 'Bilinmiyor',
          count: Math.floor(row.count),
        },
      ];
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
}

export const statNumber = (n: number) => n.toLocaleString('tr-TR');
