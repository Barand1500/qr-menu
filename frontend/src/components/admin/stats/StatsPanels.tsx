import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  BarChart3,
  Eye,
  FolderTree,
  Globe2,
  Laptop,
  MonitorSmartphone,
  RefreshCw,
} from 'lucide-react';
import { statNumber, type StatResult, type StatsReport } from './stats-model';

const RevealContext = createContext(false);

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof matchMedia === 'function'
      ? matchMedia('(prefers-reduced-motion: reduce)').matches
      : true,
  );
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

function Reveal({
  children,
  className = '',
  reduced,
}: {
  children: ReactNode;
  className?: string;
  reduced: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(reduced);
  useEffect(() => {
    if (reduced || !('IntersectionObserver' in window)) {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [reduced]);
  return (
    <section
      ref={ref}
      className={'ast-panel ' + className + (seen ? ' is-visible' : '')}
      data-reduced={reduced}
    >
      <RevealContext.Provider value={seen}>{children}</RevealContext.Provider>
    </section>
  );
}

function Counter({ value, reduced }: { value: number; reduced: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useContext(RevealContext);
  useEffect(() => {
    const el = ref.current;
    if (!el || !seen) return;
    if (reduced) {
      el.textContent = statNumber(value);
      return;
    }
    let frame = 0;
    const begin = performance.now();
    const tick = (time: number) => {
      const progress = Math.min(1, (time - begin) / 750);
      el.textContent = statNumber(
        Math.round(value * (1 - Math.pow(1 - progress, 3))),
      );
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced, seen]);
  return (
    <>
      <span ref={ref} aria-hidden="true">
        {statNumber(value)}
      </span>
      <span className="sr-only">{statNumber(value)}</span>
    </>
  );
}

function Empty({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  return (
    <div className="ast-empty" role={failed ? 'alert' : undefined}>
      <BarChart3 size={28} strokeWidth={1.3} />
      <strong>
        {failed ? 'Bu veriler alınamadı.' : 'Henüz görüntülenme yok.'}
      </strong>
      <p>
        {failed
          ? 'Diğer raporları inceleyebilir veya yeniden deneyebilirsiniz.'
          : 'Bu dönemde veri oluştuğunda burada görünecek.'}
      </p>
      {failed && (
        <button onClick={onRetry}>
          <RefreshCw size={14} /> Yeniden dene
        </button>
      )}
    </div>
  );
}

export function RankingPanel({
  kind,
  result,
  onRetry,
  reduced,
}: {
  kind: 'products' | 'groups';
  result: StatResult;
  onRetry: () => void;
  reduced: boolean;
}) {
  const items = result.items.slice(0, 10),
    total = items.reduce((sum, row) => sum + row.count, 0),
    max = items[0]?.count || 1;
  const Icon = kind === 'products' ? Eye : FolderTree;
  return (
    <Reveal reduced={reduced} className={'ast-ranking ast-ranking--' + kind}>
      <header className="ast-panel__head">
        <div>
          <span className="ast-caption">
            <Icon size={15} />
            {kind === 'products' ? 'ÜRÜN İLGİSİ' : 'GRUP İLGİSİ'}
          </span>
          <h2>
            {kind === 'products'
              ? 'Gözler hangi lezzette?'
              : 'Menüde öne çıkanlar'}
          </h2>
        </div>
        <span className="ast-total">
          {result.failed ? '—' : <Counter value={total} reduced={reduced} />}
          <small>İlk {items.length || 10} kayıtta görüntülenme</small>
        </span>
      </header>
      {!items.length ? (
        <Empty failed={result.failed} onRetry={onRetry} />
      ) : (
        <>
          <div className="ast-ranking__labels">
            <span>Sıralama</span>
            <span>Görüntülenme</span>
          </div>
          <ol className="ast-ranking__list">
            {items.map((item, i) => (
              <li
                key={item.id + '-' + i}
                style={{ '--rank-delay': i * 45 + 'ms' } as CSSProperties}
              >
                <span className="ast-rank">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="ast-ranking__copy">
                  <div>
                    <span>{item.name}</span>
                    <strong>
                      <Counter value={item.count} reduced={reduced} />
                    </strong>
                  </div>
                  <span className="ast-bar">
                    <span style={{ width: (item.count / max) * 100 + '%' }} />
                  </span>
                </div>
              </li>
            ))}
          </ol>
          <footer>
            Yalnızca en çok görüntülenen {items.length}{' '}
            {kind === 'products' ? 'ürün' : 'grup'} listelenir.
          </footer>
        </>
      )}
    </Reveal>
  );
}

const AUDIENCES = [
  { id: 'languages', name: 'Diller', Icon: Globe2 },
  { id: 'devices', name: 'Cihazlar', Icon: MonitorSmartphone },
  { id: 'operatingSystems', name: 'Sistemler', Icon: Laptop },
] as const;
const COLORS = [
  'var(--admin-accent)',
  '#8193b0',
  '#8db6cc',
  '#b3a2c5',
  '#81b5a0',
  '#c8af89',
  '#a7b8d1',
  '#c0c8d3',
  '#8aabb2',
  '#b9b0a2',
  '#c6b2ba',
  '#a9bca1',
];

export function AudiencePanel({
  report,
  onRetry,
  reduced,
}: {
  report: StatsReport;
  onRetry: () => void;
  reduced: boolean;
}) {
  const [tab, setTab] = useState<(typeof AUDIENCES)[number]['id']>('languages');
  const [active, setActive] = useState(0);
  const uid = useId();
  const items = report[tab].items,
    total = items.reduce((sum, row) => sum + row.count, 0),
    selected = items[Math.min(active, items.length - 1)];
  let offset = 0;
  const currentName = AUDIENCES.find((a) => a.id === tab)!.name;
  function chooseTab(id: typeof tab) {
    setTab(id);
    setActive(0);
  }
  return (
    <Reveal reduced={reduced} className="ast-audience">
      <header className="ast-panel__head">
        <div>
          <span className="ast-caption">
            <Globe2 size={15} />
            MENÜNÜZE AÇILAN PENCERE
          </span>
          <h2>Nasıl keşfediliyor?</h2>
        </div>
        <div
          className="ast-tabs"
          role="tablist"
          aria-label="Görüntülenme dağılımı"
        >
          {AUDIENCES.map(({ id, name, Icon }, index) => (
            <button
              key={id}
              id={uid + '-' + id}
              aria-controls={uid + '-panel'}
              role="tab"
              aria-selected={tab === id}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => chooseTab(id)}
              onKeyDown={(event) => {
                const next =
                  event.key === 'ArrowRight'
                    ? (index + 1) % 3
                    : event.key === 'ArrowLeft'
                      ? (index + 2) % 3
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? 2
                          : -1;
                if (next < 0) return;
                event.preventDefault();
                chooseTab(AUDIENCES[next].id);
                document
                  .getElementById(uid + '-' + AUDIENCES[next].id)
                  ?.focus();
              }}
            >
              <Icon size={15} />
              <span>{name}</span>
            </button>
          ))}
        </div>
      </header>
      <div
        role="tabpanel"
        id={uid + '-panel'}
        aria-labelledby={uid + '-' + tab}
        className="ast-audience__content"
        key={tab}
      >
        {!items.length ? (
          <Empty failed={report[tab].failed} onRetry={onRetry} />
        ) : (
          <>
            <div className="ast-orbit">
              <svg viewBox="0 0 220 220" aria-hidden="true">
                <circle
                  className="ast-ring-track"
                  cx="110"
                  cy="110"
                  r="83"
                  fill="none"
                  strokeWidth="18"
                />
                {items.map((item, i) => {
                  const share = (item.count / total) * 100,
                    draw = share - Math.min(0.9, share * 0.1),
                    start = offset;
                  offset += share;
                  return (
                    <circle
                      key={item.id + '-' + i}
                      cx="110"
                      cy="110"
                      r="83"
                      pathLength="100"
                      fill="none"
                      strokeWidth={active === i ? 22 : 18}
                      stroke={COLORS[i % COLORS.length]}
                      strokeDasharray={draw + ' ' + (100 - draw)}
                      strokeDashoffset={-start}
                      transform="rotate(-90 110 110)"
                      style={
                        {
                          '--slice': draw + ' ' + (100 - draw),
                          opacity: active === i ? 1 : 0.6,
                        } as CSSProperties
                      }
                      onPointerEnter={() => setActive(i)}
                    />
                  );
                })}
              </svg>
              <div className="ast-orbit__center">
                <small>GÖRÜNTÜLENME PAYI</small>
                <strong>
                  {selected
                    ? ((selected.count / total) * 100).toLocaleString('tr-TR', {
                        maximumFractionDigits: 1,
                      })
                    : 0}
                  <span>%</span>
                </strong>
                <span>{selected?.name}</span>
              </div>
            </div>
            <div className="ast-audience__breakdown">
              <div className="ast-audience__summary">
                <span>{currentName}</span>
                <strong>{statNumber(total)} görüntülenme</strong>
              </div>
              <ul>
                {items.map((item, i) => (
                  <li key={item.id + '-' + i}>
                    <button
                      aria-pressed={active === i}
                      onClick={() => setActive(i)}
                      onFocus={() => setActive(i)}
                      className={active === i ? 'is-active' : ''}
                    >
                      <i style={{ background: COLORS[i % COLORS.length] }} />
                      <span>{item.name}</span>
                      <strong>{statNumber(item.count)}</strong>
                      <small>
                        {((item.count / total) * 100).toLocaleString('tr-TR', {
                          maximumFractionDigits: 1,
                        })}
                        %
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
      <footer>
        Dağılım, seçilen dönemde bu bilginin kaydedildiği görüntülenmelere
        aittir; tekil ziyaretçi sayısı değildir.
      </footer>
    </Reveal>
  );
}

export function StatsSkeleton() {
  return (
    <div
      className="ast-skeleton"
      role="status"
      aria-label="İstatistikler yükleniyor"
    >
      {[0, 1].map((i) => (
        <div key={i}>
          <span />
          <b />
          {[0, 1, 2, 3, 4].map((j) => (
            <i key={j} />
          ))}
        </div>
      ))}
    </div>
  );
}
