import { useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  BellRing,
  CarFront,
  HandHelping,
  LoaderCircle,
  Wind,
  X,
} from "lucide-react";
import { api, isCodeRequiredError } from "@/lib/api";
import { useMenuSlug } from "@/hooks/useMenuSlug";
import { resolveTableContext } from "@/lib/tableContext";
import { notifyTableRequestCreated } from "@/lib/tableRequestNotify";
import { notifyServiceCallConfirmed } from "@/lib/serviceCallFeedback";
import { useTableSessionCode } from "@/components/public/TableSessionCodeGate";
import { useSheetFocus, useSheetPresence } from "./sofra/SofraSheet";
import "./service-menu.css";

// Per-service administration switches will be added separately.
const SERVICES = [
  {
    kind: "waiter",
    Icon: HandHelping,
    tr: "Garson",
    en: "Waiter",
    detail: "Masanız için bir yardım eli.",
    detailEn: "A helping hand for your table.",
    hint: "Masama gelsin",
    hintEn: "Come to my table",
  },
  {
    kind: "hookah",
    Icon: Wind,
    tr: "Nargileci",
    en: "Hookah attendant",
    detail: "Köz, hazırlık veya küçük bir rica.",
    detailEn: "Coals, preparation or a little help.",
    hint: "İlgilenen biri gelsin",
    hintEn: "Ask for assistance",
  },
  {
    kind: "valet",
    Icon: CarFront,
    tr: "Vale",
    en: "Valet",
    detail: "Siz hazırlanırken aracınız da hazırlansın.",
    detailEn: "Have your car ready when you are.",
    hint: "Plakamı yazayım",
    hintEn: "Enter my plate",
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
                <span className="service-concierge__eyebrow">
                  <span />
                  {en ? "AT YOUR SERVICE" : "BİR İSTEĞİNİZ Mİ VAR?"}
                  {tableCtx.masa && (
                    <b>
                      {en ? "Table" : "Masa"} {tableCtx.masa}
                    </b>
                  )}
                </span>
                <button
                  className="service-concierge__close"
                  type="button"
                  disabled={!!busy}
                  onClick={close}
                  aria-label={en ? "Close" : "Kapat"}
                >
                  <X size={21} />
                </button>
              </header>
              <div
                key={valet ? "valet" : "services"}
                className="service-concierge__scene"
              >
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
                      <ArrowLeft size={17} />
                      {en ? "All services" : "Tüm servisler"}
                    </button>
                    <div className="service-concierge__valet-icon">
                      <CarFront size={44} strokeWidth={1.3} />
                    </div>
                    <h2 id={titleId}>
                      {en ? "Your car, next." : "Sırada aracınız var."}
                    </h2>
                    <p>
                      {en
                        ? "Enter your plate. We’ll pass it on to the team."
                        : "Plakanızı yazın, vale talebinizi ekibe iletelim."}
                    </p>
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
                        <span aria-hidden="true">
                          <CarFront size={22} />
                        </span>
                        <input
                          id={`${titleId}-plate`}
                          placeholder="34 ABC 123"
                          value={plate}
                          onChange={(e) =>
                            setPlate(e.target.value.toLocaleUpperCase("tr-TR"))
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
                        {busy ? (
                          <LoaderCircle className="is-spinning" size={21} />
                        ) : (
                          <CarFront size={21} />
                        )}{" "}
                        {busy
                          ? en
                            ? "Sending…"
                            : "İletiliyor…"
                          : en
                            ? "Call valet"
                            : "Valeyi çağır"}
                        <ArrowUpRight size={21} />
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <h2 id={titleId}>
                      {en ? "Enjoy your time." : "Siz keyfinize bakın."}
                    </h2>
                    <p>
                      {en
                        ? "Who can we call for you?"
                        : "Sizin için kimi çağıralım?"}
                    </p>
                    <div className="service-concierge__list">
                      {SERVICES.map(
                        (
                          {
                            kind,
                            Icon,
                            tr,
                            en: nameEn,
                            detail,
                            detailEn,
                            hint,
                            hintEn,
                          },
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
                                  size={30}
                                />
                              ) : (
                                <Icon size={30} strokeWidth={1.4} />
                              )}
                            </span>
                            <span className="service-concierge__words">
                              <strong>{en ? nameEn : tr}</strong>
                              <span>{en ? detailEn : detail}</span>
                              <em>
                                {en ? hintEn : hint} <ArrowUpRight size={14} />
                              </em>
                            </span>
                            <span
                              className="service-concierge__number"
                              aria-hidden="true"
                            >
                              0{i + 1}
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                  </>
                )}
                {error && (
                  <p role="alert" className="service-concierge__error">
                    {error}
                  </p>
                )}
              </div>
              <footer className="service-concierge__footer">
                <BellRing size={14} />
                {en
                  ? "One request. The right person."
                  : "Tek bir çağrı. Doğru kişiye."}
              </footer>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
