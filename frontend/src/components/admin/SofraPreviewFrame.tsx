import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// A real iframe viewport makes the phone preview use the same media queries as a phone.
export default function SofraPreviewFrame({
  width,
  scale,
  height = 844,
  children,
}: {
  width: number;
  scale: number;
  height?: number;
  children: ReactNode;
}) {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [frameDocument, setFrameDocument] = useState<Document | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!frameDocument) return;
    const sourceDocument = frameRef.current?.ownerDocument;
    if (!sourceDocument) return;
    let cancelled = false;
    const copies = new Map<Element, Element>();
    const sync = () => {
      const sources = new Set(
        sourceDocument.querySelectorAll('style, link[rel="stylesheet"]'),
      );
      for (const [source, copy] of copies) {
        if (!sources.has(source)) {
          copy.remove();
          copies.delete(source);
        }
      }
      for (const source of sources) {
        const existing = copies.get(source);
        if (existing?.outerHTML === source.outerHTML) continue;
        const copy = source.cloneNode(true) as HTMLElement;
        if (source instanceof HTMLLinkElement)
          copy.setAttribute('href', source.href);
        if (existing) existing.replaceWith(copy);
        else frameDocument.head.appendChild(copy);
        copies.set(source, copy);
      }
    };
    sync();
    // A production stylesheet or a lazy-loaded editor style may arrive after iframe.onload.
    const observer = new MutationObserver(sync);
    observer.observe(sourceDocument.head, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
    const links = Array.from(
      frameDocument.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
    );
    const cleanups: (() => void)[] = [];
    const ready = links.map((link) =>
      link.sheet
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const done = () => {
              link.removeEventListener('load', done);
              link.removeEventListener('error', done);
              resolve();
            };
            link.addEventListener('load', done);
            link.addEventListener('error', done);
            cleanups.push(done);
          }),
    );
    const timeout = window.setTimeout(() => {
      if (!cancelled)
        setMount(frameDocument.getElementById('sofra-preview-root'));
    }, 3000);
    void Promise.all(ready).then(() => {
      clearTimeout(timeout);
      if (!cancelled)
        setMount(frameDocument.getElementById('sofra-preview-root'));
    });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      cleanups.forEach((fn) => fn());
      observer.disconnect();
      copies.forEach((copy) => copy.remove());
    };
  }, [frameDocument]);
  return (
    <div
      className="sofra-editor-frame-space"
      style={{ width: width * scale, height: height * scale }}
    >
      <iframe
        ref={frameRef}
        title="Sofra canlı taslak önizlemesi"
        className="sofra-editor-frame"
        width={width}
        height={height}
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
        srcDoc={
          '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body class="sofra-public-shell" style="margin:0;background:#0e0b09"><div id="sofra-preview-root"></div></body></html>'
        }
        onLoad={(e) => {
          const doc = e.currentTarget.contentDocument;
          if (!doc) return;
          setMount(null);
          setFrameDocument(doc);
        }}
      />
      {mount && createPortal(children, mount)}
    </div>
  );
}
