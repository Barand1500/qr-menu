import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Gamepad2,
  Image,
  Loader2,
  Play,
  Settings2,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button, PageHeader, Spinner } from '@/components/ui';
import AdminToast, {
  type AdminToastNotice,
} from '@/components/admin/AdminToast';
import AdminOverlay from '@/components/admin/AdminOverlay';
import DetectiveGameSettingsModal from '@/components/admin/DetectiveGameSettingsModal';
import MemoryGameSettingsModal from '@/components/admin/MemoryGameSettingsModal';
import GameArtwork from '@/components/admin/games/GameArtwork';
import GamePreview from '@/components/admin/games/GamePreview';
import type { MenuGamesConfig } from '@/lib/menuGamesConfig';
import '@/components/admin/games/games-screen.css';

export type GameCardId = 'memory' | 'xox' | 'detective' | 'blitz';
const GAMES: {
  id: GameCardId;
  name: string;
  mode: string;
  description: string;
  settings?: string;
}[] = [
  {
    id: 'memory',
    name: 'Hafıza',
    mode: 'Tek kişilik',
    description: 'Bir kart, bir eş. İsterseniz tamamen sizin görsellerinizle.',
    settings: 'Kartları düzenle',
  },
  {
    id: 'xox',
    name: 'XOX',
    mode: 'Aynı masa',
    description: 'İki misafir, dokuz kare. Masada küçük bir rekabet.',
  },
  {
    id: 'detective',
    name: 'Menü Dedektifi',
    mode: 'Tek kişilik',
    description: 'Merak eden kazanır. Kendi sorularınızla oyuna renk katın.',
    settings: 'Soruları düzenle',
  },
  {
    id: 'blitz',
    name: 'Sipariş Blitz',
    mode: 'Tek kişilik',
    description: 'Siparişi aklında tut, doğru lezzetleri süre dolmadan bul.',
  },
];

