let pages = [];
let pageIndex = -1;
let timer;
export function startReveal(lots, render) {
  clearTimeout(timer);
  const sorted = [...lots].sort((a, b) => a.rank - b.rank);
  pages = [];
  for (let i = 0; i < sorted.length; i += 8) pages.push(sorted.slice(i, i + 8));
  pageIndex = pages.length ? 0 : -1;
  function advance() {
    pageIndex++;
    if (pageIndex === pages.length) pageIndex = -1;
    else timer = setTimeout(advance, 5500);
    render();
  }
  if (pages.length) timer = setTimeout(advance, 5500);
}
export function revealPage() {
  const page = pages[pageIndex];
  if (!page) return '';
  const cards = page.map(({rank, household}, i) => {
    const unit = String(household).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<article class="rank-slot" style="--deal:${i*.12}s;--flip:${1.65+i*.37}s"><div class="rank-card"><div class="rank-side rank-back" aria-hidden="true">✦<br>NEXT1</div><div class="rank-side rank-front"><small>第 ${Number(rank)} 順位</small><b>${unit}</b></div></div></article>`;
  }).join('');
  return `<section class="rank-reveal" data-page="${pageIndex}"><header><h1>選位順位揭曉</h1><strong>第 ${pageIndex+1} / ${pages.length} 頁</strong></header><div class="rank-grid">${cards}</div></section>`;
}
Object.defineProperty(revealPage, 'index', {get: () => pageIndex});
