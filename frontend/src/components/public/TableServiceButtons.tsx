import { useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  BellRing,
  CarFront,
  HandHelping,
  LoaderCircle,
  ReceiptText,
  X,
} from "lucide-react";
import { api, isCodeRequiredError } from "@/lib/api";
import { useMenuSlug } from "@/hooks/useMenuSlug";
import { resolveTableContext } from "@/lib/tableContext";
import { notifyTableRequestCreated } from "@/lib/tableRequestNotify";
import { notifyServiceCallConfirmed } from "@/lib/serviceCallFeedback";
import { useTableSessionCode } from "@/components/public/TableSessionCodeGate";
import { useSheetFocus, useSheetPresence } from "./sofra/SofraSheet";
import SahneActivityArt from "./sahne/SahneActivityArt";
import "./service-menu.css";
import HookahIcon from './HookahIcon';

// Per-service administration switches will be added separately.
const SERVICES = [
  {
    kind: "waiter",
    Icon: HandHelping,
    tr: "Garson",
    en: "Waiter",
    detail: "Masanız için bir yardım eli.",
    detailEn: "A helping hand for your table.",
  },
  {
    kind: "bill",
    Icon: ReceiptText,
    tr: "Hesap",
    en: "Bill",
    detail: "Hesabı masanıza getirelim.",
    detailEn: "Let us bring the bill to your table.",
  },
  {
    kind: "hookah",
    Icon: HookahIcon,
    tr: "Nargileci",
    en: "Hookah attendant",
    detail: "Köz, hazırlık veya küçük bir rica.",
    detailEn: "Coals, preparation or a little help.",
  },
  {
    kind: "valet",
    Icon: CarFront,
    tr: "Vale",
    en: "Valet",
    detail: "Siz hazırlanırken aracınız da hazırlansın.",
    detailEn: "Have your car ready when you are.",
  },
] as const;
type Kind = (typeof SERVICES)[number]["kind"];
type Receipt = {
  id: number;
  type: string;
  tableNumber: string;
  groupSlug?: string | null;
  note?: string | null;
  createdAt: string;
  duplicate?: boolean;
};

