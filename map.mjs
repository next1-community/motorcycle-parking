const points={};
const line=(a,b,x,y,dx,dy)=>{for(let n=a;n<=b;n++)points[n]=[x+(n-a)*dx,y+(n-a)*dy];};
points[1]=[770,65];points[2]=[520,65];points[3]=[270,65];
line(4,9,670,145,-64,0);points[10]=[474,188];
line(11,14,280,220,0,70);line(15,19,390,370,0,36);
line(20,25,470,550,0,-36);line(26,33,580,330,0,36);
points[34]=[665,610];points[35]=[790,610];points[36]=[790,530];points[37]=[850,530];
line(38,41,910,550,10,40);line(42,45,790,662,0,36);
line(46,49,650,770,0,-36);line(50,53,520,662,0,36);
line(54,60,390,770,0,-36);points[61]=[96,250];points[62]=[96,210];
export const spotPoints=points;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function laneContext(){
 const leftSections=[[192,220,285,220],[166,245,260,245],[149,270,245,270],[138,295,234,295],[133,320,229,320],[133,345,231,345],[138,370,235,370],[150,395,245,395],[165,420,258,420],[184,445,277,445],[207,470,299,470],[236,495,317,495]];
 const rightSections=[[920,125,960,218],[875,144,960,240],[830,166,925,260],[792,191,890,282],[758,220,860,307],[732,250,835,334],[716,283,818,362],[710,320,805,390],[710,350,805,410],[710,380,805,430],[710,410,805,450]];
 const hatches=[...leftSections,...rightSections].map(([x,y,u,v])=>`<path d="M${x} ${y} L${u} ${v}"/>`).join('');
 const groups=[[322,121,384,48,6,'horizontal'],[356,346,68,188,5,'vertical'],[436,346,68,222,6,'vertical'],[546,306,68,294,8,'vertical'],[356,536,68,252,7,'vertical'],[486,638,68,150,4,'vertical'],[616,638,68,150,4,'vertical'],[756,638,68,150,4,'vertical'],[62,186,68,88,2,'vertical']];
 const dividers=groups.map(([x,y,w,h,n,dir])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`+Array.from({length:n-1},(_,i)=>dir==='vertical'?`<path d="M${x} ${y+(i+1)*h/n} h${w}"/>`:`<path d="M${x+(i+1)*w/n} ${y} v${h}"/>`).join('')).join('');
 return `<svg class="diagram-context" viewBox="0 0 1000 800" aria-hidden="true"><rect x="18" y="15" width="965" height="778" rx="12" fill="#f8faf5" stroke="#778870" stroke-width="2.5"/>
 <g fill="#edf2e7" stroke="#7a8a72" stroke-width="2"><path d="M245 175 C115 210 100 410 250 535 L330 575 L330 485 L295 465 C215 405 225 245 305 205 Z"/><path d="M960 110 C860 130 755 180 710 265 L710 440 L830 500 L860 470 L805 440 L805 320 C825 265 890 225 960 205 Z"/></g>
 <g stroke="#8e9b85" stroke-width="1.6" fill="none">${hatches}</g>
 <g stroke="#7d8e76" stroke-width="2" fill="none"><path d="M210 190 C155 255 155 415 270 505 L330 545"/><path d="M960 157 C870 176 802 221 760 290 L760 438 L845 485"/><path d="M620 330 V575 Q620 593 637 593 M695 330 V575 Q695 593 693 593"/><path d="M425 600 H485 M555 625 H615 M685 625 H755 M825 625 H880"/>${dividers}<rect x="440" y="164" width="68" height="48"/><rect x="631" y="586" width="68" height="48"/><rect x="756" y="586" width="68" height="48"/><rect x="756" y="506" width="128" height="48"/><path d="M820 506 V554 M880 521 L968 656 V695 L880 565 Z M899 553 L968 586 M909 590 L968 625 M919 627 L968 666"/></g>
 <g fill="#e7ecdf" stroke="#8d9b85" stroke-width="1.5"><rect x="45" y="35" width="145" height="120"/><rect x="376" y="220" width="155" height="108"/></g><g text-anchor="middle"><text x="117" y="98">配電室</text><text x="453" y="260">梯廳／電梯</text><text x="453" y="294">樓梯出入口</text></g>
 <g stroke="#8a9982" fill="none" stroke-width="1.6"><path d="M235 25 H950 V106 H235 Z M307 25 V106 M380 25 V106 M454 25 V106 M554 25 V106 M628 25 V106 M702 25 V106 M802 25 V106 M876 25 V106"/></g>
 <g class="car-labels" text-anchor="middle"><text x="344" y="45">汽車位44</text><text x="418" y="45">汽車位45</text><text x="590" y="45">汽車位46</text><text x="664" y="45">汽車位47</text><text x="840" y="45">汽車位48</text><text x="912" y="45">汽車位49</text></g>
 <text x="175" y="360" transform="rotate(-90 175 360)" class="lane-label">汽車坡道</text><text x="740" y="370" transform="rotate(90 740 370)" class="lane-label">汽車坡道</text><text x="90" y="735">車道</text><text x="865" y="735">車道</text></svg>`;
}
export function renderMap(state,{interactive=false,mapStyle='plan',zoom=1}={}){
 const used=new Map(state.lots.filter(l=>l.spot).map(l=>[l.spot,l]));
 const tile=(n,diagram)=>{const l=used.get(n),pending=state.event.pending_spot===n,closed=n<4,kind=closed?'unavailable':pending?'proposed':l?'allocated':'available';const label=closed?'不開放':pending?'待確認':l?'已選':'可選';return `<button type="button" class="parking-tile ${kind} ${diagram?'on-diagram':''}" ${diagram?`style="left:${(points[n][0]-28)/10}%;top:${(points[n][1]-17)/8}%"`:''} ${closed||l||!interactive?'disabled':''} data-spot="${n}" aria-label="${n}號 ${label}${l?' '+escape(l.household):''}" title="${n}號 ${label}${l?'｜'+escape(l.household):''}"><b>${String(n).padStart(2,'0')}</b><span>${label}</span></button>`;};
 return `<div class="map-head"><h2 style="margin:0">車位配置</h2><div class="toolbar" style="margin:0"><button class="small" id="mapStyle">${mapStyle==='plan'?'編號清單':'分區配置圖'}</button><a class="small" target="_blank" rel="noopener" href="parking-plan.jpg">原始配置圖 ↗</a></div></div><div class="parking-legend"><span class="available">可選車位</span><span class="allocated">已選車位</span><span class="proposed">待確認</span><span class="unavailable">不開放</span></div>${mapStyle==='plan'?`<div class="map-controls"><span>依原圖相對位置分區呈現</span><div><button id="zoomOut" class="small" aria-label="縮小車位圖" ${zoom<=1?'disabled':''}>−</button><b>${Math.round(zoom*100)}%</b><button id="zoomIn" class="small" aria-label="放大車位圖" ${zoom>=1.8?'disabled':''}>＋</button></div></div><div class="map-shell" tabindex="0" aria-label="車位分區示意圖，可左右及上下捲動"><div class="parking-diagram" style="--map-zoom:${zoom}">${laneContext()}${Array.from({length:62},(_,i)=>tile(i+1,true)).join('')}</div></div><p class="map-source">圖面可拖曳／捲動查看，使用「＋」放大編號。實際位置以原始配置圖及現場標示為準。</p>`:`<div class="readable-spot-grid">${Array.from({length:62},(_,i)=>tile(i+1,false)).join('')}</div>`}`;
}
