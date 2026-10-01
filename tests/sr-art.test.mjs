import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CARDS,POOLS,RULES} from '../src/data.js';

const expected = {
  chancellor: {name: '上官瑾', titles: ['夜半案牍','学堂授论','雨后巡河']},
  marshal: {name: '裴长缨', titles: ['凯旋归来','军帐筹策','校场点兵']},
  justice: {name: '玄慎', titles: ['夜归疗伤','檐下共伞','雪夜候归']},
  envoy: {name: '郑怀远', titles: ['夜明看灯','春日折花','渡口相候']},
  aide: {name: '陆知微', titles: ['温泉邀约','竹亭对弈','雨后煎茶']}
};

test('15 approved SR cards keep stable IDs, distinct art, and scene names', () => {
  assert.equal(POOLS.SR.length, 15);
  assert.equal(new Set(POOLS.SR.map(card => card.art)).size, 15);
  for (const [id, spec] of Object.entries(expected)) {
    const cards = POOLS.SR.filter(card => card.characterId === id);
    assert.equal(cards.length, RULES.counts.SR);
    assert.deepEqual(cards.map(card => card.id), [1,2,3].map(n => `${id}-sr-${String(n).padStart(2, '0')}`));
    assert.deepEqual(cards.map(card => card.title), spec.titles);
    assert.ok(cards.every(card => card.displayName === spec.name && card.artStatus === 'approved-unique'));
  }
  assert.equal(CARDS.length, 95);
});

test('revised poses and marshal armor use versioned art without changing card IDs', () => {
  const revised = new Set(['justice-sr-02','justice-sr-03','envoy-sr-01','envoy-sr-02','aide-sr-01','aide-sr-02','aide-sr-03']);
  for (const card of POOLS.SR) {
    assert.ok(card.art.endsWith(`-v${revised.has(card.id) ? 2 : 1}.webp`), card.id);
  }
  assert.equal(CARDS.find(card => card.id === 'marshal-ssr-01')?.art, './assets/ssr-marshal-final-v2.webp');
});

test('every SR card references a compact local WebP image', async () => {
  for (const card of POOLS.SR) {
    const image = await readFile(new URL('../' + card.art.slice(2), import.meta.url));
    assert.equal(image.toString('ascii', 0, 4), 'RIFF', card.id);
    assert.equal(image.toString('ascii', 8, 12), 'WEBP', card.id);
    assert.ok(image.length < 512 * 1024, `${card.id}: ${image.length} bytes`);
  }
});