export default function TableServiceButtons({
  lang,
  slug: slugProp,
  enabled = true,
  showLabel = false,
}: {
  lang: string;
  slug?: string | null;
  enabled?: boolean;
  showLabel?: boolean;
}) {
  const { slug: resolvedSlug } = useMenuSlug();
  const slug = slugProp ?? resolvedSlug;
  const en = lang.split("-")[0] === "en";
  const { ensureUnlocked, markNeedsUnlock } = useTableSessionCode();
  const [tableCtx] = useState(() => resolveTableContext());
  const [open, setOpen] = useState(false);
  const [valet, setValet] = useState(false);
  const [plate, setPlate] = useState("");
  const [busy, setBusy] = useState<Kind | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const titleId = useId();
  const mounted = useSheetPresence(open);
  const close = () => {
    if (!lock.current) setOpen(false);
  };
  const ref = useSheetFocus(open, close);
  if (!slug || !enabled) return null;

  async function send(kind: Kind) {
    if (lock.current) return;
    if (!tableCtx.masa) {
      setError(
        en
          ? "Please open the menu using your table’s QR code."
          : "Lütfen masanızdaki QR kod ile menüyü açın.",
      );
      return;
    }
    lock.current = true;
    setBusy(kind);
    setError("");
    try {
      const unlock = async () => {
        setUnlocking(true);
        try {
          return await ensureUnlocked();
        } finally {
          setUnlocking(false);
        }
      };
      if (!(await unlock())) return;
      const post = () =>
        api<Receipt>(`/api/menu/${slug}/table-request`, {
          method: "POST",
          body: JSON.stringify({
            type: kind,
            tableNumber: tableCtx.masa,
            groupSlug: tableCtx.grup || undefined,
            ...(kind === "valet"
              ? { plate: plate.trim().toLocaleUpperCase("tr-TR") }
              : {}),
          }),
        });
      let res;
      try {
        res = await post();
      } catch (err) {
        if (!isCodeRequiredError(err)) throw err;
        markNeedsUnlock();
        if (!(await unlock())) return;
        res = await post();
      }
      if (!res.duplicate) notifyTableRequestCreated(res);
      setOpen(false);
      setPlate("");
      notifyServiceCallConfirmed({
        kind: res.type,
        requestId: res.id,
        tableNumber: res.tableNumber,
        lang,
        duplicate: res.duplicate,
      });
    } catch (err) {
      setError(
        en
          ? "Your request could not be sent. Please try again."
          : err instanceof Error
            ? err.message
            : "Çağrı iletilemedi. Lütfen tekrar deneyin.",
      );
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }

  return (
    <>
      <button
        type="button"
        className="table-service-header-btn"
        aria-label={en ? "Service" : "Servis"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setValet(false);
          setError("");
          setOpen(true);
        }}
      >
        <BellRing className="w-4 h-4" />
        {showLabel && <span>{en ? "Service" : "Servis"}</span>}
      </button>
      {mounted &&
        createPortal(
          <div
            className={`service-concierge ${open ? "is-open" : ""} ${unlocking ? "is-unlocking" : ""}`}
            inert={!open || unlocking}
          >
            <button
              type="button"
              className="service-concierge__shade"
              tabIndex={-1}
              aria-label={en ? "Close" : "Kapat"}
              onClick={close}
            />
            <section
              ref={ref}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="service-concierge__panel"
              aria-busy={!!busy}
            >
              <header className="service-concierge__header">
                <span className="service-concierge__brand">
                  <BellRing size={21} />
                </span>
                <div>
                  <small>{en ? "AT YOUR TABLE" : "MASANIZ İÇİN"}</small>
                  <strong>{en ? "Service" : "Servis"}</strong>
                </div>
                <button
                  className="service-concierge__close"
                  type="button"
                  disabled={!!busy}
                  onClick={close}
                  aria-label={en ? "Close" : "Kapat"}
                >
                  <X size={20} />
                </button>
              </header>
              <div
                key={valet ? "valet" : "services"}
                className="service-concierge__scene"
              >
                <aside className="service-concierge__intro">
                  <span className="service-concierge__eyebrow">
                    {tableCtx.masa
                      ? `${en ? "TABLE" : "MASA"} ${tableCtx.masa}`
                      : en
                        ? "AT YOUR SERVICE"
                        : "SİZİN İÇİN BURADAYIZ"}
                  </span>
                  <h2 id={titleId}>
                    {valet
                      ? en
                        ? "Your car,"
                        : "Aracınız"
                      : en
                        ? "Let us"
                        : "Bir el"}
                    <br />
                    <i>
                      {valet
                        ? en
                          ? "at the door."
                          : "hazır olsun."
                        : en
                          ? "help."
                          : "atalım."}
                    </i>
                  </h2>
                  <p>
                    {valet
                      ? en
                        ? "Leave your plate with us. We’ll let the valet know."
                        : "Plakanızı bırakın. Vale talebinizi ekibe iletelim."
                      : en
                        ? "Whatever you need, we’re just a call away."
                        : "İhtiyacınız ne olursa olsun, bir çağrı uzağınızdayız."}
                  </p>
                  <div className="service-concierge__drawing">
                    <SahneActivityArt kind={valet ? "valet" : "service"} />
                  </div>
                  <span className="service-concierge__foot">
                    {en ? "Make yourself at home." : "Siz keyfinize bakın."}
                  </span>
                </aside>
                <div className="service-concierge__request">
                  {valet ? (
                    <>
                      <button
                        type="button"
                        className="service-concierge__back"
                        disabled={!!busy}
                        onClick={() => {
                          setValet(false);
                          setError("");
                        }}
                      >
                        <ArrowLeft size={16} />
                        {en ? "All services" : "Tüm servisler"}
                      </button>
                      <h3>{en ? "Just your plate." : "Plakanız yeterli."}</h3>
                      <form
                        className="service-concierge__form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void send("valet");
                        }}
                      >
                        <label htmlFor={`${titleId}-plate`}>
                          {en ? "VEHICLE PLATE" : "ARAÇ PLAKASI"}
                        </label>
                        <div className="service-concierge__plate">
                          <CarFront size={22} />
                          <input
                            id={`${titleId}-plate`}
                            placeholder="34 ABC 123"
                            value={plate}
                            onChange={(e) =>
                              setPlate(
                                e.target.value.toLocaleUpperCase("tr-TR"),
                              )
                            }
                            required
                            minLength={4}
                            maxLength={20}
                            pattern="(?=.*[0-9])(?:[A-Z0-9ÇĞİÖŞÜ ]|-)+"
                            autoComplete="off"
                            autoCapitalize="characters"
                            spellCheck={false}
                            disabled={!!busy}
                          />
                        </div>
                        <small>
                          {en
                            ? "Your plate is shared with the service team for this request."
                            : "Plakanız bu çağrı için servis ekibine iletilir."}
                        </small>
                        <button
                          type="submit"
                          className="service-concierge__submit"
                          disabled={!!busy}
                        >
                          <span>
                            {busy
                              ? en
                                ? "Sending…"
                                : "İletiliyor…"
                              : en
                                ? "Call valet"
                                : "Valeyi çağır"}
                          </span>
                          <b>
                            {busy ? (
                              <LoaderCircle className="is-spinning" size={20} />
                            ) : (
                              <ArrowUpRight size={20} />
                            )}
                          </b>
                        </button>
                      </form>
                    </>
                  ) : (
                    <>
                      <div className="service-concierge__list-head">
                        <span>
                          {en ? "HOW CAN WE HELP?" : "NASIL YARDIMCI OLALIM?"}
                        </span>
                        <span>{String(SERVICES.length).padStart(2, '0')}</span>
                      </div>
                      <div className="service-concierge__list">
                        {SERVICES.map(
                          (
                            { kind, Icon, tr, en: nameEn, detail, detailEn },
                            i,
                          ) => (
                            <button
                              key={kind}
                              type="button"
                              className={`service-concierge__choice service-concierge__choice--${kind}`}
                              disabled={!!busy}
                              style={{ "--service-i": i } as CSSProperties}
                              onClick={() => {
                                if (kind === "valet") {
                                  setValet(true);
                                  setError("");
                                } else void send(kind);
                              }}
                            >
                              <span className="service-concierge__symbol">
                                {busy === kind ? (
                                  <LoaderCircle
                                    className="is-spinning"
                                    size={24}
                                  />
                                ) : (
                                  <Icon size={24} strokeWidth={1.5} />
                                )}
                              </span>
                              <span className="service-concierge__words">
                                <strong>{en ? nameEn : tr}</strong>
                                <span>{en ? detailEn : detail}</span>
                              </span>
                              <span className="service-concierge__arrow">
                                <ArrowUpRight size={20} />
                              </span>
                            </button>
                          ),
                        )}
                      </div>
                      <p className="service-concierge__hint">
                        {en
                          ? "Choose a service. We’ll let the team know."
                          : "Birini seçin, ekibe haber verelim."}
                      </p>
                    </>
                  )}
                  {error && (
                    <p role="alert" className="service-concierge__error">
                      {error}
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
