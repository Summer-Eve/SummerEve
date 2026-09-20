export const VERSION = '0.1.0';
export const RARITIES = ['SSR', 'SR', 'R', 'N'];
export const RULES = Object.freeze({
  rates: { SSR: .015, SR: .035, R: .25, N: .70 },
  caps: { SSR: 3, SR: 5, R: 8, N: 10 },
  counts: { SSR: 1, SR: 3, R: 5, N: 10 },
  overflow: { SSR: 20, SR: 8, R: 3, N: 1 },
  costs: { SR: 80, R: 30, N: 10 },
  fullWeight: 5, normalWeight: 100, pity: 60, exchange: 100,
  firstGift: 60, daily: 50, milestones: { 3: 40, 7: 80, 14: 120 }
});
export const CHARACTERS = [
  { id: 'chancellor', name: '女相', office: '百官之首', seal: '衡', accent: '#9b5144', motto: '执笔定风波，清心照山河。', description: '身居相位，执掌朝政。', ssr: '山河在握' },
  { id: 'marshal', name: '兵部尚书', office: '掌天下兵事', seal: '锋', accent: '#9b5144', motto: '长风过关山，一诺重千金。', description: '执掌军政，以决断立身。深青衣袍、朱砂衣领与佩剑，映出她坚毅的一面。', ssr: '长风万里' },
  { id: 'justice', name: '廷尉', office: '掌刑狱法度', seal: '律', accent: '#485c6e', motto: '一尺量曲直，寸心守方圆。', description: '守法度，重秩序。墨蓝官服与手中的竹册，将他与皇城的晨钟一起留在画中。', ssr: '明镜无尘' },
  { id: 'envoy', name: '鸿胪卿', office: '掌宾客与邦交', seal: '弈', accent: '#788363', motto: '清风入袖，落子无声。', description: '往来诸方，察言观势。淡碧衣袖与一柄合拢的折扇，收起尚未言明的心思。', ssr: '袖里乾坤' },
  { id: 'aide', name: '近臣', office: '侍侧辅政', seal: '笺', accent: '#778a91', motto: '愿以一笺，守此清明。', description: '侍侧辅政，坦诚进言。月白衣衫与青灰襟带，伴他穿过清晨的宫廊。', ssr: '与君同途' }
];
const themes = {
  SSR: [''], SR: ['听雨','观澜','照夜'], R: ['晨朝','案牍','庭雪','临风','灯下'],
  N: ['初见','小憩','烹茶','展卷','听风','折枝','观云','落笔','归途','静思']
};
export const CARDS = CHARACTERS.flatMap((person, characterIndex) => RARITIES.flatMap(rarity =>
  themes[rarity].map((title, i) => ({
    id: `${person.id}-${rarity.toLowerCase()}-${String(i + 1).padStart(2,'0')}`,
    characterId: person.id, characterIndex, rarity, title: rarity === 'SSR' ? person.ssr : title,
    max: RULES.caps[rarity], variant: i, art: `./assets/${person.id}-${person.id === 'envoy' ? 'v4' : ['chancellor','marshal'].includes(person.id) ? 'v3' : 'v2'}.webp`,
    artStatus: 'shared-study', description: person.description
  }))
));
export const CARD_BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));
export const POOLS = Object.fromEntries(RARITIES.map(r => [r, CARDS.filter(c => c.rarity === r)]));
export const TOTAL_COPIES = CARDS.reduce((n,c) => n + c.max, 0);
