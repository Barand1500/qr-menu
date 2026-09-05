import { prisma } from './prisma.js';

export const MAINTENANCE_SCORES_KEY = 'maintenance_runner_scores';

export type RunnerScore = {
  name: string;
  score: number;
  at: string;
};

const MAX_ENTRIES = 15;
const MAX_SCORE = 50_000;

export async function getRunnerScores(restaurantId: number): Promise<RunnerScore[]> {
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId, key: MAINTENANCE_SCORES_KEY } },
  });
  return parseScores(row?.value);
}

export async function addRunnerScore(
  restaurantId: number,
  name: string,
  score: number
): Promise<RunnerScore[]> {
  const cleanName = sanitizeName(name);
  const cleanScore = Math.floor(Number(score));
  if (!cleanName) throw new Error('Geçerli bir isim girin');
  if (!Number.isFinite(cleanScore) || cleanScore < 1 || cleanScore > MAX_SCORE) {
    throw new Error('Geçersiz skor');
  }

  const existing = await getRunnerScores(restaurantId);
  const withoutSame = existing.filter(
    (e) => e.name.toLocaleLowerCase('tr') !== cleanName.toLocaleLowerCase('tr')
  );
  const prev = existing.find(
    (e) => e.name.toLocaleLowerCase('tr') === cleanName.toLocaleLowerCase('tr')
  );
  const nextScore = prev ? Math.max(prev.score, cleanScore) : cleanScore;
  const entry: RunnerScore = {
    name: cleanName,
    score: nextScore,
    at: new Date().toISOString(),
  };
  const merged = [...withoutSame, entry]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'tr'))
    .slice(0, MAX_ENTRIES);

  await prisma.setting.upsert({
    where: { restaurantId_key: { restaurantId, key: MAINTENANCE_SCORES_KEY } },
    update: { value: JSON.stringify(merged) },
    create: {
      restaurantId,
      key: MAINTENANCE_SCORES_KEY,
      value: JSON.stringify(merged),
    },
  });

  return merged;
}

function parseScores(raw?: string | null): RunnerScore[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const r = row as Record<string, unknown>;
        const name = sanitizeName(String(r.name ?? ''));
        const score = Math.floor(Number(r.score));
        if (!name || !Number.isFinite(score) || score < 1) return null;
        return {
          name,
          score: Math.min(score, MAX_SCORE),
          at: typeof r.at === 'string' ? r.at : new Date(0).toISOString(),
        } satisfies RunnerScore;
      })
      .filter((x): x is RunnerScore => Boolean(x))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function sanitizeName(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, ' ').slice(0, 24);
  if (trimmed.length < 2) return '';
  // Letters (incl. Turkish), numbers, space, hyphen, apostrophe
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '\-]{0,23}$/u.test(trimmed)) return '';
  const digits = (trimmed.match(/\d/g) || []).length;
  if (digits > 4) return '';
  return trimmed;
}
