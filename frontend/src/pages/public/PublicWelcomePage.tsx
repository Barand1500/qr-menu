import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMenuSlug } from '@/hooks/useMenuSlug';
import { enteredKey, menuHomePath } from '@/lib/menuPaths';
import { Volume2, VolumeX, Sparkles, MessageCircleHeart, Lightbulb } from 'lucide-react';
import { api, imageUrl } from '@/lib/api';
import { languageFlag } from '@/lib/languageFlags';
import ComplaintBoxModal from '@/components/public/ComplaintBoxModal';
import SuggestionBoxModal from '@/components/public/SuggestionBoxModal';
import WelcomeSceneBackground from '@/components/public/WelcomeSceneBackground';
import PublicSocialLinks from '@/components/public/PublicSocialLinks';
import { usePublicRtl } from '@/hooks/usePublicRtl';
import type { PublicSocialLink } from '@/lib/socialCatalog';
import { welcomeUi } from '@/lib/welcomeUi';
import {
  ALLERGEN_CATALOG,
  DIET_CATALOG,
  allergenLabel,
  dietLabel,
  loadDietaryPrefs,
  preferenceUi,
  saveDietaryPrefs,
  type DietaryPrefs,
} from '@/lib/dietAllergens';
import { resolveWelcomeMusic, youtubeEmbedSrc } from '@/lib/welcomeMusic';

interface WelcomeData {
  restaurant: { id: number; name: string; slug: string; logoUrl?: string | null };
  languages: { code: string; name: string }[];
  welcomeByLang: Record<string, string>;
  welcomeMusicUrl?: string | null;
  theme?: string;
  campaign?: { name: string; slug: string; itemCount: number } | null;
  socialLinks?: PublicSocialLink[];
}

