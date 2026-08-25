import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMenuSlug } from '@/hooks/useMenuSlug';
import { enteredKey, menuHomePath } from '@/lib/menuPaths';
import { Volume2, VolumeX, Sparkles, Music2, MessageCircleHeart, Lightbulb } from 'lucide-react';
import { api, imageUrl } from '@/lib/api';
import { languageFlag } from '@/lib/languageFlags';
import ComplaintBoxModal from '@/components/public/ComplaintBoxModal';
import SuggestionBoxModal from '@/components/public/SuggestionBoxModal';
import WelcomeSceneBackground from '@/components/public/WelcomeSceneBackground';
import { usePublicRtl } from '@/hooks/usePublicRtl';

interface WelcomeData {
  restaurant: { id: number; name: string; slug: string; logoUrl?: string | null };
  languages: { code: string; name: string }[];
  welcomeByLang: Record<string, string>;
  welcomeMusicUrl?: string | null;
  theme?: string;
}

const MUSIC_SOURCES = (custom?: string | null) =>
  [
    custom,
    'https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb749913b.mp3?filename=ambient-background-339801.mp3',
    'https://cdn.pixabay.com/download/audio/2022/03/24/audio_c8c8a73467.mp3?filename=lofi-study-112191.mp3',
  ].filter(Boolean) as string[];

