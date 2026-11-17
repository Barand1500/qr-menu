import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'node_modules/.barcode-layout-test.mjs');
await build({
  entryPoints: [path.join(root, 'src/components/admin/barcode/qr.ts')],
  outfile: output,
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const { PAPERS, PER_PAGE, CARD_RATIO, sheetLayout, readTableStyle } =
  await import(pathToFileURL(output).href);

// No selected sheet/card count may create a clipped card or exceed the printable area.
for (const paper of PAPERS) {
  for (const count of PER_PAGE) {
    const layout = sheetLayout(paper.id, count);
    const { cols, rows, gap, cardW, cardH } = layout;
    assert.ok(Number.isFinite(cardW) && cardW > 0);
    assert.equal(layout.per, cols * rows);
    assert.ok(Math.abs(cardH / cardW - CARD_RATIO) < 1e-9);
    assert.ok(
      cols * cardW + (cols - 1) * gap + paper.margin * 2 <= paper.w + 1e-9,
    );
    assert.ok(
      rows * cardH + (rows - 1) * gap + paper.margin * 2 <= layout.pageH + 1e-9,
    );
    if (!paper.sheet) assert.equal(layout.per, 1);
  }
}
assert.equal(sheetLayout('a4', 1000).per, 1);

const group = { id: 'salon', name: 'Salon', prefix: '', count: 12 };
for (const name of ['VIP 3', 'Özel-3', 'Pencere kenarı']) {
  const styles = {
    salon: { 3: { name, colorId: 'wine', frameId: 'kalin', withLogo: true } },
  };
  const snapshot = structuredClone(styles);
  assert.equal(readTableStyle(group, styles, 3).name, name);
  assert.deepEqual(
    styles,
    snapshot,
    'reading a style must never mutate persisted data',
  );
}
assert.equal(readTableStyle(group, {}, 3).name, 'Salon 3');
assert.equal(readTableStyle({ ...group, prefix: 'b' }, {}, 3).name, 'b-3');
console.log(
  'PASS barcode sheet geometry for A4/A5/80mm/58mm and all card counts; custom numbered names and immutable reads.',
);