export default function GamesScreenPage() {
  const [config, setConfig] = useState<MenuGamesConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<AdminToastNotice>(null);
  const [selected, setSelected] = useState<GameCardId>('memory');
  const [settings, setSettings] = useState<'memory' | 'detective' | null>(null);
  const [preview, setPreview] = useState<GameCardId | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api<{ config: MenuGamesConfig }>(
        '/api/admin/settings/menu-games',
      );
      if (!res.config) throw new Error('Ayarlar alınamadı.');
      if (mounted.current) setConfig(res.config);
    } catch {
      if (mounted.current) setLoadError(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function save(next: MenuGamesConfig, message: string) {
    if (lock.current) return false;
    lock.current = true;
    setSaving(true);
    try {
      const res = await api<{ config: MenuGamesConfig }>(
        '/api/admin/settings/menu-games',
        { method: 'PUT', body: JSON.stringify(next) },
      );
      if (!res.config) throw new Error('Ayarlar kaydedilemedi.');
      if (mounted.current) {
        setConfig(res.config);
        setNotice({ error: false, text: message });
      }
      return true;
    } catch (err) {
      if (mounted.current)
        setNotice({
          error: true,
          text:
            err instanceof Error
              ? err.message
              : 'Kaydedilemedi. Yeniden deneyin.',
        });
      return false;
    } finally {
      lock.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  const current = GAMES.find((g) => g.id === selected)!;
  const activeCount = config
    ? GAMES.filter((g) => config[g.id].enabled).length
    : 0;
  function openSettings(id: GameCardId) {
    if (id === 'memory' || id === 'detective') setSettings(id);
  }

  return (
    <div className="ags-page">
      <PageHeader
        title="Oyun Ekranı"
        subtitle="Misafirleriniz beklerken, oyun başlasın."
      />
      <AdminToast notice={notice} onClose={() => setNotice(null)} />
      {loading ? (
        <Spinner />
      ) : loadError || !config ? (
        <section className="ags-error" role="alert">
          <Gamepad2 size={32} />
          <h2>Oyun ayarları yüklenemedi.</h2>
          <p>Mevcut ayarlarınız değiştirilmedi.</p>
          <Button variant="secondary" onClick={() => void load()}>
            Tekrar dene
          </Button>
        </section>
      ) : (
        <>
          <div className="ags-master">
            <span className="ags-master__icon">
              <Gamepad2 size={23} />
            </span>
            <div className="ags-master__copy">
              <strong>Menüde oyunlar</strong>
              <p>
                {config.enabled
                  ? activeCount + ' oyun misafirlerinize açık'
                  : 'Tüm oyunlar gizli · seçimleriniz korunuyor'}
              </p>
            </div>
            {saving && (
              <Loader2
                className="ags-saving"
                size={17}
                aria-label="Kaydediliyor"
              />
            )}
            <button
              role="switch"
              aria-checked={config.enabled}
              aria-label="Menü oyunlarını göster"
              className="ags-switch"
              disabled={saving}
              onClick={() =>
                void save(
                  { ...config, enabled: !config.enabled },
                  config.enabled
                    ? 'Oyunlar menüden gizlendi.'
                    : 'Oyunlar menüde gösteriliyor.',
                )
              }
            >
              <span />
            </button>
          </div>
          <div className="ags-workspace">
            <section className="ags-library" aria-label="Oyunlar">
              <div className="ags-library__heading">
                <span>OYUN SEÇKİSİ</span>
                <span>04</span>
              </div>
              {GAMES.map((game, i) => (
                <article
                  key={game.id}
                  className={
                    'ags-row ' +
                    (selected === game.id ? 'is-selected ' : '') +
                    (!config.enabled || !config[game.id].enabled
                      ? 'is-off'
                      : '')
                  }
                >
                  <button
                    className="ags-row__select"
                    onClick={() => {
                      setSelected(game.id);
                      if (window.matchMedia('(max-width: 767px)').matches)
                        setPreview(game.id);
                    }}
                    aria-label={game.name + ' ayrıntıları'}
                    aria-pressed={selected === game.id}
                  >
                    <span className="ags-row__number">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="ags-row__text">
                      <small>{game.mode}</small>
                      <strong>{game.name}</strong>
                      <span>{game.description}</span>
                    </span>
                    <ChevronRight size={17} className="ags-row__chevron" />
                  </button>
                  <button
                    className="ags-switch"
                    role="switch"
                    aria-label={game.name + ' oyununu göster'}
                    aria-checked={config[game.id].enabled}
                    disabled={saving || !config.enabled}
                    onClick={() =>
                      void save(
                        {
                          ...config,
                          [game.id]: {
                            ...config[game.id],
                            enabled: !config[game.id].enabled,
                          },
                        },
                        game.name +
                          (config[game.id].enabled
                            ? ' menüden gizlendi.'
                            : ' menüde gösteriliyor.'),
                      )
                    }
                  >
                    <span />
                  </button>
                  <div className="ags-row__actions">
                    <button
                      onClick={() => {
                        setSelected(game.id);
                        setPreview(game.id);
                      }}
                    >
                      <Play size={14} /> Dene
                    </button>
                    {game.settings && (
                      <button
                        disabled={saving}
                        onClick={() => openSettings(game.id)}
                      >
                        <Settings2 size={14} />
                        {game.settings}
                      </button>
                    )}
                    <span>
                      {config.enabled && config[game.id].enabled
                        ? 'Menüde açık'
                        : 'Menüde gizli'}
                    </span>
                  </div>
                </article>
              ))}
              <p className="ags-library__note">
                <Check size={14} /> Değişiklikleriniz anında kaydedilir.
              </p>
            </section>
            <aside className="ags-stage" aria-label="Seçilen oyun">
              <div className="ags-stage__top">
                <span>YAKINDAN BAK</span>
                <span>{current.mode}</span>
              </div>
              <div key={selected} className="ags-stage__scene">
                <GameArtwork game={selected} />
              </div>
              <div className="ags-stage__details" key={'details-' + selected}>
                <h2>{current.name}</h2>
                <p>{current.description}</p>
                <div className="ags-facts">
                  <span>
                    {selected === 'memory'
                      ? config.memory.pairCount + ' çift kart'
                      : selected === 'detective'
                        ? config.detective.questions.length
                          ? config.detective.questions.length + ' özel soru'
                          : 'Hazır soru havuzu'
                        : selected === 'xox'
                          ? 'İki kişilik'
                          : 'Hız & hafıza'}
                  </span>
                  <span>
                    {selected === 'memory'
                      ? config.memory.pairs.length + ' özel görsel çifti'
                      : selected === 'xox'
                        ? 'Masa koduyla eşleşir'
                        : selected === 'detective'
                          ? 'Kendi sorularınızı ekleyin'
                          : 'Menü ürünleriyle oynanır'}
                  </span>
                </div>
                <Button onClick={() => setPreview(selected)}>
                  <Play size={16} /> Oyunu dene <ArrowUpRight size={16} />
                </Button>
                {current.settings && (
                  <button
                    className="ags-stage__settings"
                    disabled={saving}
                    onClick={() => openSettings(selected)}
                  >
                    {selected === 'memory' ? (
                      <Image size={16} />
                    ) : (
                      <Settings2 size={16} />
                    )}
                    {current.settings}
                  </button>
                )}
              </div>
            </aside>
          </div>
          <MemoryGameSettingsModal
            open={settings === 'memory'}
            config={config}
            saving={saving}
            onClose={() => setSettings(null)}
            onSave={async (next) => {
              if (await save(next, 'Hafıza ayarları kaydedildi.'))
                setSettings(null);
            }}
          />
          <DetectiveGameSettingsModal
            open={settings === 'detective'}
            config={config}
            saving={saving}
            onClose={() => setSettings(null)}
            onSave={async (next) => {
              if (await save(next, 'Sorular kaydedildi.')) setSettings(null);
            }}
          />
          {preview && (
            <AdminOverlay
              label={GAMES.find((g) => g.id === preview)!.name + ' denemesi'}
              onClose={() => setPreview(null)}
              className="ags-preview-overlay"
            >
              <section className="relative ags-preview">
                <header>
                  <div>
                    <small>DENEME ALANI</small>
                    <h2>{GAMES.find((g) => g.id === preview)!.name}</h2>
                  </div>
                  <button
                    aria-label="Denemeyi kapat"
                    onClick={() => setPreview(null)}
                  >
                    <X size={21} />
                  </button>
                </header>
                <div className="ags-preview__body">
                  <GamePreview game={preview} config={config} />
                </div>
                <footer>
                  Denemek, menüdeki açık / kapalı seçiminizi değiştirmez.
                </footer>
              </section>
            </AdminOverlay>
          )}
        </>
      )}
    </div>
  );
}
