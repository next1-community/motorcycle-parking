// Preview records contain no supplier identities or scanned contracts.
const examples = [
  ['物業服務', '物業服務廠商', 100],
  ['社區保全', '保全服務廠商', 24],
  ['機電保養', '機電維護廠商', 55],
  ['環境清潔', '環境清潔廠商', null],
  ['園藝維護', '園藝維護廠商', 120],
  ['弱電維護', '弱電維護廠商', 12]
];
export function showVendors(root, reminders) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const date = new Intl.DateTimeFormat('zh-TW', {year:'numeric',month:'2-digit',day:'2-digit'});
  const records = examples.map(([service, vendor, days]) => {
    const end = new Date(today);
    end.setDate(end.getDate() + days);
    return {service, vendor, days, expiry:days === null ? '待核對' : date.format(end)};
  });
  const home = location.pathname + location.search;
  root.innerHTML = `<style>
    #vendors h1{color:#123860} #vendors nav{margin:1rem 0 1.5rem}
    #vendors nav a{color:#174578;background:#e8f2ff;border:1px solid #97bce5}
    #vendors nav a[aria-current]{background:#185da7;color:white;border-color:#185da7}
    #vendors thead{background:#e3effb} #vendors th,#vendors td{padding:.8rem}
    #vendors .expiry{display:inline-block;padding:.15rem .65rem;border-radius:1rem;background:#e2f3ec;color:#075f49;white-space:nowrap}
    #vendors .soon{background:#ffe5bd;color:#874000} #vendors .unknown{background:#eeeaf9;color:#584882}
    </style><a href="${home}#/home">← 管理首頁</a><h1>廠商與合約</h1>
    <p>介面預覽 · 以下為示範廠商與日期</p>
    <nav class="toolbar"><a class="button" href="${home}#/home?view=vendors">簽約廠商</a>
    <a class="button" href="${home}#/home?view=renewals">合約到期追蹤</a></nav>
    <section class="panel"><h2>${reminders?'合約到期追蹤':'簽約廠商'}</h2>
    <label>${reminders?'到期範圍<select><option value="30">30 天內</option><option value="60">60 天內</option><option value="pending">日期待核對</option></select>':'搜尋廠商或服務<input type="search" placeholder="例如：機電">'}</label>
    <p role="status"></p><div class="table-wrap" style="overflow-x:auto"><table><thead><tr><th>服務項目</th><th>廠商</th><th>合約到期日</th><th>距到期</th></tr></thead><tbody></tbody></table></div></section>`;
  root.querySelectorAll('nav a')[reminders?1:0].setAttribute('aria-current','page');
  function render(){
    const value=root.querySelector('input,select').value.trim();
    const rows=records.filter(r=>reminders
      ? value==='pending' ? r.days===null : r.days!==null && r.days<=Number(value)
      : (r.vendor+r.service).includes(value));
    if(reminders)rows.sort((a,b)=>a.days-b.days);
    root.querySelector('[role=status]').textContent=rows.length?'共 '+rows.length+' 筆合約':'沒有符合條件的合約';
    root.querySelector('tbody').innerHTML=rows.map(r=>`<tr><th>${r.service}</th><td>${r.vendor}</td><td>${r.expiry}</td><td><span class="expiry ${r.days===null?'unknown':r.days<=30?'soon':''}">${r.days===null?'待核對':r.days+' 天'}</span></td></tr>`).join('');
  }
  root.querySelector('input,select').oninput=render;
  render();
}
