import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTERS,CARDS,CARD_BY_ID,RARITIES} from '../src/data.js';
import {newSave,validateSave} from '../src/engine.js';

const names={chancellor:'上官瑾',marshal:'裴长缨',justice:'玄慎',envoy:'郑怀远',aide:'陆知微'};

test('all characters and all 95 card name labels use the approved personal names',()=>{
  assert.equal(CHARACTERS.length,5);
  assert.equal(CARDS.length,95);
  for(const person of CHARACTERS){
    assert.equal(person.name,names[person.id]);
    assert.ok(!Object.hasOwn(person,'ssrName'),'No rarity-specific name overrides');
    const cards=CARDS.filter(card=>card.characterId===person.id);
    assert.equal(cards.length,19);
    for(const rarity of RARITIES){
      const group=cards.filter(card=>card.rarity===rarity);
      assert.ok(group.length>0);
      assert.ok(group.every(card=>card.displayName===person.name));
    }
  }
});

test('existing saved card IDs and history resolve to personal names without changing progress',()=>{
  const save=newSave();
  save.totalDraws=5;save.received=5;save.marks=5;save.pity=5;
  for(const id of Object.keys(names)){
    const cardId=`${id}-n-01`;
    save.copies[cardId]=1;
    save.history.push({id:cardId,source:'抽取',bonus:false,isNew:true,before:0,after:1,glow:0,number:save.history.length+1,time:'2026-10-02T12:00:00.000Z'});
  }
  const loaded=validateSave(JSON.parse(JSON.stringify(save)));
  assert.deepEqual(loaded.copies,save.copies);
  assert.deepEqual(loaded.history,save.history);
  for(const item of loaded.history){
    const card=CARD_BY_ID[item.id];
    assert.equal(card.displayName,names[card.characterId]);
  }
  assert.equal(loaded.totalDraws,5);
  assert.equal(loaded.version,1);
});
