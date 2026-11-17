import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'node_modules/.dish-catalog-test.mjs');
await build({
  stdin: {
    contents: `export * from './src/lib/dishCatalog'; export * from './src/components/admin/products/dishDraft'; export * from './src/components/admin/products/productForm'; export {defaultPrefCatalog,flagsFromDietSelection} from './src/lib/prefCatalog';`,
    resolveDir: root,
    loader: 'ts',
  },
  outfile: output,
  platform: 'node',
  format: 'esm',
  bundle: true,
  alias: { '@': path.join(root, 'src') },
  define: { 'import.meta.env': '{}' },
});
const {
  DISH_CATALOG,
  findDishTemplate,
  normalizeDishName,
  fillDishDraft,
  undoDraftFill,
  emptyForm,
  defaultPrefCatalog,
  flagsFromDietSelection,
} = await import(pathToFileURL(output).href);
const prefs = defaultPrefCatalog(),
  names = new Set(),
  ids = new Set();
for (const dish of DISH_CATALOG) {
  assert.ok(!ids.has(dish.id));
  ids.add(dish.id);
  assert.ok(
    dish.description && dish.ingredients.length && dish.features.length,
  );
  for (const name of [dish.name, ...dish.aliases]) {
    const key = normalizeDishName(name);
    assert.ok(!names.has(key));
    names.add(key);
  }
  for (const id of dish.allergenTags)
    assert.ok(prefs.allergens.some((tag) => tag.id === id));
  for (const id of dish.dietTags)
    assert.ok(prefs.diets.some((tag) => tag.id === id));
  assert.ok(
    !dish.dietTags.includes('diabetic') &&
      !dish.dietTags.includes('gluten-free'),
  );
}
assert.equal(findDishTemplate('  TAVUKLU PİLAV  ').id, 'tavuk-pilav');
assert.equal(findDishTemplate('uydurma yemek'), undefined);
const before = {
  ...emptyForm(),
  translations: {
    tr: { name: '', description: '', ingredients: '', allergens: '' },
    en: {
      name: 'Keep',
      description: 'English',
      ingredients: '',
      allergens: '',
    },
  },
};
const after = fillDishDraft(
  before,
  'Tavuk pilav',
  findDishTemplate('Tavuk pilav'),
);
assert.ok(after.translations.tr.description.includes('pirinç'));
assert.ok(after.translations.tr.ingredients.includes('Tereyağı'));
assert.deepEqual(after.allergenTags, ['dairy']);
assert.equal(after.calories, '');
assert.equal(after.prepTimeMinutes, '');
assert.equal(after.translations.en.description, 'English');
const record = { before, after, name: 'Tavuk pilav' };
let reverted = undoDraftFill(after, record);
assert.equal(reverted.translations.tr.description, '');
assert.deepEqual(reverted.features, []);
assert.deepEqual(reverted.allergenTags, []);
const changed = {
  ...after,
  ...flagsFromDietSelection(['vegan', 'vegetarian']),
  translations: {
    ...after.translations,
    tr: { ...after.translations.tr, description: 'Kendi açıklamam' },
  },
};
reverted = undoDraftFill(changed, record);
assert.equal(reverted.translations.tr.description, 'Kendi açıklamam');
assert.equal(reverted.isVegan, true);
assert.equal(reverted.isVegetarian, true);
assert.deepEqual(reverted.dietTags, changed.dietTags);
const manual = {
  ...before,
  calories: '0',
  prepTimeMinutes: '12',
  features: ['Özel'],
  allergenTags: ['egg'],
  translations: {
    ...before.translations,
    tr: { ...before.translations.tr, description: 'Benim tarifim' },
  },
};
const kept = fillDishDraft(manual, 'Menemen', findDishTemplate('Menemen'));
assert.equal(kept.translations.tr.description, 'Benim tarifim');
assert.deepEqual(kept.features, ['Özel']);
assert.deepEqual(kept.allergenTags, ['egg']);
assert.equal(kept.calories, '0');
assert.equal(kept.prepTimeMinutes, '12');
console.log(
  `PASS ${DISH_CATALOG.length} templates: IDs/aliases/tags, lookup, automatic details, draft rollback, manual edits, zero values and translations.`,
);
