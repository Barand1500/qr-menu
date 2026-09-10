import { useEffect, useState } from 'react';
import { Check, Gamepad2, Settings2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, PageHeader } from '@/components/ui';
import DetectiveGameSettingsModal from '@/components/admin/DetectiveGameSettingsModal';
import MemoryGameSettingsModal from '@/components/admin/MemoryGameSettingsModal';
import {
  DEFAULT_MENU_GAMES_CONFIG,
  type MenuGamesConfig,
} from '@/lib/menuGamesConfig';

type GameCardId = 'memory' | 'xox' | 'detective' | 'blitz';

const GAME_CARDS: {
  id: GameCardId;
  name: string;
  blurb: string;
  free: boolean;
  hasSettings: boolean;
}[] = [
  {
    id: 'memory',
    name: 'Hafıza',
    blurb: 'Kart eşleştirme — solo hızlı oyun. İsterseniz kendi görsellerinizle.',
    free: true,
    hasSettings: true,
  },
  {
    id: 'xox',
    name: 'XOX',
    blurb: 'Aynı masadaki misafirle oyna. Ek ayar gerekmez.',
    free: true,
    hasSettings: false,
  },
  {
    id: 'detective',
    name: 'Menü Dedektifi',
    blurb: 'Kim milyoner olmak ister tarzı bilgi yarışması. Kendi sorularınızı ekleyebilirsiniz.',
    free: true,
    hasSettings: true,
  },
  {
    id: 'blitz',
    name: 'Sipariş Blitz',
    blurb: 'Siparişi ezberle, süre dolmadan doğru ürünleri bul.',
    free: true,
    hasSettings: false,
  },
];

export default function GamesScreenPage() {
  const [config, setConfig] = useState<MenuGamesConfig>(DEFAULT_MENU_GAMES_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [detectiveOpen, setDetectiveOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<{ ok: boolean; config: MenuGamesConfig }>('/api/admin/settings/menu-games')
      .then((res) => {
        if (!cancelled && res.config) setConfig(res.config);
      })
      .catch(() => {
        if (!cancelled) setConfig(DEFAULT_MENU_GAMES_CONFIG);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(next: MenuGamesConfig, toast?: string) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await api<{ ok: boolean; config: MenuGamesConfig }>('/api/admin/settings/menu-games', {
        method: 'PUT',
        body: JSON.stringify(next),
      });
      setConfig(res.config);
      setMessage(toast || 'Oyun ayarları kaydedildi.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  function toggleMaster() {
    void save({ ...config, enabled: !config.enabled }, config.enabled ? 'Oyunlar kapatıldı.' : 'Oyunlar aktif.');
  }

  function toggleGame(id: GameCardId) {
    if (id === 'memory') {
      void save(
        { ...config, memory: { ...config.memory, enabled: !config.memory.enabled } },
        config.memory.enabled ? 'Hafıza kapatıldı.' : 'Hafıza aktif.'
      );
    } else if (id === 'xox') {
      void save(
        { ...config, xox: { ...config.xox, enabled: !config.xox.enabled } },
        config.xox.enabled ? 'XOX kapatıldı.' : 'XOX aktif.'
      );
    } else if (id === 'detective') {
      void save(
        { ...config, detective: { ...config.detective, enabled: !config.detective.enabled } },
        config.detective.enabled ? 'Menü Dedektifi kapatıldı.' : 'Menü Dedektifi aktif.'
      );
    } else {
      void save(
        { ...config, blitz: { ...config.blitz, enabled: !config.blitz.enabled } },
        config.blitz.enabled ? 'Sipariş Blitz kapatıldı.' : 'Sipariş Blitz aktif.'
      );
    }
  }

  function isActive(id: GameCardId) {
    if (!config.enabled) return false;
    if (id === 'memory') return config.memory.enabled;
    if (id === 'xox') return config.xox.enabled;
    if (id === 'detective') return config.detective.enabled;
    return config.blitz.enabled;
  }

  function openSettings(id: GameCardId) {
    if (id === 'memory') setMemoryOpen(true);
    if (id === 'detective') setDetectiveOpen(true);
  }

  return (
    <div>
      <PageHeader title="Oyun Ekranı" />
      <p className="text-sm admin-text-muted -mt-4 mb-6 max-w-2xl">
        Menü yan panelindeki oyunları açıp kapatın. Garson çağrılınca misafire oyun önerisi gösterilir.
      </p>

      {message ? (
        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-700">
                <Gamepad2 className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="font-bold text-slate-900">Menü oyunları</p>
                <p className="text-xs text-slate-500">Ana anahtar — kapalıyken hiçbir oyun görünmez</p>
              </div>
            </div>
            <Button type="button" disabled={saving} onClick={toggleMaster}>
              {config.enabled ? 'Aktifi kapat' : 'Aktif et'}
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {GAME_CARDS.map((game) => {
              const active = isActive(game.id);
              return (
                <div
                  key={game.id}
                  className={`relative rounded-2xl border bg-white p-4 shadow-sm transition ${
                    active ? 'border-sky-400 ring-2 ring-sky-100' : 'border-slate-200'
                  }`}
                >
                  {active ? (
                    <span className="absolute top-3 right-3 grid h-7 w-7 place-items-center rounded-full bg-sky-500 text-white">
                      <Check className="w-4 h-4" strokeWidth={2.5} />
                    </span>
                  ) : null}

                  <p className="text-[0.68rem] font-extrabold uppercase tracking-wide text-slate-400 mb-1">
                    {game.free ? 'Ücretsiz' : 'Eklenti'}
                  </p>
                  <h3 className="text-lg font-bold text-slate-900 pr-8">{game.name}</h3>
                  <p className="mt-1.5 text-sm text-slate-500 leading-snug min-h-[2.6rem]">{game.blurb}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={saving || !config.enabled}
                      onClick={() => toggleGame(game.id)}
                    >
                      {active ? 'Kapat' : 'Aktif et'}
                    </Button>
                    {game.hasSettings ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!config.enabled}
                        onClick={() => openSettings(game.id)}
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        Ayarlar
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <MemoryGameSettingsModal
        open={memoryOpen}
        config={config}
        saving={saving}
        onClose={() => setMemoryOpen(false)}
        onSave={async (next) => {
          await save(next, 'Hafıza ayarları kaydedildi.');
          setMemoryOpen(false);
        }}
      />
      <DetectiveGameSettingsModal
        open={detectiveOpen}
        config={config}
        saving={saving}
        onClose={() => setDetectiveOpen(false)}
        onSave={async (next) => {
          await save(next, 'Menü Dedektifi ayarları kaydedildi.');
          setDetectiveOpen(false);
        }}
      />
    </div>
  );
}
