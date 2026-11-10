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
      return '<label>比較科目 <select id="fin-sub">'+subjects.map(k=>'<option '+(subject===k?'selected':'')+'>'+safe(k)+'</option>').join('')+'</select></label><canvas aria-label="各年度每月支出走勢"></canvas><div class="fin-scroll"><table><thead><tr><th>月份</th>'+ys.map(y=>'<th>'+y+' 年</th>').join('')+'</tr></thead><tbody>'+Array.from({length:12},(_,i)=>'<tr><th>'+(i+1)+' 月</th>'+ys.map(y=>{const v=data[y].items[subject]?.[i];return '<td>'+(v==null?'—':fmt(v))+'</td>'}).join('')+'</tr>').join('')+'</tbody></table></div>';};
    const diffs=prev?Object.entries(r.items).map(([k,v])=>[k,sum(v)-sum((prev.items[k]||[]).slice(0,n))]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,5):[];
    const notices=rules.flatMap(([k,step,min])=>periods(data,year,k,step).filter(p=>p.pct>=25&&p.diff>=min).map(p=>'<p><b>'+k+' · '+(step===2?(p.month-1)+'–':'')+p.month+' 月</b><br>'+fmt(p.amount)+' 元，較同期中位數增加 '+fmt(p.diff)+' 元（'+fmt(p.pct)+'%）</p>'));
    root.innerHTML='<a href="#/home">← 管理首頁</a><header><div><small>勝輝 NEXT1 社區</small><h1>社區財務</h1></div><label>年度 <select id="fin-year">'+years.map(y=>'<option '+(y===year?'selected':'')+'>'+y+'</option>').join('')+'</select></label></header><p>'+year+' 年 1 至 '+n+' 月｜金額單位：新臺幣元</p><nav>'+[['overview','財務總覽'],['history','歷年比較']].map(([v,t])=>'<button data-tab="'+v+'" aria-pressed="'+(v===tab)+'">'+t+'</button>').join('')+'</nav>'+(tab==='history'?'<section><h2>各年度同期支出</h2>'+compare()+'</section>':'<div class="fin-metrics">'+metric('income','累計收入')+metric('expense','累計支出')+metric('balance','月底累計結餘')+'</div><div class="fin-panels"><section><h2>支出增加最多的科目</h2>'+ (diffs.length?diffs.map(([k,d])=>'<button data-item="'+safe(k)+'"><span>'+safe(k)+'</span><b>+'+fmt(d)+'</b><i style="width:'+Math.round(100*d/diffs[0][1])+'%"></i></button>').join(''):'尚無前一年度可比較')+'</section><section><h2>水電費提醒</h2>'+(notices.join('')||(year<2025?'可比較歷史不足兩年':'本期未達提醒門檻'))+'<details><summary>查看回測規則</summary>以前二至三年同期中位數為基準。高出 25%，且電費單月至少增加 2,000 元，或水費雙月至少增加 300 元時提醒。水費採原表「水費」科目。</details></section></div>');
    root.querySelector('#fin-year').onchange=e=>{year=Number(e.target.value);render()};
    root.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render()});
    root.querySelectorAll('[data-item]').forEach(b=>b.onclick=()=>{subject=b.dataset.item;tab='history';render()});
    const canvas=root.querySelector('canvas');
    if(canvas){
      const ys=years.filter(y=>y<=year);
      const colors=['#716789','#a47334','#49718d','#11675e'];
      const width=Math.max(280,canvas.clientWidth),height=190;
      const scale=window.devicePixelRatio||1;
      canvas.width=width*scale;canvas.height=height*scale;
      const ctx=canvas.getContext('2d');ctx.scale(scale,scale);
      const peak=Math.max(1,...ys.flatMap(y=>data[y].items[subject]||[]));
      ctx.font='12px system-ui';ctx.fillStyle='#405452';
      ctx.fillText(fmt(peak)+' 元',3,18);
      for(const [i,y] of ys.entries()){
        const values=data[y].items[subject];if(!values)continue;
        ctx.strokeStyle=ctx.fillStyle=colors[i];ctx.lineWidth=y===year?3:1.5;
        ctx.fillText(y+' 年',10+i*(width/4),height-4);
        ctx.beginPath();values.forEach((v,m)=>{const x=10+m*(width-24)/11,py=height-42-v/peak*(height-76);if(m===0)ctx.moveTo(x,py);else ctx.lineTo(x,py)});ctx.stroke();
      }
      ctx.fillStyle='#405452';ctx.fillText('1 月',4,height-24);ctx.fillText('12 月',width-36,height-24);
    }
    const pick=root.querySelector('#fin-sub');if(pick)pick.onchange=e=>{subject=e.target.value;render()};
  }
  render();
}
