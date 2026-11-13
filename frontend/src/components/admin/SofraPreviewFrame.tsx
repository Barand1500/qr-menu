import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// A real iframe viewport makes the phone preview use the same media queries as a phone.
export default function SofraPreviewFrame({
  width,
  scale,
  children,
}: {
  width: number;
  scale: number;
  children: ReactNode;
}) {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const height = 800;
  return (
    <div
      className="sofra-editor-frame-space"
      style={{ width: width * scale, height: height * scale }}
    >
      <iframe
        title="Sofra canlı taslak önizlemesi"
        className="sofra-editor-frame"
        width={width}
        height={height}
        style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
        srcDoc={
          '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#faf5ed"><div id="sofra-preview-root"></div></body></html>'
        }
        onLoad={(e) => {
          const doc = e.currentTarget.contentDocument;
          if (!doc) return;
          document
            .querySelectorAll('style, link[rel="stylesheet"]')
            .forEach((sheet) => doc.head.appendChild(sheet.cloneNode(true)));
          setMount(doc.getElementById('sofra-preview-root'));
        }}
      />
      {mount && createPortal(children, mount)}
    </div>
  );
}
