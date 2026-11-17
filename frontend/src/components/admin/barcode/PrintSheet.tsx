import { useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import QrCard from './QrCard';
import { sheetLayout, type CardSpec, type PaperId } from './qr';

export type PrintJob = {
  cards: CardSpec[];
  paperId: PaperId;
  perPage: number;
  cut: boolean;
};

const chunk = <T,>(list: T[], size: number) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) =>
    list.slice(i * size, i * size + size),
  );

/**
 * Print-only copy of the cards. It lives next to #root, is hidden on screen, and the print
 * stylesheet hides everything else, so the browser prints exactly these pages.
 */
export default function PrintSheet({
  job,
  onDone,
}: {
  job: PrintJob;
  onDone: () => void;
}) {
  const layout = sheetLayout(job.paperId, job.perPage);
  const { paper, cols, rows, per, gap, cardW, cardH, pageH } = layout;
  const pages = chunk(job.cards, per);
  useEffect(() => {
    let timer = 0,
      secondFrame = 0,
      waitTimer = 0,
      stopped = false;
    const roots = [document.documentElement, document.body];
    roots.forEach((root) => root.classList.add('bq-printing'));
    const finish = () => onDone();
    window.addEventListener('afterprint', finish, { once: true });
    // Two frames for layout, a little longer for logos inside the codes to load.
    const frame = requestAnimationFrame(
      () =>
        (secondFrame = requestAnimationFrame(() => {
          // SVG logos are not HTMLImageElements; preload their href before opening print.
          const logos = Array.from(
            document.querySelectorAll<SVGImageElement>('.bq-print-host image'),
          ).map(
            (node) =>
              new Promise<void>((resolve) => {
                const image = new Image();
                image.onload = image.onerror = () => resolve();
                image.src = node.getAttribute('href') || '';
              }),
          );
          const fonts = document.fonts?.ready.catch(() => undefined);
          void Promise.race([
            Promise.all([fonts, ...logos]),
            new Promise((resolve) => {
              waitTimer = window.setTimeout(resolve, 2500);
            }),
          ]).then(() => {
            clearTimeout(waitTimer);
            if (!stopped)
              timer = window.setTimeout(() => {
                if (!stopped) window.print();
              }, 150);
          });
        })),
    );
    return () => {
      cancelAnimationFrame(frame);
      stopped = true;
      cancelAnimationFrame(secondFrame);
      clearTimeout(timer);
      clearTimeout(waitTimer);
      roots.forEach((root) => root.classList.remove('bq-printing'));
      window.removeEventListener('afterprint', finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job]);
  return createPortal(
    <div className="bq-print-host" aria-hidden="true">
      <style>{`@page{size:${paper.w}mm ${pageH}mm;margin:0}`}</style>
      {pages.map((page, index) => (
        <section
          className="bq-sheetpage"
          key={index}
          style={
            {
              width: `${paper.w}mm`,
              height: `${pageH}mm`,
              padding: `${paper.margin}mm`,
              gridTemplateColumns: `repeat(${cols}, ${cardW}mm)`,
              gridTemplateRows: `repeat(${rows}, ${cardH}mm)`,
              gap: `${gap}mm`,
            } as CSSProperties
          }
        >
          {page.map((spec, i) => (
            <QrCard
              key={`${spec.key}-${i}`}
              spec={spec}
              unit={`${cardW / 100}mm`}
              className={job.cut ? 'has-cut' : ''}
            />
          ))}
        </section>
      ))}
    </div>,
    document.body,
  );
}
