import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('./src/styles.css', import.meta.url), 'utf8');
test('H99 skip link points to a focusable main landmark', () => {
  assert.match(html, /class="skip-link" href="#app"/);
  assert.match(html, /<main id="app" tabindex="-1" aria-label="Operações de holerite"><\/main>/);
});
test('H99 responsive single-column mobile layout and tap targets', () => {
  assert.match(css, /@media\s*\(max-width:\s*480px\)/);
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /min-height:\s*44px/);
});
test('H99 no demo password is hardcoded in entry page', () => {
  assert.doesNotMatch(html, /type="password"\s+value=/i);
  assert.match(html, /href="privacy\.html"/);
});