export default function PublicWelcomePage() {
  const { slug, error: slugError } = useMenuSlug();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tableNo = searchParams.get('masa');
  const campaignSlug = searchParams.get('kampanya');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [data, setData] = useState<WelcomeData | null>(null);
  const [selectedLang, setSelectedLang] = useState(
    () => localStorage.getItem('menu_lang') || 'tr'
  );
  const [musicOn, setMusicOn] = useState(
    () => localStorage.getItem('menu_music_muted') !== 'true'
  );
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicBlocked, setMusicBlocked] = useState(false);
  const [entering, setEntering] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  usePublicRtl(selectedLang);

  useEffect(() => {
    if (tableNo) sessionStorage.setItem('menu_masa', tableNo);
    if (campaignSlug) sessionStorage.setItem('menu_kampanya', campaignSlug);
  }, [tableNo, campaignSlug]);

  useEffect(() => {
    if (slugError) {
      setLoadError(slugError);
      setLoading(false);
      return;
    }
    if (!slug) return;

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    api<WelcomeData>(`/api/menu/${slug}/welcome`)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Menü yüklenemedi. Sunucunun çalıştığından emin olun.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug, navigate]);

  function retryLoad() {
    if (!slug) return;
    setLoading(true);
    setLoadError(null);
    api<WelcomeData>(`/api/menu/${slug}/welcome`)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch(() => {
        setLoadError('Hâlâ bağlanamıyoruz. Backend: npm run dev');
        setLoading(false);
      });
  }

  useEffect(() => {
    if (!data) return;
    const sources = MUSIC_SOURCES(data.welcomeMusicUrl);
    let sourceIndex = 0;
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0.28;
    audio.preload = 'auto';

    const loadSource = (index: number) => {
      if (index >= sources.length) return;
      sourceIndex = index;
      audio.src = sources[index];
      audio.load();
    };

    const onPlay = () => {
      setMusicPlaying(true);
      setMusicBlocked(false);
    };
    const onPause = () => setMusicPlaying(false);
    const onError = () => loadSource(sourceIndex + 1);

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
    loadSource(0);
    audioRef.current = audio;

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      audio.pause();
      audioRef.current = null;
    };
  }, [data]);

  useEffect(() => {
    if (!data) return;
    const t = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(t);
  }, [data]);

  const tryPlayMusic = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !musicOn) return false;
    try {
      await audio.play();
      setMusicBlocked(false);
      return true;
    } catch {
      setMusicBlocked(true);
      return false;
    }
  }, [musicOn]);

  useEffect(() => {
    if (!data || !musicOn) {
      audioRef.current?.pause();
      return;
    }
    tryPlayMusic();
    localStorage.setItem('menu_music_muted', 'false');
  }, [data, musicOn, tryPlayMusic]);

  useEffect(() => {
    if (!musicBlocked || !musicOn) return;

    const unlock = () => {
      tryPlayMusic();
    };

    document.addEventListener('pointerdown', unlock, { once: true });
    return () => document.removeEventListener('pointerdown', unlock);
  }, [musicBlocked, musicOn, tryPlayMusic]);

  function toggleMusic() {
    setMusicOn((v) => {
      const next = !v;
      localStorage.setItem('menu_music_muted', next ? 'false' : 'true');
      if (next) {
        tryPlayMusic();
      } else {
        audioRef.current?.pause();
        setMusicBlocked(false);
      }
      return next;
    });
  }

  function enterMenu(lang: string) {
    if (!slug) return;
    setEntering(true);
    localStorage.setItem('menu_lang', lang);
    sessionStorage.setItem(enteredKey(slug), '1');
    audioRef.current?.pause();
    const qs = searchParams.toString();
    setTimeout(() => {
      navigate(qs ? `${menuHomePath()}?${qs}` : menuHomePath());
    }, 450);
  }

  if (loading && !data) {
    return (
      <div className="welcome-scene flex items-center justify-center">
        <WelcomeSceneBackground />
        <div className="welcome-scene__loading">
          <div className="w-10 h-10 border-2 border-white/40 border-t-white rounded-full animate-spin mx-auto" />
          <p className="welcome-scene__loading-text">Yükleniyor…</p>
        </div>
      </div>
    );
  }

  if (loadError && !data) {
    return (
      <div className="welcome-scene flex items-center justify-center p-6">
        <WelcomeSceneBackground />
        <div className="welcome-scene__error login-glass">
          <p className="welcome-scene__error-title">Bağlantı kurulamadı</p>
          <p className="welcome-scene__error-text">{loadError}</p>
          <button type="button" className="welcome-card__enter" onClick={retryLoad}>
            Tekrar Dene
          </button>
          {slug && (
            <button
              type="button"
              className="welcome-card__complaint-link mt-3"
              onClick={() => setComplaintOpen(true)}
            >
              Şikayet kutusunu aç
            </button>
          )}
        </div>
        {slug && (
          <ComplaintBoxModal open={complaintOpen} slug={slug} onClose={() => setComplaintOpen(false)} />
        )}
      </div>
    );
  }

  if (!data) return null;

  const welcomeText =
    data.welcomeByLang[selectedLang] ||
    data.welcomeByLang.tr ||
    Object.values(data.welcomeByLang)[0] ||
    'Dijital menümüze hoş geldiniz.';

  return (
    <div
      className={`welcome-scene ${entering ? 'welcome-scene--exit' : ''} ${revealed ? 'welcome-scene--revealed' : ''}`}
      data-theme-welcome={data.theme || 'vibrant'}
    >
      <WelcomeSceneBackground />

      <button
        type="button"
        className={`welcome-scene__music ${musicBlocked && musicOn ? 'welcome-scene__music--pulse' : ''}`}
        onClick={toggleMusic}
        aria-label={musicOn ? 'Müziği kapat' : 'Müziği aç'}
      >
        {musicOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        <span className="hidden sm:inline">
          {musicBlocked && musicOn
            ? 'Müziği başlat'
            : musicOn
              ? musicPlaying
                ? 'Müzik açık'
                : 'Müzik yükleniyor'
              : 'Müzik kapalı'}
        </span>
      </button>

      <div className="welcome-scene__feedback">
        <button
          type="button"
          className="welcome-scene__feedback-btn welcome-scene__feedback-btn--suggestion"
          onClick={() => setSuggestionOpen(true)}
        >
          <Lightbulb className="w-4 h-4" />
          <span>Öneri Kutusu</span>
        </button>
        <button
          type="button"
          className="welcome-scene__feedback-btn welcome-scene__feedback-btn--complaint"
          onClick={() => setComplaintOpen(true)}
        >
          <MessageCircleHeart className="w-4 h-4" />
          <span>Şikayet Kutusu</span>
        </button>
      </div>

      {musicBlocked && musicOn && (
        <button
          type="button"
          className="welcome-scene__music-hint"
          onClick={() => tryPlayMusic()}
        >
          <Music2 className="w-4 h-4" />
          Sakinleştirici müzik için ekrana dokunun
        </button>
      )}

      <div className="welcome-scene__content">
        <div className="welcome-card login-glass">
          <div className="welcome-card__logo-wrap">
            {data.restaurant.logoUrl ? (
              <img
                src={imageUrl(data.restaurant.logoUrl)}
                alt={data.restaurant.name}
                className="welcome-card__logo"
              />
            ) : (
              <div className="welcome-card__logo-fallback">
                <Sparkles className="w-10 h-10 text-white/90" />
              </div>
            )}
          </div>

          <h1 className="welcome-card__title">{data.restaurant.name}</h1>
          {(tableNo || campaignSlug) && (
            <div className="welcome-card__context">
              {tableNo && <span className="welcome-card__chip">Masa {tableNo}</span>}
              {campaignSlug && (
                <span className="welcome-card__chip welcome-card__chip--campaign">
                  {campaignSlug.replace(/-/g, ' ')}
                </span>
              )}
            </div>
          )}
          <p className="welcome-card__message">{welcomeText}</p>

          <div className="welcome-card__langs">
            <p className="welcome-card__langs-label">Dilinizi seçin</p>
            <div className="welcome-card__lang-grid">
              {data.languages.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  className={`welcome-card__lang ${selectedLang === lang.code ? 'is-active' : ''}`}
                  onClick={() => setSelectedLang(lang.code)}
                >
                  <span className="welcome-card__lang-flag" aria-hidden>
                    {languageFlag(lang.code)}
                  </span>
                  <span>{lang.name}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="welcome-card__enter"
            onClick={() => enterMenu(selectedLang)}
          >
            Menüye Gir
          </button>

          <p className="welcome-card__hint">Deneyiminizi kişiselleştirmek için dil seçimi yapın</p>

          <div className="welcome-card__feedback-links">
            <button
              type="button"
              className="welcome-card__feedback-link welcome-card__feedback-link--suggestion"
              onClick={() => setSuggestionOpen(true)}
            >
              Önerin var mı? Puan ver
            </button>
            <button
              type="button"
              className="welcome-card__feedback-link"
              onClick={() => setComplaintOpen(true)}
            >
              Bir şey mi olmadı?
            </button>
          </div>
        </div>
      </div>

      {slug && (
        <>
          <ComplaintBoxModal
            open={complaintOpen}
            slug={slug}
            onClose={() => setComplaintOpen(false)}
          />
          <SuggestionBoxModal
            open={suggestionOpen}
            slug={slug}
            onClose={() => setSuggestionOpen(false)}
          />
        </>
      )}
    </div>
  );
}
