// Traced from the supplied 1043 × 960 plan. All coordinates share the original frame.
const points={}, bays={};
function bay(n,x,y,w,h,angle=0){points[n]=[x+w/2,y+h/2];bays[n]={x,y,w,h,angle};}
function row(a,b,x,y,w,h,dx=0,dy=h){for(let n=a;n<=b;n++)bay(n,x+(n-a)*dx,y+(n-a)*dy,w,h);}
bay(1,660,141,43,65);bay(2,493,151,25,51);bay(3,340,151,25,51);
row(4,9,628,334,20,48,-20,0);bay(10,525,385,50,24);
bay(11,431,379,23,45,19);bay(12,426,424,22,49);bay(13,426,473,22,65);bay(14,448,658,26,58);
row(15,19,522,598,52,21);row(20,25,573,682,49,21,0,-21);row(26,33,664,594,50,21);
bay(34,714,747,60,24);bay(35,834,747,48,24);bay(36,878,690,23,46);bay(37,901,690,23,46);
for(let n=38;n<=41;n++)bay(n,919+(n-38)*13,727+(n-38)*19,50,21,-35);
row(42,45,828,817,48,22);row(46,49,724,883,49,22,0,-22);row(50,53,652,817,47,22);row(54,60,556,888,48,22,0,-22);
bay(61,145,290,50,24);bay(62,145,266,50,24);
export const spotPoints=points;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function laneContext(state){
 const used=new Set(state.lots.filter(l=>l.spot).map(l=>l.spot));
 const stallLines=Object.entries(bays).map(([n,b])=>{const kind=+n<4?'unavailable':state.event.pending_spot===+n?'proposed':used.has(+n)?'allocated':'available';return `<rect class="bay-fill ${kind}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" ${b.angle?`transform="rotate(${b.angle} ${points[n][0]} ${points[n][1]})"`:''}/>`;}).join('');
 const stairs=Array.from({length:12},(_,i)=>`<path d="M503 ${478+i*5.3} H530 M544 ${478+i*5.3} H572"/>`).join('');
 const leftRays=[[321,317,443,356],[315,332,436,369],[312,351,430,386],[312,372,427,402],[312,394,426,422],[312,417,426,443],[312,441,426,465],[312,465,426,487],[312,490,427,510],[312,515,432,534],[313,541,441,555],[320,566,448,579],[330,592,448,603],[345,616,448,628],[365,640,448,654],[389,662,448,678],[417,680,448,701]];
 const rightRays=[[717,337,858,256],[713,359,858,278],[710,383,859,302],[709,407,860,325],[709,430,861,350],[710,453,863,374],[712,476,865,401],[714,499,868,428],[714,522,872,455],[714,546,875,481],[714,570,878,509],[714,593,878,538],[714,617,878,568],[714,641,878,598],[714,665,878,628],[714,689,878,658],[714,713,878,688]];
 const rays=[...leftRays,...rightRays].map(([x,y,u,v])=>`<path d="M${x} ${y} L${u} ${v}"/>`).join('');
 const carBays=[[362,42,424,42,424,208,362,208],[424,208,459,42,493,208],[525,42,588,42,588,204,525,204],[590,42,654,42,654,205,590,205],[703,208,752,43,789,211],[789,78,847,78,856,232,789,232]];
 return `<svg class="redrawn-plan" viewBox="0 0 1043 960" role="img" aria-label="依原始平面圖重繪，保留安全梯、兩座電梯、排煙室、配電場所、完整車道及車位隔線">
 <defs><pattern id="wallHatch" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7L7 0" stroke="#aebbb8" stroke-width="1"/></pattern></defs>
 <path class="floor-outline" d="M118 14H790L871 65L885 314H898V566L1023 802L952 845H887V925H542V773L384 701Q297 622 290 563L312 342H118Z"/>
 <g class="car-bays">${carBays.map(a=>`<polygon points="${a.join(' ')}"/>`).join('')}<path d="M340 42H362V208H340Z M493 42H525V204H493Z M654 43H703V205H654Z"/></g>
 <g class="ramp-fill"><path d="M322 309Q386 270 454 351L426 424V541L448 579V716L384 686Q309 622 312 548V351Z"/><path d="M710 337Q764 255 858 231L879 566V696L714 741V458Z"/></g>
 <g class="ramp-lines">${rays}<path d="M322 309Q387 281 443 356 M322 319Q385 294 438 367 M714 337Q766 265 858 244 M714 741L878 696 M718 735L878 690"/></g>
 <g class="road-center"><path d="M347 320Q385 304 417 350Q365 478 379 565Q390 627 440 662"/><path d="M854 254Q787 275 758 331V718"/></g>
 <g class="rooms"><path d="M146 39H309V269H146Z"/><path d="M580 405H641V464H580Z M580 476H641V536H580Z"/><path d="M500 472H575V572H500Z"/><path d="M645 384H699V575H645V536H580V573H645 M500 433H574V472H500Z"/><path d="M659 46H703V91H659Z"/></g>
 <g class="wall-lines"><path d="M118 14H790L871 65L885 314 M130 28H786L858 78V315 M118 14V339H287 M146 39H309V269H222 M146 39V265H195 M309 39V269 M322 39V269 M312 342V552 M290 340V562 M312 552V576 M448 579V716 M474 716L542 752V773 M542 773V925H887V845H952 M554 778V913H875V834H946 M898 566L1023 802L952 845 M887 566L1008 798L947 834 M878 566V696L714 741 M714 741V594 M698 384V574H641 M575 384V433H500 M500 414V453 M500 472V572H575V536 M580 405H641V464H580Z M580 476H641V536H580Z"/></g>
 <g class="inner-lines"><path d="M585 411H636V458H585Z M585 482H636V530H585Z M581 397H642 M581 389L641 403 M581 403L641 389 M582 544H640V569H582Z M582 544L640 569 M582 569L640 544 M659 46L703 91 M659 91L703 46"/>${stairs}<path d="M530 478V550H544V478 M534 481V544H540V481 M503 545H530 M544 545H572 M515 481V535 M561 530V480"/></g>
 <g class="door-lines"><path d="M500 433V454Q520 454 520 434 M575 433H556Q556 414 575 414 M645 384V405Q665 405 665 385 M699 384V405Q679 405 679 385 M500 552H519Q519 571 500 571 M575 552H556Q556 571 575 571 M714 535H737Q737 557 715 557"/></g>
 <g class="columns"><path d="M289 112H310V143H289Z M493 114H518V145H493Z M493 323H518V351H493Z M686 322H710V350H686Z M850 316H898V346H850Z M289 558H313V592H289Z M686 573H712V596H686Z M871 565H905V594H871Z M498 815H529V849H498Z M700 818H724V846H700Z"/></g>
 <g class="rail-lines"><path d="M312 351V548 M318 354V549 M714 537H879 M714 542H879 M714 547H879 M878 596L937 681 M881 607L927 681 M886 627L916 681 M892 648L905 681 M878 689H937"/></g>
 <g class="plan-labels"><text x="227" y="153">台電配電場所</text><text x="602" y="263">防空避難室兼停車空間</text><text x="607" y="428">電梯 1</text><text x="607" y="499">電梯 2</text><text x="537" y="565">安全梯</text><text x="671" y="440">排煙室</text><text x="671" y="458">兼梯廳</text><text x="537" y="453">無障礙空間</text><text x="370" y="496">汽車坡道</text><text x="785" y="530">汽車坡道</text><text x="375" y="515" class="secondary">S=1:6</text><text x="785" y="549" class="secondary">S=1:8</text><text x="272" y="615" transform="rotate(63 272 615)" class="street-label">民 生 街</text><text x="580" y="27" class="secondary">24M 道路</text></g>
 <g class="car-numbers"><text x="394" y="182">汽車 44</text><text x="459" y="184">汽車 45</text><text x="556" y="181">汽車 46</text><text x="623" y="181">汽車 47</text><text x="753" y="185">汽車 48</text><text x="819" y="216">汽車 49</text></g>
 <g class="motorcycle-bays">${stallLines}</g></svg>`;
}
export function renderMap(state,{interactive=false,mapStyle='plan',zoom=1}={}){
 const used=new Map(state.lots.filter(l=>l.spot).map(l=>[l.spot,l]));
 const tile=(n,diagram)=>{const l=used.get(n),pending=state.event.pending_spot===n,closed=n<4,kind=closed?'unavailable':pending?'proposed':l?'allocated':'available';const label=closed?'不開放':pending?'待確認':l?'已選':'可選';return `<button type="button" class="parking-tile ${kind} ${diagram?'on-diagram':''}" ${diagram?`style="left:${(points[n][0]-9)/1043*100}%;top:${(points[n][1]-9)/960*100}%"`:''} ${closed||l||!interactive?'disabled':''} data-spot="${n}" aria-label="${n}號 ${label}${l?' '+escape(l.household):''}" title="${n}號 ${label}${l?'｜'+escape(l.household):''}"><b>${String(n).padStart(2,'0')}</b><span>${label}</span></button>`;};
 return `<div class="map-head"><h2 style="margin:0">車位配置</h2><div class="toolbar" style="margin:0"><button class="small" id="mapStyle">${mapStyle==='plan'?'編號清單':'原圖配置'}</button><a class="small" target="_blank" rel="noopener" href="parking-plan.jpg">原始配置圖 ↗</a></div></div><div class="parking-legend"><span class="available">可選車位</span><span class="allocated">已選車位</span><span class="proposed">待確認</span><span class="unavailable">不開放</span></div>${mapStyle==='plan'?`<div class="map-controls"><span>彩色平面圖・車位狀態即時更新</span><div><button id="zoomOut" class="small" aria-label="縮小車位圖" ${zoom<=1?'disabled':''}>−</button><b>${Math.round(zoom*100)}%</b><button id="zoomIn" class="small" aria-label="放大車位圖" ${zoom>=1.8?'disabled':''}>＋</button></div></div><div class="map-shell" tabindex="0" aria-label="原始車位平面圖，可左右及上下捲動"><div class="parking-diagram" style="--map-zoom:${zoom}">${laneContext(state)}${Array.from({length:62},(_,i)=>tile(i+1,true)).join('')}</div></div><p class="map-source">依原圖保留設施與車道配置。灰色車格不可選；可放大圖面或切換編號清單查看。</p>`:`<div class="readable-spot-grid">${Array.from({length:62},(_,i)=>tile(i+1,false)).join('')}</div>`}`;
}
