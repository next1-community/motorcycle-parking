const fmt = x => x.toLocaleString('zh-TW',{maximumFractionDigits:1});
const sum = a => a.reduce((n,v)=>n+v,0);
const safe = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rules = [['電費',1,2000],['水費',2,300]];
function periods(data,year,key,step) {
  const rows=[];
  const prior=Object.keys(data).map(Number).filter(y=>y<year).slice(-3);
  if(prior.length<2)return rows;
  const values=data[year].items[key];
  for(let i=0;i+step<=values.length;i+=step){
    const amount=sum(values.slice(i,i+step));
    const history=prior.map(y=>sum(data[y].items[key].slice(i,i+step))).sort((a,b)=>a-b);
    const base=history.length===2?sum(history)/2:history[1];
    if(base>0)rows.push({month:i+step,amount,base,diff:amount-base,pct:(amount/base-1)*100});
  }
  return rows;
}
export function showFinance(root,data){
  const years=Object.keys(data).map(Number).sort();
  let year=years.at(-1), tab='overview', subject='電費';

  function render(){
    const r=data[year], n=r.expense.length, prev=data[year-1];
    const priority = ['電費','水費','修繕費','管理服務費','清潔維護費','電梯保養費','保險費'];
    const active = Object.entries(r.items).filter(([,values]) =>
      values.slice(0,n).some(value => Number.isFinite(value) && value !== 0));
    const ranked = active.slice().sort((a,b) =>
      Math.abs(sum(b[1].slice(0,n))) - Math.abs(sum(a[1].slice(0,n))));
    const subjects = [...new Set([
      ...priority.filter(key => active.some(([name]) => name === key)),
      ...ranked.slice(0,5).map(([key]) => key)
    ])];
    const metric=(key,title)=>{
      const value=key==='balance'?r[key][n-1]:sum(r[key]);
      const base=prev&&(key==='balance'?prev[key][n-1]:sum(prev[key].slice(0,n)));
      const d=value-base;
      return '<article><small>'+title+'</small><strong>'+fmt(value)+'</strong><span>'+(prev?'較去年同期 '+(d>=0?'+':'')+fmt(d)+' 元'+(base?'（'+fmt(100*d/base)+'%）':''):'歷史起始年度')+'</span></article>';
    };
    const compare=()=>{if (!subjects.length) return "<p>本期尚無支出紀錄。</p>"; const ys=years.filter(y=>y<=year);
      const valid=v=>Array.isArray(v)&&v.length>=n&&v.slice(0,n).every(Number.isFinite);
      const cur=r.items[subject], old=prev?.items[subject], title=safe(subject);
      let insight='<p>本期累計支出 '+fmt(sum(cur.slice(0,n)))+' 元。去年同期資料不足。</p>';
      if(valid(cur)&&valid(old)){
        const total=sum(cur.slice(0,n)), base=sum(old.slice(0,n)), delta=total-base;
        const changed=cur.slice(0,n).map((v,i)=>({i,d:v-old[i]}));
        const totals=ys.filter(y=>valid(data[y].items[subject])).map(y=>[y,sum(data[y].items[subject].slice(0,n))]);
        const maxChange=Math.max(1,...changed.map(entry=>Math.abs(entry.d)));
        const signed=value=>(value>0?'+':'')+fmt(value);
        const peak = Math.max(0,...totals.map(([,v])=>v));
        const floor = Math.min(0,...totals.map(([,v])=>v));
        const range = peak-floor || 1;
        const annual = totals.map(([y,value]) => {
          const height = 120*Math.abs(value)/range;
          const positive = value>=0;
          return `<div class="fin-column"><div class="fin-plot"><div class="fin-pillar" style="height:${height}px;bottom:${120*((positive?0:value)-floor)/range}px;background:${y===year?'#17665d':'#a8c6c0'}"><b>${fmt(value)}</b></div></div><span>${y}</span></div>`;
        }).join('');
        const increases = changed.filter(m=>m.d>0).sort((a,b)=>b.d-a.d);
        const decreases = changed.filter(m=>m.d<0).sort((a,b)=>a.d-b.d);
        const describe = (rows,action) => rows.length
          ? `${rows.length} 個月份${action}，合計 ${fmt(Math.abs(sum(rows.map(m=>m.d))))} 元；其中 ${rows[0].i+1} 月${action}最多（${fmt(Math.abs(rows[0].d))} 元）。` : '';
        const months=changed.map(({i,d})=>`<div class="fm"><span>${i+1} 月</span><span class="fin-axis"><span style="${d<0?'right':'left'}:50%;width:${50*Math.abs(d)/maxChange}%;background:${d<0?'#25766c':'#ad602a'}"></span></span><b>${signed(d)}</b></div>`).join('');
        const flat = delta === 0;
        const sameMonths = changed.every(month => month.d === 0);
        const headline = flat
          ? `${title}<strong>本期支出 ${fmt(total)} 元｜與去年同期持平</strong>`
          : `${title} · 較去年同期<strong>${signed(delta)} 元 ${base>0?'（'+signed(delta/base*100)+'%）':''}</strong>`;
        const breakdown = sameMonths ? '' : `<div class="fin-analysis"><strong>哪些月份影響差額？</strong>${flat?'<p>本期總額與去年同期相同，各月增減互相抵銷。</p>':''}${[describe(increases,'增加'),describe(decreases,'減少')].filter(Boolean).map(line=>`<p>${line}</p>`).join('')}</div>`;
        const comparison = sameMonths
          ? `<figcaption>各月支出持平</figcaption><p>1 至 ${n} 月，每月${title}均與去年同月相同。</p>`
          : `<figcaption>各月與去年同期的差額（元）</figcaption>${months}`;
        insight=`<style>
          .fcompare{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:16px;margin:16px 0}
          .fcompare figure{min-width:0;margin:0;padding:18px;border:1px solid #d4e1de;border-radius:14px}
          .fcompare figcaption{font-weight:700;margin-bottom:12px}.fin-columns{display:flex;padding-top:26px;text-align:center}.fin-column{flex:1;min-width:0;font-variant-numeric:tabular-nums}.fin-plot{position:relative;height:120px;background:linear-gradient(to top,transparent calc(${-floor/range*100}% - 1px),#becbc7 ${-floor/range*100}%,transparent calc(${-floor/range*100}% + 1px))}.fin-pillar{position:absolute;left:24%;width:52%;border-radius:4px 4px 0 0}.fin-pillar b{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);font-size:clamp(11px,1vw,14px);white-space:nowrap}.fin-column>span{display:block;padding-top:6px}.fin-analysis{border-top:1px solid #dce6e3;margin-top:14px;padding-top:12px}.fin-analysis p{margin:6px 0;font-size:.92rem}
          .fm{display:grid;grid-template-columns:3em 1fr 5em;align-items:center;gap:8px;font-variant-numeric:tabular-nums}.fm b{text-align:right}.fin-axis{position:relative;height:24px;background:linear-gradient(to right,transparent calc(50% - .5px),#879b96 50%,transparent calc(50% + .5px))}.fin-axis>span{position:absolute;top:6px;height:12px;border-radius:2px}
          .fheadline{margin:16px 0 0;background:#e8f3ef;border-radius:12px;padding:14px 18px}.fheadline strong{font-size:clamp(22px,2.5vw,32px);display:block}
        </style><div class="fheadline">${headline}</div><div class="fcompare"><figure><figcaption>歷年同期支出 · 1 至 ${n} 月（元）</figcaption><div class="fin-columns">${annual}</div>${breakdown}</figure><figure>${comparison}</figure></div>`;
        if(subject==='水費'||subject==='電費'){const [,step,min]=rules.find(([k])=>k===subject);const ps=periods(data,year,subject,step);const hits=ps.filter(p=>p.diff>=min&&p.diff/p.base>=0.25);insight+='<p><b>費用提醒：</b>'+(!ps.length?'歷史資料不足。':hits.length?hits.map(p=>(step===2?(p.month-1)+'–':'')+p.month+' 月').join('、')+'超過提醒門檻。請核對帳單期間、用量及費率。':'本期沒有超過提醒門檻。')+'</p>';}
      }
      return '<label>選擇支出項目 <select id="fin-sub">'+subjects.map(k=>'<option '+(subject===k?'selected':'')+'>'+safe(k)+'</option>').join('')+'</select></label>'+insight+'<details><summary>查看逐月金額</summary><div class="fin-scroll"><table><thead><tr><th>月份</th>'+ys.map(y=>'<th>'+y+' 年</th>').join('')+'</tr></thead><tbody>'+Array.from({length:12},(_,i)=>'<tr><th>'+(i+1)+' 月</th>'+ys.map(y=>{const v=data[y].items[subject]?.[i];return '<td>'+(v==null?'—':fmt(v))+'</td>'}).join('')+'</tr>').join('')+'</tbody></table></div></details>';};
    const months = r.expense.map((expense,i)=>({month:i+1, income:r.income[i], expense}));
    const scale = Math.max(1,...months.flatMap(m=>[Math.abs(m.income),Math.abs(m.expense)]));
    const trendRows = months.map(({month,income,expense}) => `<div class="flow-month"><strong>${month} 月</strong><div>${[income,expense].map((v,j)=>`<div class="flow-row"><span>${j?'支出':'收入'}</span><div class="flow-track"><em style="width:${100*Math.abs(v)/scale}%;background:${j?'#db681d':'#2376cd'}"></em></div><b>${fmt(v)}</b></div>`).join('')}</div></div>`).join('');
    const net = sum(r.income)-sum(r.expense);
    const shortMonths = months.filter(m=>m.expense>m.income).map(m=>m.month);
    const trend = `<section class="monthly-finance"><h2>逐月收入與支出</h2><p>${shortMonths.length?shortMonths.join('、')+' 月支出高於收入。':'本期各月收入均足以支付當月支出。'}</p><div aria-label="各月收支，單位新臺幣元">${trendRows}</div></section>`;
    const dep=r.deposits;
    let funds='<section><h2>社區資金現況</h2><p>本年度尚無已核對的存款明細。</p></section>';
    if(dep && [dep.land,dep.post,dep.fixed].every(x=>Number.isFinite(x)&&x>=0)){
      const liquid=dep.land+dep.post,total=liquid+dep.fixed,share=total?100*liquid/total:0;
      funds=`<section><h2>社區資金現況</h2><p>最近已核對：${year} 年 ${dep.month} 月底</p><div class="fin-metrics"><article><small>銀行存款合計</small><strong>${fmt(total)} 元</strong></article><article><small>活存餘額</small><strong>${fmt(liquid)} 元</strong><span>占存款 ${total?fmt(share)+'%':'—'}</span></article><article><small>定存餘額</small><strong>${fmt(dep.fixed)} 元</strong><span>占存款 ${total?fmt(100-share)+'%':'—'}</span></article></div>${total?`<div aria-hidden="true" style="height:14px;border-radius:7px;background:linear-gradient(to right,#2376cd ${share}%,#128473 ${share}%)"></div>`:''}<details><summary>查看存款明細</summary><p>土地銀行活存：${fmt(dep.land)} 元<br>郵局活存：${fmt(dep.post)} 元<br>土地銀行定存（${fmt(dep.count)} 筆）：${fmt(dep.fixed)} 元</p><p>零用金尚無核實金額，未計入銀行存款。</p></details></section>`;
    }
    const overviewStyle = `<style>#finance .fin-period-summary{margin-block:16px}#finance .fin-period-summary>.fin-metrics{margin-bottom:0}#finance .fin-metrics{grid-template-columns:repeat(auto-fit,minmax(min(100%,195px),1fr))}#finance .fin-metrics article{border-top:3px solid #719c98}#finance .fin-metrics .net{background:#e8f3ef;border-top-color:#17645e}#finance .monthly-finance{margin-bottom:16px}#finance .flow-month{display:grid;grid-template-columns:3em minmax(0,1fr);align-items:center;gap:12px;border-top:1px solid #dfE7ec;padding:9px 0}#finance .flow-row{display:grid;grid-template-columns:2em minmax(0,1fr) 7ch;gap:10px;align-items:center;margin:3px 0;font-variant-numeric:tabular-nums}#finance .flow-row b{text-align:right}#finance .flow-track{height:16px;background:#f0f4f8;border-radius:4px;overflow:hidden}#finance .flow-track em{display:block;height:100%;border-radius:4px}#finance .fin-panels button[data-item] i{height:13px;border-radius:4px;background:#5670d7}#finance .amount{font-variant-numeric:tabular-nums}#finance .fin-panels{align-items:start}#finance .fin-panels section:last-child>p{border-left:3px solid #b87634;padding:6px 12px;background:#faf7f1}</style>`;
    const diffs=prev?Object.entries(r.items).map(([k,v])=>[k,sum(v)-sum((prev.items[k]||[]).slice(0,n))]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,5):[];
    for (const [key] of diffs) if (active.some(([name])=>name===key) && !subjects.includes(key)) subjects.push(key);
    if (!subjects.includes(subject)) subject = subjects[0];
    const notices=rules.flatMap(([k,step,min])=>periods(data,year,k,step).filter(p=>p.pct>=25&&p.diff>=min).map(p=>'<p><b>'+k+' · '+(step===2?(p.month-1)+'–':'')+p.month+' 月</b><br>'+fmt(p.amount)+' 元，較同期中位數增加 '+fmt(p.diff)+' 元（'+fmt(p.pct)+'%）</p>'));
    root.innerHTML='<a href="'+location.pathname+location.search+'#/home">← 管理首頁</a><header><div><small>勝輝 NEXT1 社區</small><h1>社區財務</h1></div><label>年度 <select id="fin-year">'+years.map(y=>'<option '+(y===year?'selected':'')+'>'+y+'</option>').join('')+'</select></label></header><p>'+year+' 年 1 至 '+n+' 月｜金額單位：新臺幣元</p><nav>'+[['overview','財務總覽'],['history','歷年比較']].map(([v,t])=>'<button data-tab="'+v+'" aria-pressed="'+(v===tab)+'">'+t+'</button>').join('')+'</nav>'+(tab==='history'?'<section><h2>同期支出分析</h2>'+compare()+'</section>':overviewStyle+funds+'<section class="fin-period-summary"><h2>本年度收入與支出</h2><div class="fin-metrics">'+metric('income','累計收入')+metric('expense','累計支出')+`<article class="net"><small>本期收支差額</small><strong>${fmt(net)}</strong><span>${net>0?'收入高於支出':net<0?'支出高於收入':'收支持平'}</span></article>`+metric('balance','月底累計結餘')+'</div></section>'+trend+'<div class="fin-panels"><section><h2>哪些支出增加最多？</h2>'+ (diffs.length?diffs.map(([k,d])=>'<button data-item="'+safe(k)+'"><span>'+safe(k)+'</span><b>+'+fmt(d)+'</b><i style="width:'+Math.round(100*d/diffs[0][1])+'%"></i></button>').join(''):'尚無前一年度可比較')+'</section><section><h2>重要提醒</h2>'+(notices.join('')||(year<2025?'可比較歷史不足兩年':'本期沒有重要提醒'))+'<details><summary>查看水電費提醒規則</summary>以前二至三年同期中位數為基準。高出 25%，且電費單月至少增加 2,000 元，或水費雙月至少增加 300 元時提醒。水費以財報中列為「水費」的金額計算。</details></section></div>');
    root.querySelector('#fin-year').onchange=e=>{year=Number(e.target.value);render()};
    root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render()});
    root.querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>{subject=b.dataset.item;tab='history';render()});
    const pick=root.querySelector('#fin-sub');if(pick)pick.onchange=e=>{subject=e.target.value;render()};
  }
  render();
}
