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
  const subjects=[...new Set(years.flatMap(y=>Object.keys(data[y].items)))];
  function render(){
    const r=data[year], n=r.expense.length, prev=data[year-1];
    const metric=(key,title)=>{
      const value=key==='balance'?r[key][n-1]:sum(r[key]);
      const base=prev&&(key==='balance'?prev[key][n-1]:sum(prev[key].slice(0,n)));
      const d=value-base;
      return '<article><small>'+title+'</small><strong>'+fmt(value)+'</strong><span>'+(prev?'較去年同期 '+(d>=0?'+':'')+fmt(d)+' 元'+(base?'（'+fmt(100*d/base)+'%）':''):'歷史起始年度')+'</span></article>';
    };
    const compare=()=>{const ys=years.filter(y=>y<=year);
      const valid=v=>Array.isArray(v)&&v.length>=n&&v.slice(0,n).every(Number.isFinite);
      const cur=r.items[subject], old=prev?.items[subject], title=safe(subject);
      let insight='<p>缺少可比較的同期資料，暫不判讀增減。</p>';
      if(valid(cur)&&valid(old)){
        const total=sum(cur.slice(0,n)), base=sum(old.slice(0,n)), delta=total-base;
        const changed=cur.slice(0,n).map((v,i)=>({i,d:v-old[i]}));
        const totals=ys.filter(y=>valid(data[y].items[subject])).map(y=>[y,sum(data[y].items[subject].slice(0,n))]);
        const maxTotal=Math.max(1,...totals.map(entry=>Math.abs(entry[1])));
        const maxChange=Math.max(1,...changed.map(entry=>Math.abs(entry.d)));
        const signed=value=>(value>0?'+':'')+fmt(value);
        const annual=totals.map(([y,value])=>`<div class="fy"><span>${y}</span><span class="track"><i style="width:${100*Math.abs(value)/maxTotal}%;background:${y===year?'#17665d':'#a6beba'}"></i></span><b>${fmt(value)}</b></div>`).join('');
        const months=changed.map(({i,d})=>`<div class="fm"><span>${i+1} 月</span><span class="axis"><i style="${d<0?'right':'left'}:50%;width:${50*Math.abs(d)/maxChange}%;background:${d<0?'#25766c':'#ad602a'}"></i></span><b>${signed(d)}</b></div>`).join('');
        insight=`<style>
          .fcompare{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,285px),1fr));gap:24px;margin:20px 0}
          .fcompare figure{margin:0;padding:20px;border:1px solid #d4e1de;border-radius:14px}
          .fcompare figcaption{font-weight:700;margin-bottom:15px}.fy,.fm{display:grid;grid-template-columns:3em 1fr 5.5em;align-items:center;gap:8px;font-variant-numeric:tabular-nums}
          .fy{margin:18px 0}.fm{margin:4px 0}.fy b,.fm b{text-align:right}.track,.axis{height:13px;position:relative}.track i,.axis i{display:block;position:absolute;height:100%;border-radius:3px}.axis{background:linear-gradient(to right,transparent 49.6%,#788b88 49.6% 50.4%,transparent 50.4%)}
          .fheadline{margin:20px 0 0;background:#e8f3ef;border-radius:12px;padding:18px}.fheadline strong{font-size:clamp(24px,3vw,38px);display:block}
        </style><div class="fheadline">${title} · 較去年同期<strong>${signed(delta)} 元 ${base>0?'（'+signed(delta/base*100)+'%）':''}</strong></div><div class="fcompare"><figure><figcaption>歷年同期支出 · 1 至 ${n} 月</figcaption>${annual}</figure><figure><figcaption>每月較去年增減 · 左減少／右增加</figcaption>${months}</figure></div>`;
        if(subject==='水費'||subject==='電費'){const [,step,min]=rules.find(([k])=>k===subject);const ps=periods(data,year,subject,step);const hits=ps.filter(p=>p.diff>=min&&p.diff/p.base>=0.25);insight+='<p><b>費用提醒：</b>'+(!ps.length?'歷史資料不足。':hits.length?hits.map(p=>(step===2?(p.month-1)+'–':'')+p.month+' 月').join('、')+'超過提醒門檻。請核對帳單期間、用量及費率。':'本期沒有超過提醒門檻。')+'</p>';}
      }
      return '<label>選擇支出項目 <select id="fin-sub">'+subjects.map(k=>'<option '+(subject===k?'selected':'')+'>'+safe(k)+'</option>').join('')+'</select></label>'+insight+'<details><summary>查看逐月金額</summary><div class="fin-scroll"><table><thead><tr><th>月份</th>'+ys.map(y=>'<th>'+y+' 年</th>').join('')+'</tr></thead><tbody>'+Array.from({length:12},(_,i)=>'<tr><th>'+(i+1)+' 月</th>'+ys.map(y=>{const v=data[y].items[subject]?.[i];return '<td>'+(v==null?'—':fmt(v))+'</td>'}).join('')+'</tr>').join('')+'</tbody></table></div></details>';};
    const diffs=prev?Object.entries(r.items).map(([k,v])=>[k,sum(v)-sum((prev.items[k]||[]).slice(0,n))]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,5):[];
    const notices=rules.flatMap(([k,step,min])=>periods(data,year,k,step).filter(p=>p.pct>=25&&p.diff>=min).map(p=>'<p><b>'+k+' · '+(step===2?(p.month-1)+'–':'')+p.month+' 月</b><br>'+fmt(p.amount)+' 元，較同期中位數增加 '+fmt(p.diff)+' 元（'+fmt(p.pct)+'%）</p>'));
    root.innerHTML='<a href="'+location.pathname+location.search+'#/home">← 管理首頁</a><header><div><small>勝輝 NEXT1 社區</small><h1>社區財務</h1></div><label>年度 <select id="fin-year">'+years.map(y=>'<option '+(y===year?'selected':'')+'>'+y+'</option>').join('')+'</select></label></header><p>'+year+' 年 1 至 '+n+' 月｜金額單位：新臺幣元</p><nav>'+[['overview','財務總覽'],['history','歷年比較']].map(([v,t])=>'<button data-tab="'+v+'" aria-pressed="'+(v===tab)+'">'+t+'</button>').join('')+'</nav>'+(tab==='history'?'<section><h2>同期支出分析</h2>'+compare()+'</section>':'<div class="fin-metrics">'+metric('income','累計收入')+metric('expense','累計支出')+metric('balance','月底累計結餘')+'</div><div class="fin-panels"><section><h2>哪些支出增加最多？</h2>'+ (diffs.length?diffs.map(([k,d])=>'<button data-item="'+safe(k)+'"><span>'+safe(k)+'</span><b>+'+fmt(d)+'</b><i style="width:'+Math.round(100*d/diffs[0][1])+'%"></i></button>').join(''):'尚無前一年度可比較')+'</section><section><h2>水電費提醒</h2>'+(notices.join('')||(year<2025?'可比較歷史不足兩年':'本期未達提醒門檻'))+'<details><summary>查看回測規則</summary>以前二至三年同期中位數為基準。高出 25%，且電費單月至少增加 2,000 元，或水費雙月至少增加 300 元時提醒。水費以財報中列為「水費」的金額計算。</details></section></div>');
    root.querySelector('#fin-year').onchange=e=>{year=Number(e.target.value);render()};
    root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render()});
    root.querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>{subject=b.dataset.item;tab='history';render()});
    const pick=root.querySelector('#fin-sub');if(pick)pick.onchange=e=>{subject=e.target.value;render()};
  }
  render();
}
