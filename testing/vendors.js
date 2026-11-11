// Preview records contain no supplier identities or scanned contracts.
const examples = [
  ['物業服務', '物業服務廠商', 100, 28000, "月", 2],
  ['社區保全', '保全服務廠商', 24, 52000, "月", 2],
  ['機電保養', '機電維護廠商', 55, 96000, "年", 1],
  ['環境清潔', '環境清潔廠商', null, null, null, null],
  ['園藝維護', '園藝維護廠商', 120, 18000, "期", 1],
  ['弱電維護', '弱電維護廠商', 12, 36000, "年", 1]
];
export function showVendors(root, reminders) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const date = new Intl.DateTimeFormat('zh-TW', {year:'numeric',month:'2-digit',day:'2-digit'});
  const records = examples.map(([service, vendor, days, amount, unit, years]) => {
    const end = new Date(today);
    end.setDate(end.getDate() + days);
    const start = new Date(end);
    if (years) {
      start.setDate(start.getDate() + 1);
      start.setFullYear(start.getFullYear() - years);
    }
    const price = amount == null ? '待核對' : amount.toLocaleString('zh-TW') + ' 元／' + unit;
    const term = years ? years + ' 年' : '待核對';
    const effective = years ? date.format(start) : '待核對';
    return {service, vendor, price, term, effective, days, expiry:days === null ? '待核對' : date.format(end)};
  });
  const home = location.pathname + location.search;
  root.innerHTML = `<style>
    #vendors h1{color:#123860} #vendors nav{margin:1rem 0 1.5rem}
    #vendors nav a{color:#174578;background:#e8f2ff;border:1px solid #97bce5}
    #vendors nav a[aria-current]{background:#185da7;color:white;border-color:#185da7}
    #vendors .contract-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:16px}
    #vendors .contract-card{background:white;border:1px solid #cbdad9;border-radius:16px;padding:clamp(16px,2vw,26px);color:#173d42}
    #vendors .contract-head{display:flex;align-items:start;justify-content:space-between;gap:12px}
    #vendors .contract-card h3{font-size:1.25rem;margin:.25rem 0 1rem}
    #vendors .contract-card small,#vendors dt{color:#49676a}
    #vendors dl{display:flex;flex-wrap:wrap;gap:12px 28px;border-top:1px solid #deebe9;padding-top:14px;margin:0}
    #vendors dd{margin:3px 0 0;font-weight:650} #vendors dl div:last-child{flex-basis:100%}
    body:has(#vendors) .property-footer{min-height:0;height:auto;padding-block:6px;margin-block-start:20px}
    body:has(#vendors) .property-footer button{min-height:32px;padding:4px 10px}
    #vendors .expiry{display:inline-block;padding:.15rem .65rem;border-radius:1rem;background:#e2f3ec;color:#075f49;white-space:nowrap}
    #vendors .soon{background:#ffe5bd;color:#874000} #vendors .unknown{background:#eeeaf9;color:#584882}
    </style><a href="${home}#/home">← 管理首頁</a><h1>廠商與合約</h1>
    <p>介面預覽 · 以下廠商、金額與期間均為示範資料</p>
    <nav class="toolbar"><a class="button" href="${home}#/home?view=vendors">簽約廠商</a>
    <a class="button" href="${home}#/home?view=renewals">合約到期追蹤</a></nav>
    <section class="panel"><h2>${reminders?'合約到期追蹤':'簽約廠商'}</h2>
    <label>${reminders?'到期範圍<select><option value="30">30 天內</option><option value="60">60 天內</option><option value="pending">日期待核對</option></select>':'搜尋廠商或服務<input type="search" placeholder="例如：機電">'}</label>
    <p role="status"></p><div class="contract-grid"></div></section>`;
  root.querySelectorAll('nav a')[reminders?1:0].setAttribute('aria-current','page');
  function render(){
    const value=root.querySelector('input,select').value.trim();
    const rows=records.filter(r=>reminders
      ? value==='pending' ? r.days===null : r.days!==null && r.days<=Number(value)
      : (r.vendor+r.service).includes(value));
    if(reminders)rows.sort((a,b)=>a.days-b.days);
    root.querySelector('[role=status]').textContent=rows.length?'共 '+rows.length+' 筆合約':'沒有符合條件的合約';
    root.querySelector('.contract-grid').innerHTML=rows.map(r=>`<article class="contract-card"><div class="contract-head"><div><small>${r.service}</small><h3>${r.vendor}</h3></div><span class="expiry ${r.days===null?'unknown':r.days<=30?'soon':''}">${r.days===null?'到期日待核對':'距到期 '+r.days+' 天'}</span></div><dl><div><dt>合約金額</dt><dd>${r.price}</dd></div><div><dt>年限</dt><dd>${r.term}</dd></div><div><dt>合約期間</dt><dd>${r.effective} 至 ${r.expiry}</dd></div></dl></article>`).join('');
  }
  root.querySelector('input,select').oninput=render;
  render();
}
