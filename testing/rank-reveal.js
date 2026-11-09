let pages = [];
let pageIndex = -1;
let timer;
let hasOpening = false;

function shuffleOpening() {
  const cards = Array.from({length: 10}, (_, i) => {
    const direction = i % 2 ? 1 : -1;
    const offset = i * 1.4;
    return `<g transform="translate(${offset},${-offset})">
      <animateTransform attributeName="transform" type="translate" dur="2.6s" fill="freeze"
        keyTimes="0;0.14;0.34;0.48;0.66;0.8;1"
        values="${offset} ${-offset};${offset} ${-offset};${direction * 88} ${-12-i};${offset} ${-offset};${direction * 72} ${-18-i};${offset} ${-offset};${i===9?105:offset} ${i===9?-43:-offset}"/>
      <rect x="-50" y="-65" width="100" height="130" rx="9" fill="#29496c" stroke="#e8c987" stroke-width="2"/>
      <rect x="-44" y="-59" width="88" height="118" rx="6" fill="none" stroke="#b29565"/>
      <text y="-2" text-anchor="middle" fill="#ffdc97" font-size="28">✦</text>
      <text y="23" text-anchor="middle" fill="#ffdc97" font-size="14" letter-spacing="2">NEXT1</text>
    </g>`;
  }).join('');
  return `<section class="rank-reveal" data-page="0"><header><h1>洗牌中</h1></header>
    <svg aria-hidden="true" viewBox="-210 -140 420 260" style="display:block;width:min(100%,820px);max-height:55vh;margin:auto">${cards}</svg></section>`;
}
export function startReveal(lots, render) {
  clearTimeout(timer);
  const sorted = [...lots].sort((a, b) => a.rank - b.rank);
  pages = [];
  for (let i = 0; i < sorted.length; i += 8) pages.push(sorted.slice(i, i + 8));
  hasOpening = pages.length > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (hasOpening) pages.unshift(null);
  pageIndex = pages.length ? 0 : -1;
  function advance() {
    pageIndex++;
    if (pageIndex === pages.length) pageIndex = -1;
    else timer = setTimeout(advance, 5500);
    render();
  }
  if (pages.length) timer = setTimeout(advance, hasOpening ? 2700 : 5500);
}
export function revealPage() {
  if (hasOpening && pageIndex === 0) return shuffleOpening();
  const page = pages[pageIndex];
  if (!page) return '';
  const cards = page.map(({rank, household}, i) => {
    const unit = String(household).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<article class="rank-slot" style="--deal:${i*.12}s;--flip:${1.65+i*.37}s"><div class="rank-card"><div class="rank-side rank-back" aria-hidden="true">✦<br>NEXT1</div><div class="rank-side rank-front"><small>第 ${Number(rank)} 順位</small><b>${unit}</b>${rank > 59 ? `<small>預計候補第 ${rank - 59} 位</small>` : ''}</div></div></article>`;
  }).join('');
  return `<section class="rank-reveal" data-page="${pageIndex}"><header><h1>選位順位揭曉</h1><strong>第 ${pageIndex+1-Number(hasOpening)} / ${pages.length-Number(hasOpening)} 頁</strong></header><div class="rank-grid">${cards}</div></section>`;
}
Object.defineProperty(revealPage, 'index', {get: () => pageIndex});
