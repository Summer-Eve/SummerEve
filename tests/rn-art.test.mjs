import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CARDS, POOLS} from '../src/data.js';

const people = ['chancellor', 'marshal', 'justice', 'envoy', 'aide'];

test('all five R and ten N costumes per character use unique art without changing IDs', () => {
  assert.equal(CARDS.length, 95);
  for (const rarity of ['R', 'N']) {
    const approvedCount = rarity === 'N' ? 10 : 5;
    const approved = POOLS[rarity].filter(card => card.variant < approvedCount);
    assert.equal(approved.length, 5 * approvedCount);
    assert.equal(new Set(approved.map(card => card.art)).size, 5 * approvedCount);
    for (const person of people) {
      for (const number of ['01', '02', '03', '04', '05', ...(rarity === 'N' ? ['06', '07', '08', '09', '10'] : [])]) {
        const card = approved.find(item => item.id === `${person}-${rarity.toLowerCase()}-${number}`);
        assert.equal(card?.art, `./assets/${rarity.toLowerCase()}-${person}-${number}-v1.webp`);
        assert.equal(card?.artStatus, 'approved-unique');
      }
    }
    assert.equal(POOLS[rarity].filter(card => card.variant >= approvedCount).length, 0);
  }
});

test('approved R and N art is compact local WebP', async () => {
  for (const rarity of ['R', 'N']) {
    for (const card of POOLS[rarity].filter(item => item.variant < (rarity === 'N' ? 10 : 5))) {
      const image = await readFile(new URL('../' + card.art.slice(2), import.meta.url));
      assert.equal(image.toString('ascii', 0, 4), 'RIFF', card.id);
      assert.equal(image.toString('ascii', 8, 12), 'WEBP', card.id);
      assert.ok(image.length < 512 * 1024, `${card.id}: ${image.length} bytes`);
    }
  }
});

test('all 95 cards have distinct approved local artwork', async () => {
  assert.equal(CARDS.length, 95);
  assert.equal(new Set(CARDS.map(card => card.art)).size, 95);
  assert.ok(CARDS.every(card => card.artStatus === 'approved-unique'));
  for (const card of CARDS) {
    const image = await readFile(new URL('../' + card.art.slice(2), import.meta.url));
    assert.equal(image.toString('ascii', 0, 4), 'RIFF', card.id);
    assert.equal(image.toString('ascii', 8, 12), 'WEBP', card.id);
  }
});