export default function PublicWelcomePage() {
  const { slug, error: slugError } = useMenuSlug();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tableNo = searchParams.get('masa');
  const groupSlug = searchParams.get('grup');
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
  const [ytEmbedSrc, setYtEmbedSrc] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [welcomeStep, setWelcomeStep] = useState<'lang' | 'prefs'>('lang');
  const [prefsPanelIn, setPrefsPanelIn] = useState(false);
  const [dietaryPrefs, setDietaryPrefs] = useState<DietaryPrefs>(() => loadDietaryPrefs());
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  usePublicRtl(selectedLang);

  useEffect(() => {
    if (tableNo) sessionStorage.setItem('menu_masa', tableNo);
    if (groupSlug) sessionStorage.setItem('menu_grup', groupSlug);
    if (campaignSlug) sessionStorage.setItem('menu_kampanya', campaignSlug);
  }, [tableNo, groupSlug, campaignSlug]);

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

    const welcomeParams = new URLSearchParams();
    if (campaignSlug) welcomeParams.set('kampanya', campaignSlug);
    const welcomeQs = welcomeParams.toString();

    api<WelcomeData>(`/api/menu/${slug}/welcome${welcomeQs ? `?${welcomeQs}` : ''}`)
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
  }, [slug, navigate, campaignSlug]);

  function retryLoad() {
    if (!slug) return;
    setLoading(true);
    setLoadError(null);
    const welcomeParams = new URLSearchParams();
    if (campaignSlug) welcomeParams.set('kampanya', campaignSlug);
    const welcomeQs = welcomeParams.toString();
    api<WelcomeData>(`/api/menu/${slug}/welcome${welcomeQs ? `?${welcomeQs}` : ''}`)
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
    const resolved = resolveWelcomeMusic(data.welcomeMusicUrl);

    if (resolved.kind === 'youtube') {
      audioRef.current?.pause();
      audioRef.current = null;
      return;
    }

    setYtEmbedSrc(null);
    const sources = resolved.audioSources;
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
    if (!musicOn || !data) return false;
    const resolved = resolveWelcomeMusic(data.welcomeMusicUrl);

    if (resolved.kind === 'youtube' && resolved.youtubeId) {
      setYtEmbedSrc(youtubeEmbedSrc(resolved.youtubeId));
      setMusicPlaying(true);
      setMusicBlocked(false);
      return true;
    }

    const audio = audioRef.current;
    if (!audio) return false;
    try {
      await audio.play();
      setMusicBlocked(false);
      return true;
    } catch {
      setMusicBlocked(true);
      return false;
    }
  }, [musicOn, data]);

  useEffect(() => {
    if (!data || !musicOn) {
      audioRef.current?.pause();
      setYtEmbedSrc(null);
      setMusicPlaying(false);
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
        void tryPlayMusic();
      } else {
        audioRef.current?.pause();
        setYtEmbedSrc(null);
        setMusicPlaying(false);
        setMusicBlocked(false);
      }
      return next;
    });
  }

  function goToPrefs() {
    localStorage.setItem('menu_lang', selectedLang);
    setWelcomeStep('prefs');
    requestAnimationFrame(() => setPrefsPanelIn(true));
  }

  function toggleWelcomeAllergen(id: string) {
    setDietaryPrefs((prev) => {
      const allergens = prev.allergens.includes(id)
        ? prev.allergens.filter((x) => x !== id)
        : [...prev.allergens, id];
      return { ...prev, allergens };
    });
  }

  function toggleWelcomeDiet(id: string) {
    setDietaryPrefs((prev) => {
      let diets = prev.diets.includes(id)
        ? prev.diets.filter((x) => x !== id)
        : [...prev.diets, id];
      if (id === 'vegan' && !prev.diets.includes('vegan') && !diets.includes('vegetarian')) {
        diets = [...diets, 'vegetarian'];
      }
      return { ...prev, diets };
    });
  }

  function enterMenu(lang: string, prefs?: DietaryPrefs) {
    if (!slug) return;
    const nextPrefs = prefs ?? dietaryPrefs;
    saveDietaryPrefs(nextPrefs);
    setEntering(true);
    localStorage.setItem('menu_lang', lang);
    sessionStorage.setItem(enteredKey(slug), '1');
    audioRef.current?.pause();
    setYtEmbedSrc(null);
    const qs = searchParams.toString();
    setTimeout(() => {
      navigate(qs ? `${menuHomePath()}?${qs}` : menuHomePath());
    }, 450);
  }

  const t = welcomeUi(selectedLang);
  const prefUi = preferenceUi(selectedLang);

  if (loading && !data) {
    return (
      <div className="welcome-scene flex items-center justify-center">
        <WelcomeSceneBackground theme="vibrant" />
        <div className="welcome-scene__loading">
          <div className="w-10 h-10 border-2 border-white/40 border-t-white rounded-full animate-spin mx-auto" />
          <p className="welcome-scene__loading-text">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (loadError && !data) {
    return (
      <div className="welcome-scene flex items-center justify-center p-6">
        <WelcomeSceneBackground theme="vibrant" />
        <div className="welcome-scene__error login-glass">
          <p className="welcome-scene__error-title">{t.connectionFailed}</p>
          <p className="welcome-scene__error-text">{loadError}</p>
          <button type="button" className="welcome-card__enter" onClick={retryLoad}>
            {t.tryAgain}
          </button>
          {slug && (
            <button
              type="button"
              className="welcome-card__complaint-link mt-3"
              onClick={() => setComplaintOpen(true)}
            >
              {t.openComplaint}
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

  const musicLabel =
    musicBlocked && musicOn
      ? t.musicStart
      : musicOn
        ? musicPlaying
          ? t.musicOn
          : t.musicLoading
        : t.musicOff;

  return (
    <div
      className={`welcome-scene ${entering ? 'welcome-scene--exit' : ''} ${revealed ? 'welcome-scene--revealed' : ''}`}
      data-theme-welcome={data.theme || 'vibrant'}
    >
      <WelcomeSceneBackground theme={data.theme || 'vibrant'} />

      {ytEmbedSrc ? (
        <iframe
          className="welcome-scene__yt-audio"
          src={ytEmbedSrc}
          title="Karşılama müziği"
          allow="autoplay; encrypted-media"
          tabIndex={-1}
        />
      ) : null}

      <button
        type="button"
        className={`welcome-scene__music ${musicBlocked && musicOn ? 'welcome-scene__music--pulse' : ''}`}
        onClick={toggleMusic}
        aria-label={musicOn ? t.musicAriaOn : t.musicAriaOff}
      >
        {musicOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        <span className="hidden sm:inline">{musicLabel}</span>
      </button>

      <div className="welcome-scene__feedback">
        <button
          type="button"
          className="welcome-scene__feedback-btn welcome-scene__feedback-btn--suggestion"
          onClick={() => setSuggestionOpen(true)}
        >
          <Lightbulb className="w-4 h-4" />
          <span>{t.suggestionBox}</span>
        </button>
        <button
          type="button"
          className="welcome-scene__feedback-btn welcome-scene__feedback-btn--complaint"
          onClick={() => setComplaintOpen(true)}
        >
          <MessageCircleHeart className="w-4 h-4" />
          <span>{t.complaintBox}</span>
        </button>
      </div>

      <div className="welcome-scene__content">
        <div
          className={`welcome-card login-glass ${
            welcomeStep === 'prefs' ? 'welcome-card--prefs-active' : ''
          }`}
        >
          <div
            className={`welcome-card__panel welcome-card__panel--lang ${
              welcomeStep === 'lang' ? 'is-active' : 'is-exit'
            }`}
            aria-hidden={welcomeStep !== 'lang'}
          >
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
            {(tableNo || groupSlug || campaignSlug) && (
              <div className="welcome-card__context">
                {(tableNo || groupSlug) && (
                  <span className="welcome-card__chip">
                    {groupSlug
                      ? `${groupSlug.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}${
                          tableNo ? ` · ${t.table} ${tableNo}` : ''
                        }`
                      : `${t.table} ${tableNo}`}
                  </span>
                )}
                {campaignSlug && (
                  <span className="welcome-card__chip welcome-card__chip--campaign">
                    {data?.campaign?.name || t.campaign}
                  </span>
                )}
              </div>
            )}
            <p className="welcome-card__message">{welcomeText}</p>

            <div className="welcome-card__langs">
              <p className="welcome-card__langs-label">{t.chooseLanguage}</p>
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

            <button type="button" className="welcome-card__enter" onClick={goToPrefs}>
              {t.enterMenu}
            </button>

            {data.socialLinks && data.socialLinks.length > 0 && (
              <PublicSocialLinks links={data.socialLinks} className="welcome-card__social" />
            )}

            <p className="welcome-card__hint">{t.hint}</p>

            <div className="welcome-card__feedback-links">
              <button
                type="button"
                className="welcome-card__feedback-link welcome-card__feedback-link--suggestion"
                onClick={() => setSuggestionOpen(true)}
              >
                {t.suggestionCta}
              </button>
              <button
                type="button"
                className="welcome-card__feedback-link"
                onClick={() => setComplaintOpen(true)}
              >
                {t.complaintCta}
              </button>
            </div>
          </div>

          <div
            className={`welcome-card__panel welcome-card__panel--prefs ${
              welcomeStep === 'prefs' && prefsPanelIn ? 'is-active' : ''
            } ${welcomeStep === 'prefs' && !prefsPanelIn ? 'is-enter' : ''}`}
            aria-hidden={welcomeStep !== 'prefs'}
          >
            <button
              type="button"
              className="welcome-prefs__back"
              onClick={() => {
                setPrefsPanelIn(false);
                setWelcomeStep('lang');
              }}
            >
              ←
            </button>
            <p className="welcome-prefs__eyebrow">{data.restaurant.name}</p>
            <h2 className="welcome-prefs__title">{prefUi.title}</h2>
            <p className="welcome-prefs__hint">{prefUi.hint}</p>

            <div className="welcome-prefs__block">
              <p className="welcome-prefs__label">{prefUi.avoidTitle}</p>
              <div className="welcome-prefs__chips">
                {ALLERGEN_CATALOG.map((opt) => {
                  const active = dietaryPrefs.allergens.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`welcome-prefs__chip${active ? ' is-active' : ''}`}
                      onClick={() => toggleWelcomeAllergen(opt.id)}
                      aria-pressed={active}
                    >
                      {allergenLabel(opt.id, selectedLang)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="welcome-prefs__block">
              <p className="welcome-prefs__label">{prefUi.dietTitle}</p>
              <div className="welcome-prefs__chips">
                {DIET_CATALOG.map((opt) => {
                  const active = dietaryPrefs.diets.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`welcome-prefs__chip welcome-prefs__chip--diet${active ? ' is-active' : ''}`}
                      onClick={() => toggleWelcomeDiet(opt.id)}
                      aria-pressed={active}
                    >
                      {dietLabel(opt.id, selectedLang)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="welcome-prefs__actions">
              <button
                type="button"
                className="welcome-card__enter"
                onClick={() => enterMenu(selectedLang)}
              >
                {prefUi.continue}
              </button>
              <button
                type="button"
                className="welcome-prefs__skip"
                onClick={() => enterMenu(selectedLang, { allergens: [], diets: [] })}
              >
                {prefUi.skip}
              </button>
            </div>
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
