import {mountAccounts} from './accounts.js?v=card-2';
import {mountCalendar} from './calendar.js?v=edit-1';
import {startReveal, revealPage} from './rank-reveal.js?v=10';
import {renderPublicFlow} from '../public-flow.mjs?v=20261107-compact-roster';
import {renderRegistrationBoard} from './roster.mjs?v=admin-design-2';
import {filterArchive,demoArchive,renderHistory} from '../history.mjs?v=20261107-admin-1';
const testing = location.pathname.replace(/\/$/, '').endsWith('/testing');
const {config} = await import('./config.js');
import {renderMap} from '../map.mjs?v=20261107-fit-map';
import {households,demoSeed,demoAction,available,rules,VERSION} from '../engine.mjs';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const phaseName={registration:'開放登記',locked:'名單已鎖定',drawn:'抽籤完成',selecting:'依序選位',completed:'選位完成'};
const statusName={waiting:'待選位',selected:'已選位',delegated:'未到代排',waived:'已放棄',unallocated:'未分配'};
const prefix=testing?'next1-testing':'next1';
const demoKey=prefix+'-demo-v1',modeKey=prefix+'-mode',authKey=prefix+'-auth';
let mode=testing?'cloud':localStorage.getItem(modeKey)||'cloud',state=null,healthy=false,busy=false,connectionError='',mapStyle='plan',mapZoom=1,lookQuery='',receipt=null,session=JSON.parse(sessionStorage.getItem(authKey)||'null');
let refreshPromise=null,mapResizeObserver=null;
let adminSection='current',historyData=null,historyYear='',historyHousehold='',historySpot='',historyLoading=false,historyError='',historyRequest=0;
let displayConnected=false,lastAck=0,polling=false,formState={building:'215',household:'215-1F',quantity:1,token:'',consent:false},drawer='registrations';
const channel=new BroadcastChannel(prefix+'-test-screen-v1');
const route=()=>location.hash.replace('#/','').split('?')[0]||(testing?'home':'register');
// Keep operator inactivity independent of background polling and projection.
const idleKey=authKey+'-last-input', idleLimit=15*60*1000;
const isOperator=()=>!['register','display'].includes(route());
function idleExpired(){
 if(!session || !isOperator())return false;
 const now=Date.now(),last=Number(sessionStorage.getItem(idleKey));
 if(!last){sessionStorage.setItem(idleKey,String(now));return false;}
 if(now-last<idleLimit)return false;
 const token=session.access_token;
 session=null;sessionStorage.removeItem(authKey);sessionStorage.removeItem(idleKey);
 sessionStorage.setItem(authKey+'-notice','1');
 fetch(config.url+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:config.key,Authorization:'Bearer '+token},keepalive:true}).catch(()=>{});
 location.reload();return true;
}
function recordInput(event){
 if(!event.isTrusted || !session || !isOperator())return;
 if(idleExpired()){event.preventDefault();event.stopImmediatePropagation();return;}
 sessionStorage.setItem(idleKey,String(Date.now()));
}
for(const type of ['pointerdown','keydown','input','wheel','click'])window.addEventListener(type,recordInput,{capture:true,passive:false});
for(const type of ['focus','pageshow','hashchange'])window.addEventListener(type,idleExpired);
document.addEventListener('visibilitychange',idleExpired);
setInterval(idleExpired,1000);idleExpired();
if(sessionStorage.getItem(authKey+'-notice')){sessionStorage.removeItem(authKey+'-notice');setTimeout(()=>toast('已閒置 15 分鐘，請重新登入。'),100);}
const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),5000);}
async function api(path,body,auth=false){let headers={'apikey':config.key,'Content-Type':'application/json'};if(auth&&session?.access_token)headers.Authorization='Bearer '+session.access_token;const r=await fetch(config.url+path,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});if(r.ok && path==='/rest/v1/rpc/next1_test_save_account')return;let data;try{data=await r.json();}catch{throw Error('服務暫時無法回應，請重試');}if(!r.ok)throw Error(data.msg||data.message||data.error_description||data.error||'操作未完成');return data;}
async function ensureSession(){if(idleExpired())throw Error("請重新登入");if(!session||session.expires_at>Date.now()/1000+120)return;if(!session.refresh_token){session=null;sessionStorage.removeItem(authKey);return;}if(!refreshPromise)refreshPromise=api('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token}).then(next=>{if(!session)return;session={...next,expires_at:Date.now()/1000+next.expires_in};sessionStorage.setItem(authKey,JSON.stringify(session));}).catch(()=>{session=null;sessionStorage.removeItem(authKey);throw Error('登入已到期，請重新登入；已完成的作業均已保存。');}).finally(()=>{refreshPromise=null;});await refreshPromise;}
async function rpc(name,body={},auth=false){if(auth)await ensureSession();return api('/rest/v1/rpc/next1_test_'+name,body,auth);}
function saveDemo(s){localStorage.setItem(demoKey,JSON.stringify(s));}
function broadcastDisplay(snapshot){
 if(!snapshot)return;
 const registrations=snapshot.registrations.map(({household,quantity,sample})=>({household,quantity,sample}));
 channel.postMessage({type:'state',mode,editingRank,rankPage,state:{...snapshot,is_admin:false,registrations}});
}
function accept(s){if(state&&s.event.id===state.event.id&&s.event.revision<state.event.revision)return;state=s;healthy=true;connectionError='';if(route()!=='register')broadcastDisplay(s);}
async function load(render=true){if(polling)return;polling=true;try{if(mode==='demo'){const d=JSON.parse(localStorage.getItem(demoKey)||'null')||demoSeed();d.event.rules_version=VERSION;d.event.rules_text=rules;accept(d);}else if(!testing||route()!=='display'){const resident=route()==='register';const snapshot=resident?await rpc('registration_info'):await rpc('snapshot',{},true);if(snapshot)accept(snapshot);else state=null;}}catch(e){healthy=false;connectionError=e.message;}finally{polling=false;if(render)draw();if(route()==='admin'&&adminSection==='history'&&(mode==='demo'||state?.is_admin)&&!historyData&&!historyLoading&&!historyError)loadHistory();}}
function pageLink(page){return location.pathname+'?v='+encodeURIComponent(new URL(import.meta.url).searchParams.get('v')||'latest')+'#/'+page;}
function syncAdminRoute(){if(route()==='lookup')history.replaceState(null,'',location.pathname+location.search+'#/admin');adminSection=route()==='admin'&&new URLSearchParams(location.hash.split('?')[1]||'').get('view')==='history'?'history':'current';}
function header(loginPage=false){if(route()==='home' && state?.is_admin)return '<header class="home-account-bar"><strong>勝輝 NEXT1 社區</strong><nav aria-label="帳號操作"><button id="logout">登出</button></nav></header>';const resident=route()==='register';return `<header><a class="brand" href="${resident?'#/register':'#/home'}"><img src="logo.jpg" alt="NEXT1 社區標誌"><span><b>勝輝 NEXT1 社區${testing?' · 測試版':''}</b><small>${loginPage||route()==='home'?'社區物業管理中心':'MOTORCYCLE PARKING · 2027'}</small></span></a> ${loginPage||resident||['home','parking'].includes(route())?'':`<nav aria-label="管理功能"><a href="#/home">管理首頁</a><a href="#/parking">機車位管理</a><a href="#/admin" class="${route()==='admin'&&adminSection==='current'?'active':''}">本年度抽籤作業</a><a href="#/admin?view=history" class="${route()==='admin'&&adminSection==='history'?'active':''}">歷年中籤紀錄</a><a href="${pageLink('register')}" target="_blank" rel="opener">住戶登記申請 ↗</a><a href="${pageLink('display')}" id="publicNavLink" target="_blank" rel="noopener">開啟會議投放畫面 ↗</a></nav>`}</header>${resident||testing?'':`<div class="testbar ${healthy?'':'offline'}"><span><b>2027 年度</b>　機車位登記與公開選位</span><span><i class="dot"></i>${mode==='demo'?'現場演練模式':healthy?'系統連線正常':'系統連線中'}　${route()==='admin'?`<button id="switchMode">${mode==='demo'?'返回年度作業':'進入演練模式'}</button>`:''}</span></div>`}`;}

function footer(){if(route()==='home' && state?.is_admin)return '<footer class="property-footer"><b>NEXT1 社區物業管理中心</b><nav aria-label="頁尾導覽"><a href="#/admin?view=history">歷年中籤紀錄</a><button id="homeTop">回到頁首 ↑</button></nav></footer>';if(['home','parking'].includes(route()))return '';if(route()==='register')return `<footer class="resident-footer">勝輝 NEXT1 公寓大廈管理委員會</footer>`;return `<footer><span>勝輝 NEXT1 公寓大廈管理委員會｜2027 機車位登記與選位系統</span><span>1、2 號不開放，3 號指定使用 · 4～62 號共 59 格 · 依戶別公開抽籤</span></footer>`;}
function stats(){const n=state.registrations.reduce((a,r)=>a+r.quantity,0),used=state.lots.filter(l=>l.spot).length;return `<div class="stats"><div class="stat"><small>已登記戶別</small><strong>${state.registrations.length}<small> 戶</small></strong></div><div class="stat"><small>抽籤名額</small><strong>${n}<small> 個</small></strong></div><div class="stat"><small>已選車位</small><strong>${used}<small> 格</small></strong></div><div class="stat green"><small>尚可選擇</small><strong>${59-used}<small> 格</small></strong></div></div>`;}
function phaseFlow(){
 const steps=[['registration','確認登記名單'],['locked','鎖定名單'],['drawn','公布抽籤順位'],['selecting','依序選位'],['completed','確認選位結果']];
 const action={registration:['lock','截止登記並鎖定名單'],locked:['draw','抽出選位順位'],drawn:['start','開始依序選位']}[state.event.phase];
 const current=steps.findIndex(([key])=>key===state.event.phase);
 return `<section class="admin-progress" aria-label="抽籤作業進度"><div class="progress-title"><strong>抽籤作業進度</strong><small>第 ${current+1} 步，共 5 步</small></div><ol>${steps.map(([key,label],i)=>`<li class="${i<current?'done':i===current?'active':'future'}" ${i===current?'aria-current="step"':''}><i>${i<current?'✓':i+1}</i><b>${label}</b>${i===current?'<small>目前階段</small>':''}</li>`).join('')}</ol>${action?`<div class="flow-action">${state.event.phase==='locked'&&!state.lots.length?'<button data-action="reopen">重新開放登記</button>':''}<span>下一步：${steps[current+1][1]}</span><button class="primary" data-action="${action[0]}">${action[1]} →</button></div>`:''}</section>`;
}
function rulesBox(){return `<div class="rulesbox"><details><summary>閱讀管理辦法與 2027 年度規則</summary><pre>${esc(state.event.rules_text)}</pre><a href="rules.pdf" target="_blank" rel="noopener">開啟完整原管理辦法 PDF ↗</a></details><p class="note">版本：${esc(state.event.rules_version)}<br>2027 年不開放額外第二格登記或候補；225 號 8F～15F 固有的兩個名額照常辦理。</p></div>`;}
function registerView(){const buildings=[...new Set(households.map(h=>h.id.replace(/-\d+F$/,'')))],hs=households.filter(h=>h.id.replace(/-\d+F$/,'')===formState.building),quota=households.find(h=>h.id===formState.household)?.quota||1;return `<div class="resident-application"><section class="card"><div class="resident-title"><h1>2027 年度機車位登記申請</h1><p>使用期間：2027 年 4 月 1 日至 2028 年 3 月 31 日</p><span class="pill">${state.event.phase==='registration'?'開放登記':'登記已截止'}</span></div><p class="muted">請選擇戶別及申請名額，閱讀管理辦法後送出。</p>${receipt?`<div class="success"><h3>${esc(receipt.household)} 登記完成</h3><p>本次申請 <b>${receipt.quantity}</b> 個名額。<br>請保存修改碼，修改或取消時需使用。</p><code>${esc(receipt.token)}</code><button class="small" id="copyToken">複製修改碼</button></div>`:''}<form id="registerForm"><div class="form-row"><label class="field">門牌<select id="building">${buildings.map(b=>`<option ${b===formState.building?'selected':''} value="${b}">${b} 號</option>`).join('')}</select></label><label class="field">樓層<select id="household">${hs.map(h=>`<option ${h.id===formState.household?'selected':''} value="${h.id}">${h.id.match(/-(\d+F)$/)[1]}</option>`).join('')}</select></label></div><label class="field">申請抽籤名額<select id="quantity">${Array.from({length:quota},(_,i)=>i+1).map(n=>`<option ${n===formState.quantity?'selected':''} value="${n}">${n} 個名額${n===2?'（各自抽出選位順位）':''}</option>`).join('')}</select></label><details style="margin:16px 0"><summary>修改／取消原登記</summary><label class="field">原登記修改碼<input id="modifyToken" value="${esc(formState.token)}" placeholder="首次登記請留空，系統將產生修改碼" autocomplete="off"></label><button id="cancelReg" type="button" class="small danger">取消本戶年度登記</button><p class="note">同戶不能重複增加名額。修改原登記需使用原修改碼。</p></details>${rulesBox()}<label class="consent"><input type="checkbox" id="consent" ${formState.consent?'checked':''}><span>我已閱讀並同意本次適用的完整管理辦法及 2027 年度規則，確認戶別與申請數量正確。</span></label><button class="primary wide" type="submit" ${state.event.phase!=='registration'||busy?'disabled':''}>${busy?'正在保存…':state.event.phase==='registration'?'確認並送出登記 →':'登記已截止'}</button><p class="note">系統將保留本次登記及管理辦法同意紀錄。登記完成後請妥善保存修改碼。</p></form></section></div>`;}
let rankPage = 0;
function showRankPage(page) {
 rankPage=page;
 draw();
 if (route()==='admin' && state.event.phase==='completed') broadcastDisplay(state);
}
function table(type='lots'){
 const isLots=type==='lots', rows=isLots?state.lots:state.registrations;
 const completed=isLots && state.event.phase==='completed';
 const paged=completed || (isLots && route()==='admin');
 const pageSize=completed ? 20 : 8;
 const pageCount=Math.ceil(rows.length/pageSize);
 rankPage=Math.min(rankPage, Math.max(0,pageCount-1));
 const list=paged?rows.slice(rankPage*pageSize,(rankPage+1)*pageSize):rows;
 const pager=paged && pageCount>1 ? `<nav class="rank-pager" aria-label="順位清單分頁"><button id="rankPrev" ${rankPage===0?'disabled':''}>‹ 上一頁</button><label>第 <select id="rankPage" aria-label="選擇順位頁碼">${Array.from({length:pageCount},(_,i)=>`<option value="${i}" ${rankPage===i?'selected':''}>${i+1}</option>`).join('')}</select> / ${pageCount} 頁</label><button id="rankNext" ${rankPage===pageCount-1?'disabled':''}>下一頁 ›</button><span>第 ${list[0].rank}～${list.at(-1).rank} 順位，共 ${rows.length} 筆</span></nav>`:'';
 const renderTable=group=>`<div class="table-wrap ${paged?'paged-ranks':''}"><table><thead><tr>${(isLots?['順位','戶別','名額','車位','狀態']:['戶別','申請名額','登記狀態']).map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${group.map(r=>`<tr class="${isLots&&r.rank===state.event.current_rank?'current':''}">${isLots?`<td>${r.rank}</td><td>${esc(r.household)}</td><td>${r.slot}</td><td>${r.spot?String(r.spot).padStart(2,'0'):'—'}</td><td>${lotStatus(r)}</td>`:`<td>${esc(r.household)}</td><td>${r.quantity}</td><td>${'已登記'}</td>`}</tr>`).join('')||`<tr><td colspan="5" class="empty">${isLots?'尚未產生抽籤順位':'尚無登記資料'}</td></tr>`}</tbody></table></div>`;
 if (!completed) return renderTable(list)+pager;
 const groups=[list.slice(0,10)];
 if(list.length>10) groups.push(list.slice(10));
 const pageFooter=route()==='display' && list.length ? `<p class="rank-pager">第 ${rankPage+1} / ${pageCount} 頁　　第 ${list[0].rank}～${list.at(-1).rank} 順位，共 ${rows.length} 筆</p>` : pager;
 return `<div class="final-rank-columns">${groups.map(renderTable).join('')}</div>${pageFooter}`;
}
function annualLookup(){const query=lookQuery.trim().toUpperCase(),hs=[...new Set([...state.registrations.map(r=>r.household),...state.lots.map(l=>l.household)])].filter(h=>h.toUpperCase().includes(query));return `<section id="annualLookup" class="card annual-lookup" style="margin-top:23px"><h2>戶別登記與選位查詢</h2><form id="annualLookupForm" class="toolbar lookup-search"><label for="lookup">本年度戶別</label><input id="lookup" value="${esc(lookQuery)}" placeholder="輸入戶別，例如 225-8F" aria-label="本年度戶別查詢"><button class="primary" type="submit">查詢</button><button id="clearAnnualLookup" type="button">清除</button></form>${!query?'<p class="muted">輸入戶別，查詢申請名額、抽籤順位及選位結果。</p>':hs.map(h=>{const r=state.registrations.find(r=>r.household===h),lots=state.lots.filter(l=>l.household===h);return `<div class="result-card"><div class="split"><h3>${esc(h)}</h3><span class="pill">${r?.quantity||lots.length} 個名額</span></div>${lots.length?lots.map(l=>`<p>名額 ${l.slot}　／　第 ${l.rank} 順位　／　<b>${l.spot?l.spot+' 號車位':lotStatus(l)}</b></p>`).join(''):'<p class="muted">已完成登記，尚未抽出順位。</p>'}</div>`;}).join('')||'<p class="empty">找不到符合的戶別</p>'}</section>`;}

function mapHTML(interactive=false){return renderMap(state,{interactive,mapStyle,zoom:mapZoom});}
function current(){return state.lots.find(l=>l.rank===state.event.current_rank);}
function nextList(showSlot = true, limit = 3){return `<ul class="nextlist">${state.lots.filter(l=>l.rank>state.event.current_rank).slice(0,limit).map(l=>`<li><small>${String(l.rank).padStart(2,'0')} 順位</small><b>${l.household}</b>${showSlot ? `<small>名額 ${l.slot}</small>` : ''}</li>`).join('')||'<li>已是最後一位</li>'}</ul>`;}
function lotStatus(lot){return lot?.status==='waitlisted'?'備取 '+lot.waitlist_rank+' 號':statusName[lot?.status];}
function loginView(){return `<div class="card login"><style>
@media(max-width:800px) {
  .view-login #app main:has(> .login) {padding:clamp(68px,12svh,96px) 16px 24px;align-content:start}
  .view-login #app main:has(> .login)::before {
    inset:0; width:100%; height:100%; transform:none; aspect-ratio:auto;
    background-size:auto clamp(310px,65svh,530px); background-position:70% -24px;
    opacity:.44; mask-image:linear-gradient(to bottom,#000 12%,transparent 78%);
    pointer-events:none;
  }
  .view-login #app main > .login {background:rgba(255,255,255,.94)}
  .view-login .login .eyebrow {display:none}
  .view-login .login input {font-size:16px}
}
</style><span class="eyebrow">MANAGEMENT ACCESS</span><h1>管理中心登入</h1><p class="muted">請使用系統管理員為您開通的電子郵件帳號及密碼登入。</p><form id="loginForm"><label class="field">帳號<input id="email" type="email" autocomplete="username" required></label><label class="field">密碼<input id="password" type="password" autocomplete="current-password" required></label><button class="primary wide" ${busy?'disabled':''}>登入管理後台</button></form><p class="note">如需申請帳號或調整權限，請聯絡系統管理員。</p>${testing?'':'<button class="wide" id="demoEntry" style="margin-top:18px">進入現場演練</button>'}</div>`;}
let editingRank = null;
function changeControls(event, lot) {
 if (!lot?.spot) return '';
 if (event.pending_spot) return `<div class="pending"><b>${lot.spot} 號改為 ${event.pending_spot} 號</b><div class="toolbar"><button class="primary" data-action="change_confirm">確認更改</button><button data-action="change_cancel">取消更改</button></div></div>`;
 if (editingRank === lot.rank) return '<p>請點選右側可用車格，原車位會保留至確認更改。</p><button id="cancelEdit">取消更改</button>';
 return '<button id="editSpot">更改車位</button>';
}
function homeView(){
  if(mode==='cloud' && !state.is_admin)return loginView();
  const phases={
    registration:['開放登記','查看登記名單'],locked:['名單已鎖定','前往抽籤'],
    drawn:['順位已公布','查看抽籤順位'],selecting:['依序選位中','繼續選位'],
    completed:['選位完成','查看選位結果']
  };
  const [status,action]=phases[state.event.phase] || ['作業進行中','開啟本年度作業'];
  const icons = {
    '機車位': '<circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M2 13h6l3 4h3l3-5-2-7h-3m4 3h3M4 10h5"/>',
    '汽車位': '<path d="m4 11 2-6h12l2 6m-16 0h16l1 2v5H3v-5zM5 18v2m14-2v2m-13-6h2m8 0h2"/>',
    '社區弱電設備': '<rect x="4" y="3" width="16" height="7" rx="2"/><path d="M7 6.5h4m5 0h1M12 10v5m-7 3v-3h14v3"/><circle cx="5" cy="20" r="1.5"/><circle cx="19" cy="20" r="1.5"/>',
    '社區資產': '<path d="m3 7 9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4m-9 4v10M8 5l9 4"/>'
  };
  const moduleLabel = name => `<span class="module-label"><svg aria-hidden="true" focusable="false" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>${name}</span>`;
  const upcomingCard=name=>`<section class="home-module home-upcoming"><h3>${moduleLabel(name)}</h3><small>即將推出</small></section>`;
  return `<style>
  .community-home{max-width:1100px;margin:20px auto;color:#17374b}
  .view-home .home-account-bar{display:flex;justify-content:flex-end;padding-block:8px;min-height:0}
  .view-home .home-account-bar{justify-content:space-between;background:#173f44;color:white;border:0;padding:10px clamp(20px,5vw,80px)}
  .home-account-bar strong{letter-spacing:.08em}
  .home-identity .home-brand{background:#dcece6}
  .view-home .home-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .view-home .home-module{min-height:74px;padding:18px 22px}
  .view-home .home-grid>:is(a,button.module-entry){border-left:5px solid #187269}
  .view-home .property-footer{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;background:#173f44;color:white;box-sizing:border-box;width:100%;max-width:none;padding:18px max(28px,calc((100% - 1100px)/2));margin:20px 0 0}
  @media(max-width:850px){.view-home .property-footer{padding-inline:18px}}
  .property-footer nav{display:flex;align-items:center;gap:18px}.property-footer a{color:white;text-decoration:underline}.property-footer button{background:transparent;color:white;border:1px solid #9db5b4;padding:6px 12px}
  @media(max-width:600px){.view-home .home-grid{grid-template-columns:1fr}}
  .home-account-bar nav{display:flex;justify-content:flex-end}
  .home-identity{display:grid;grid-template-columns:1.2fr 1fr;overflow:hidden;border:1px solid #cad8d4;border-radius:18px;background:white}
  .home-brand{display:flex;align-items:center;gap:clamp(10px,2vw,22px);padding:clamp(18px,3vw,40px)}
  .home-brand img{width:clamp(44px,5.5vw,70px);height:auto;mix-blend-mode:multiply}.home-brand{isolation:isolate}
  .home-brand h1{font-size:clamp(23px,3vw,40px);margin:6px 0 0;color:#17374b}
  .home-brand small{color:#45675e}.home-photo{width:100%;height:clamp(145px,16vw,200px);object-fit:cover;object-position:center 53%}
  @media(max-width:650px){.home-identity{grid-template-columns:1fr}.home-photo{height:110px}}
  .home-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:clamp(24px,4vw,52px);border-radius:18px;background:linear-gradient(90deg,#103441 5%,rgba(16,52,65,.75) 55%,transparent),url("testing/community-lobby.jpg") center 48%/cover}
  .home-banner h1{color:white;margin:0;font-size:clamp(24px,4vw,42px)}
  .community-home .home-section-heading{display:flex;align-items:center;gap:14px;margin:clamp(24px,3vw,36px) 0 12px;color:#40565d;font-size:1.05rem;font-weight:600;line-height:1.5}
  .home-section-heading::after{content:"";height:1px;flex:1;background:#d1dcda}
  .home-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:16px}
  .home-module{padding:22px;border:1px solid #c4d7d3;border-radius:14px;background:white}
  .home-module h3{font-size:1.35rem;margin:0}
  .home-module p{margin:10px 0;color:#274a50}
  .home-module .home-actions{display:flex;flex-wrap:wrap;align-items:center;gap:14px;margin-top:16px}
  .home-actions a{font-weight:700;color:#126157}.home-actions a:first-child{padding:9px 16px;background:#126157;color:white;border-radius:8px;text-decoration:none}
  .home-upcoming{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#eef1f2;color:#535e65;border-color:#dce1e3}
  .home-upcoming small{background:#dfe4e6;padding:4px 9px;border-radius:6px;white-space:nowrap}
  .module-entry{display:flex;align-items:center;justify-content:space-between;text-decoration:none;color:#124f48;min-height:82px;font-size:1.35rem;font-weight:700}
  .module-entry:hover,.module-entry:focus-visible{border-color:#126157;background:#f1f8f5}
  .archive-result{background:#e1f0ea;color:#13473e;padding:10px 16px;font-size:1.25rem;font-weight:700;position:sticky;top:0;z-index:3}.archive-plan-body .parking-tile[aria-pressed=true]{background:#ffda47;outline:3px solid #244d4a}.archive-plan-body .parking-tile{cursor:pointer}
  .module-label{display:inline-flex;align-items:center;gap:.7rem}.module-label svg{flex:none}
  .community-home .registration-tools{display:flex;align-items:center;flex-wrap:nowrap;gap:6px;padding-right:12px;border:1px solid #cadbd7;border-radius:14px;background:white}
  .registration-tools a.module-entry{min-width:0;border:0;background:transparent}
  #registrationQr{display:grid;place-items:center;width:44px;height:44px;flex:none;padding:0;color:#125f55;background:#eef6f3;border-radius:10px}
  #registrationQr:hover,#registrationQr:focus-visible{background:#d9ede6;outline:2px solid #18685e}
  .module-nav{display:flex;flex-wrap:wrap;gap:18px;margin:20px 0}
  </style><section class="community-home">${route()==='parking'?`
  <a class="module-nav" href="#/home">← 管理首頁</a><div class="home-banner"><h1>機車位管理</h1><button id="logout">登出</button></div>
  <details class="home-module" id="archivePlan"><summary style="cursor:pointer;font-weight:700;font-size:1.25rem">車位平面圖 · 2026 年度</summary><div class="archive-plan-body"></div></details>
  ${annualLookup().replace("戶別登記與選位查詢","依戶別查詢車位編號")}<h2 class="home-section-heading">年度抽籤作業</h2><section class="home-module"><h3>2027 年度機車位抽籤</h3>
  <p>${status}${state.event.phase==='selecting'?' · 目前第 '+Number(state.event.current_rank)+' 順位':''}</p><div class="home-actions"><a href="#/admin">${action} →</a></div></section>
  <h2 class="home-section-heading">查詢與現場作業</h2><div class="home-grid">
  <a class="home-module module-entry" href="#/admin?view=history">歷年中籤紀錄 →</a>
  <div class="registration-tools"><a class="home-module module-entry" href="${pageLink('register')}" target="_blank" rel="opener">住戶登記申請 ↗</a><button type="button" id="registrationQr" aria-label="顯示登記 QR Code" title="顯示登記 QR Code" aria-haspopup="dialog"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M2 2h9v9H2zM4 4v5h5V4zM13 2h9v9h-9zM15 4v5h5V4zM2 13h9v9H2zM4 15v5h5v-5z"/><path d="M5 5h3v3H5zm11 0h3v3h-3zM5 16h3v3H5zm8-3h4v2h-2v3h-2zm6 0h3v4h-3zm-2 4h2v3h3v2h-5zm-4 3h2v2h-2z"/></svg></button></div>
  <a class="home-module module-entry" href="${pageLink('display')}" target="_blank" rel="noopener">開啟會議投放畫面 ↗</a></div>`:`
  <div class="home-identity"><div class="home-brand"><img src="logo.jpg" alt="勝輝 NEXT1 社區標誌"><div><small>社區物業管理中心 · 測試版</small><h1>NEXT1社區管理系統</h1></div></div><img class="home-photo" src="testing/community-lobby.jpg" alt="社區大廳旋轉樓梯"></div>
  <h2 class="home-section-heading">車位與設備管理</h2><div class="home-grid">
  <a class="home-module module-entry" href="#/parking">${moduleLabel('機車位')} <span aria-hidden="true">→</span></a>
  ${upcomingCard('汽車位')}
  ${upcomingCard('社區弱電設備')}${upcomingCard('社區資產')}</div><section class="staff-accounts"></section><div class="community-calendar"></div>`}</section>`;
}
function adminView(){if(mode==='cloud'&&!state.is_admin)return loginView();if(adminSection==='history')return `<div class="pagehead"><div><h1>歷年中籤紀錄</h1></div>${mode==='cloud'?'<button class="quiet small" id="logout">登出</button>':''}</div>${renderHistory({data:historyData,year:historyYear,household:historyHousehold,spot:historySpot,loading:historyLoading,error:historyError,demo:mode==='demo'})}`;const e=state.event,l=current(),isSelecting=e.phase==='selecting';return `<div class="pagehead"><div><div class="eyebrow">COMMUNITY MANAGEMENT</div><h1>本年度抽籤作業</h1><p class="muted">名單確認、公開抽籤、依序選位與本年度結果查詢。</p></div><div>${mode==='cloud'?'<button class="quiet small" id="logout">登出</button>':''}</div></div>${phaseFlow()}${isSelecting?`<div class="admin-grid"><div class="card admin-stage"><div class="rank-label">現在輪到 · CURRENT TURN</div><div class="rank-number">${String(e.current_rank).padStart(2,'0')}</div><div class="house">${l?.household||'—'}</div><span class="pill">名額 ${l?.slot||1}</span><p class="note">請住戶口述車位號碼，輸入後於投放畫面核對。</p>${l?.status==='waiting'?`<div class="spot-input" style="margin-top:20px"><input id="spotNumber" type="number" min="4" max="62" placeholder="車位號碼" aria-label="車位號碼"><button class="primary" id="propose">顯示待確認</button></div>${e.pending_spot?`<div class="pending"><small>${e.pending_mode==='delegated'?'未到代排':'住戶選擇'} · 請覆誦並確認</small><b>${l.household} → ${e.pending_spot} 號</b><div class="toolbar"><button class="primary" data-action="confirm">確認選位</button><button data-action="clear">重新選擇</button></div></div>`:''}<div class="toolbar"><button class="small" id="delegate">未到場，建議最小可用號碼</button><button class="small danger" data-action="waive">記錄本名額放棄</button></div>`:`<div class="success"><h3>${l?.spot?l.spot+' 號車位已選定':statusName[l?.status]||''}</h3>${changeControls(e,l)}<button class="primary" ${e.pending_spot || editingRank===l?.rank?'disabled':''} data-action="next">${testing&&!available(state).length?'完成選位並公布備取':'叫下一位 →'}</button></div>`}<h3 style="margin-top:25px">接下來請準備</h3>${nextList()}</div><div class="card">${mapHTML(l?.status==='waiting' || editingRank===l?.rank || !!e.pending_spot)}</div></div>`:''}${stats()}<div class="toolbar"><button id="showAnnualLookup">查詢戶別</button><button id="exportResults">匯出目前清冊</button>${mode==='demo'?'<button id="resetDemo" class="danger">重設演練進度</button>':''}<span class="note" id="displayHealth">${displayConnected?Date.now()-lastAck<5000?'● 投放畫面已連接':'投放畫面回應中斷，請先檢查':'尚未開啟會議投放畫面'}</span></div>${annualLookup()}<div class="card" style="margin-top:23px"><div class="split"><h2>${drawer==='lots'?'抽籤順位與選位結果':'住戶登記名單'}</h2><button class="small" id="toggleTable">${drawer==='lots'?'查看登記':'查看順位'}</button></div>${drawer==='lots'?table(drawer):renderRegistrationBoard(state,{admin:true})}</div>`;}
function displayView(){
 const cards = state.event.phase === 'drawn' && revealPage();
 if (cards) return cards;
 const e=state.event,l=current(),used=state.lots.filter(l=>l.spot).length;let recent=state.lots.filter(l=>l.spot).at(-1);return `<div class="display-head"><div><div class="eyebrow">LIVE LOTTERY & PARKING SELECTION</div><h1>${e.phase==='selecting'?'依序選位':e.phase==='drawn'?'抽籤順位已公布':e.phase==='completed'?'本年度機車位選位結果':'2027 年度機車位公開抽籤'}</h1></div><div><span class="pill">${phaseName[e.phase]}</span> <button class="small" id="fullscreen">全螢幕</button></div></div>${renderPublicFlow(e.phase).replace('確認分配結果','確認選位結果').replace('本次選位已完成，請核對戶別及分配車位。','')}${e.phase==='selecting'?`<div class="display-layout"><aside class="display-rank"><div class="rank-label">現在輪到 · 第幾順位</div><div class="rank-number">${String(e.current_rank).padStart(2,'0')}</div><div class="house">${l?.household||'—'}</div>${e.pending_spot?`<div class="pending"><small>待確認${e.pending_mode==='delegated'?' · 未到代排':''}</small><b>${l?.spot ? l.spot+' 號改為 '+e.pending_spot+' 號' : '選擇 '+e.pending_spot+' 號車位'}</b></div>`:editingRank===e.current_rank && l?.spot ? `<div class="pending"><b>正在更改車位</b><small>原 ${l.spot} 號車位仍保留</small></div>`:`<p style="margin-top:20px">${l?.status==='waiting'?'請口述欲選車位號碼':l?.spot?'✓ '+l.spot+' 號車位已選定':'本名額已放棄'}</p>`}<h3 style="margin-top:30px;color:#c2d6bf">接下來請準備</h3>${nextList(false, 8)}</aside><section class="card"><dl class="parking-counts"><div><dt>可選車位</dt><dd><strong>${59-used}</strong> 格</dd></div><div><dt>已選車位</dt><dd><strong>${used}</strong> 格</dd></div></dl>${mapHTML(false)}</section></div><div class="display-footer">${recent?`已完成：第 ${recent.rank} 順位　${recent.household} → ${recent.spot} 號車位`:'請依叫號口述車位，並核對畫面後確認。'}<span style="float:right">請接下來三位住戶預先準備</span></div>`:e.phase==='drawn'||e.phase==='completed'?`<div class="draw-board">${e.phase==='drawn'?'<p class="selection-cue"><strong>等候時</strong>，可先在螢幕上看好 1～2 個想選的車位，並留意車位是否仍可選。<br><strong>輪到您的戶別時</strong>，請從螢幕上仍可選的車位中選一格，說出車位號碼即可。</p>':'<p class="selection-cue">請核對您的戶別、車位號碼或備取順位。</p>'}${table('lots')}</div>`:renderRegistrationBoard(state)}`;}
function draw(){
 if(route()==='display' && state?.event.phase==='drawn' && document.querySelector('.rank-reveal')?.dataset.page===String(revealPage.index) && revealPage.index>=0)return;
 syncAdminRoute();document.title=(route()==='home'?'NEXT1社區管理系統':route()==='parking'?'機車位管理':route()==='register'?'2027 年度機車位登記申請':route()==='admin'?(adminSection==='history'?'歷年中籤紀錄':'本年度抽籤作業'):route()==='display'?'會議投放畫面':'登記與選位結果')+'｜NEXT1 社區';document.body.className='view-'+route();let content=testing&&!session&&!state&&!['display','register'].includes(route())&&!connectionError?loginView():!state?`<div class="card"><h1>正在載入機車位服務</h1><p>${healthy?'載入資料中…':esc(connectionError||'正在讀取資料…')}</p><button id="retry">重新連線</button> ${!testing&&route()==='admin'?'<button id="demoEntry">管理中心演練</button>':''}</div>`:['home','parking'].includes(route())?homeView():route()==='admin'?adminView():route()==='display'?displayView():registerView();const loginPage=mode==='cloud'&&!state?.is_admin&&['home','parking','admin'].includes(route());if(loginPage){document.title='管理中心登入｜NEXT1 社區';document.body.className='view-login';}$('#app').innerHTML=header(loginPage)+`<main>${!healthy&&state?`<div class="error">資料連線中斷：${esc(connectionError)}。畫面保留上次資料；請恢復連線後再操作。</div>`:''}${content}</main>`+(loginPage?'':footer());if(testing){for(const link of document.querySelectorAll('a[href^="#"]'))link.href=location.pathname+location.search+link.getAttribute('href');}bind();}
async function act(action,spot=null){if(busy)return;if(mode==='cloud'&&!healthy)return toast('請先恢復資料連線');if(displayConnected&&Date.now()-lastAck>5000&&['pending','delegate','confirm','next'].includes(action))return toast('投放畫面沒有回應，請確認後重新開啟');busy=true;try{if(mode==='demo'){state=demoAction(state,action,spot);saveDemo(state);accept(state);}else accept(await rpc('admin',{p_action:action,p_revision:state.event.revision,p_spot:spot},true));if (['change_confirm','change_cancel','next'].includes(action)) {editingRank=null;broadcastDisplay(state);}drawer=action==='draw'?'lots':drawer;toast(action==='confirm'?'已儲存選位結果':action==='draw'?'完整順位已保存，不會因重新整理而改變':'操作已完成');}catch(e){toast(e.message);await load(false);}finally{busy=false;draw();}}
function ask(title,body,fn){const m=$('#modal');m.innerHTML=`<h2>${esc(title)}</h2><p>${esc(body)}</p><div class="toolbar"><button id="modalCancel">返回</button><button id="modalOK" class="primary">確認</button></div>`;m.showModal();$('#modalCancel').onclick=()=>m.close();$('#modalOK').onclick=()=>{m.close();fn();};}
function exportCSV(){const rows=state.lots.length?[['順位','戶別','名額','車位','狀態'],...state.lots.map(l=>[l.rank,l.household,l.slot,l.spot||'',lotStatus(l)])]:[['戶別','名額','登記狀態'],...state.registrations.map(r=>[r.household,r.quantity,'已登記'])];const b=new Blob(['\ufeff'+rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download=`NEXT1_2027_${state.event.phase}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function clearHistory(){historyRequest++;historyData=null;historyLoading=false;historyError='';historyYear='';historyHousehold='';historySpot='';adminSection='current';}
async function loadHistory(){const request=++historyRequest;historyLoading=true;historyError='';draw();try{const data=mode==='demo'?demoArchive():await rpc('history',{p_year:null,p_household:'',p_spot:null},true);if(request!==historyRequest)return;historyData=data;}catch(e){if(request!==historyRequest)return;historyData=null;historyError=e.message;}finally{if(request===historyRequest){historyLoading=false;draw();}}}
function exportHistory(){const rows=filterArchive(historyData,{year:historyYear,household:historyHousehold,spot:historySpot});const csv=[['年度','車位編號','戶別','抽籤順位','紀錄狀態'],...rows.map(r=>[r.year,r.spot,r.household||'',r.draw_rank||'',r.status==='assigned'?'已分配':r.status==='unavailable'?'不開放':'原稿未登載戶別'])].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`NEXT1_歷年中籤_${historyYear||'全部年度'}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function changeMode(m){clearHistory();mode=m;localStorage.setItem(modeKey,m);state=null;receipt=null;load();}
function fitParkingMap(){const shell=$('.map-shell'),diagram=$('.parking-diagram');if(!shell||!diagram)return;const maxHeight=Math.min(window.innerHeight*.62,640),width=Math.max(1,Math.min(shell.clientWidth-2,(maxHeight-4)*1043/960));diagram.style.setProperty('--map-fit-width',width+'px');diagram.style.setProperty('--map-number-size',(width/1043*16)+'px');}
async function calendarRequest(query, entry, method=entry?'POST':'GET') {
  await ensureSession();
  if (!session?.access_token) throw Error('請重新登入');
  const headers = {apikey:config.key, Authorization:'Bearer '+session.access_token};
  if (entry) headers['Content-Type']='application/json';
  if(method==='POST') headers.Prefer='resolution=ignore-duplicates';
  const modifying=method==='PATCH'||method==='DELETE';
  if(modifying) headers.Prefer='return=representation';
  const response = await fetch(config.url+'/rest/v1/community_calendar_entries'+query,{
    method,headers,body:entry?JSON.stringify(entry):undefined
  });
  if (!response.ok) throw Error('記事服務無法使用');
  if(modifying && (await response.json()).length!==1) throw Error('記事已異動');
  return method==='GET' ? response.json() : null;
}
function bindArchivePlan(panel) {
  const body=panel.querySelector('.archive-plan-body');
  async function showPlan(){
    if(!panel.open || body.dataset.loaded)return;
    body.dataset.loaded='loading';
    body.textContent='正在讀取 2026 年度選位結果…';
    try {
      const data=await rpc('history',{p_year:2026,p_household:'',p_spot:null},true);
      const records=new Map(data.rows.map(row=>[row.spot,row]));
      if(records.size!==62)throw Error('資料未齊');
      const staging=document.createElement('div');
      staging.innerHTML=renderMap({event:{},lots:data.rows.filter(r=>r.household)});
      const diagram=staging.querySelector('.parking-diagram');
      diagram.style.cssText='width:100%;min-width:0;--map-number-size:clamp(9px,1.2vw,17px)';
      const describe=n=>n<=2?'不開放':(n===3?'指定使用 · ':'')+(records.get(n).household||'未登載戶別');
      for(const button of diagram.querySelectorAll('[data-spot]')){
        const n=Number(button.dataset.spot);
        button.removeAttribute('data-spot');
        button.dataset.archiveSpot=n;
        button.disabled=false;
        button.title=n+' 號 · '+describe(n);
        button.setAttribute('aria-label',button.title);
      }
      body.innerHTML='<p class="muted">使用期間：2026/04/01 ～ 2027/03/31</p><p class="archive-result" role="status">點選車格，查看對應戶別。</p>';
      body.append(diagram);
      diagram.onclick=event=>{
        const button=event.target.closest('[data-archive-spot]');
        if(!button)return;
        diagram.querySelector('[aria-pressed="true"]')?.removeAttribute('aria-pressed');
        button.setAttribute('aria-pressed','true');
        const n=Number(button.dataset.archiveSpot);
        body.querySelector('[role=status]').textContent=n+' 號車位　'+describe(n);
      };
      body.dataset.loaded='ready';
    }catch{
      delete body.dataset.loaded;
      body.innerHTML='<p role="alert">無法載入年度車位紀錄。</p><button type="button">重新讀取</button>';
      body.querySelector('button').onclick=showPlan;
    }
  }
  panel.ontoggle=showPlan;
}
function showRegistrationQr() {
  const dialog = document.querySelector('#modal');
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAtAAAALQAQAAAACRLHoxAAAEZklEQVR4nO2d7WrkMAwA4+Xe/5Vz5LKqpfFHA0cpLTM/Wl82WcqcEUaWlXYeX8Xry7758KuBQoBCgEKAQoBCgEKAQoBCgEKAQoBCgEKAQoBCgEKAQoBCgEKAQn6FkD8xaOXy+b5Ws9vXPWe6GqPZsz9VyMuvrigEKAQo5Bvi9ZFicxti8RWl42d8lsf12S//q19+dUUhQCFAIb8tXh8fsTmI+JyvxpUrTrey1q7P/lQhL7+6ohCgEKCQb4rXxyL7ccflHpvvOM6ITfxvBAoBCgEKAQp5Gq/P9Puc5ETqv2boGigEKAQoBChkF6/P8lGsqe+4HHfkaJ3X1uMqW9dAIUAhQCFAIet4XVfKPVozNkdmJK+tZ6tsXQOFAIUAhQCFrOL1uD5uw7hH6B6xa3VIRtdAIUAhQCFAIev661yTF1G4Vn2METxG4726HnDyAYUAhQCFfLbf2I4zZTsiDt+/7585S3IgVueIrmugEKAQoBCgENByLqOlyFzH9TxMXm/Hp/0MjecbFzj5gEKAQoBCdvmQs0TcevK8X53dEzuSeYWta6AQoBCgEKCQ9X5jX0lH5M05jzh9fo3jnEy9SnQNFAIUAhQCFLJbX7ePUb0WFX393kqu+HO/cYmTDygEKAQoZJ2/rudjZjuItQpkrLnueewLXQOFAIUAhQCFPDmPfqJHSM5Qj2cbe5yvEVzXQCFAIUAhQCFP+6mepaYvPs9dVnuumxV+N7oGCgEKAQoBClnlQ2q1dZvkN1i9x6q/+x7z10ucfEAhQCFAIbvz6O0dkXPPkH6db5XJz+V8t/nrBU4+oBCgEKCQff11+zfOGY7x7TFxJVfz3dSaPl0DhQCFAIUAhez7853vEXccb3pXkXl9SKzHb3QNFAIUAhQCFLLfb2zv0XgCZuyNHbmT+j6Djq6BQoBCgEKAQtb7jT33nE811jOO3JHsn/Tf5q8XOPmAQoBCgEL2/a8bonat6stnaeZ5EfuHbHDyAYUAhQCF7Or5jklOpMZk1vax/1NG10AhQCFAIUAhu3zIbNcxqHXY/Z57PHtLuq6BQoBCgEKAQnbn0dtQT93PxIznavKpGvtfP8DJBxQCFAIU8qx/SCur5vpOglrfd5FzJtbzLXHyAYUAhQCFPInXrUTsWnVd31rQnxj7QOkaKAQoBCgEKGT3PrAM31QQ1P3FVbb7QtdAIUAhQCFAIevz6JnoG1JrruNtu/0ZrqldX29w8gGFAIUAhTztp3qgQ2reXax9++qT5q+XOPmAQoBCgEI+qw85JpV5x+L9BON7wuzPt8HJBxQCFAIU8mS/8ZiciumdQvqqmzV9FV0DhQCFAIUAhTyP12epw65Xci6kvnOmo2ugEKAQoBCgkF28PvnpUGkda+reOTX3XK1VfroGCgEKAQoBCtn3v+7MuoiMvZ763az70/WAkw8oBCgEKORp/fX/o2ugEKAQoBCgEKAQoBCgEKAQoBCgEKAQoBCgEKAQoBCgEKAQoBCgEKAQ8BdwCEXS9v7ilAAAAABJRU5ErkJggg==';
  dialog.classList.add('registration-qr');
  dialog.setAttribute('aria-labelledby', 'registrationQrTitle');
  dialog.innerHTML = `<h2 id="registrationQrTitle">住戶機車位登記申請</h2>
    <p>請用手機掃描 QR Code，填寫機車位登記表。</p>
    <img class="registration-qr-image" src="${image}" alt="住戶機車位登記申請 QR Code">
    <div class="toolbar"><a class="button" download="NEXT1-測試版-住戶登記.png" href="${image}">下載圖片</a>
    <button type="button" data-print>列印</button><button type="button" data-close>關閉</button></div>`;
  dialog.querySelector('[data-print]').onclick = () => window.print();
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    dialog.classList.remove('registration-qr');
    dialog.removeAttribute('aria-labelledby');
  }, {once:true});
  dialog.showModal();
}
function bind(){const accounts=document.querySelector(".staff-accounts");if(accounts)mountAccounts(accounts,async(name,args)=>{await ensureSession();return api("/rest/v1/rpc/next1_test_"+name,args,true);}).catch(error=>console.warn("帳號權限讀取失敗",error.message));const archivePanel=document.querySelector("#archivePlan");if(archivePanel)bindArchivePlan(archivePanel);const calendar=document.querySelector('.community-calendar');if(calendar)mountCalendar(calendar,calendarRequest);mapResizeObserver?.disconnect();if($('.map-shell')){fitParkingMap();mapResizeObserver=new ResizeObserver(fitParkingMap);mapResizeObserver.observe($('.map-shell'));}const on=(id,event,fn)=>{const el=$('#'+id);if(el)el.addEventListener(event,fn);};on('registrationQr','click',showRegistrationQr);on('homeTop','click',()=>{window.scrollTo(0,0);document.querySelector('.home-account-bar button')?.focus();});on('rankPrev','click',()=>{showRankPage(rankPage-1);});
 on('rankNext','click',()=>{showRankPage(rankPage+1);});
 on('rankPage','change',e=>{showRankPage(Number(e.target.value));});
 on('historyForm','submit',e=>{e.preventDefault();historyYear=$('#historyYear').value;historyHousehold=$('#historyHousehold').value.trim();historySpot=$('#historySpot').value;draw();});on('historyClear','click',()=>{historyYear='';historyHousehold='';historySpot='';draw();});on('historyRetry','click',loadHistory);on('historyExport','click',exportHistory);on('switchMode','click',()=>changeMode(mode==='demo'?'cloud':'demo'));on('demoEntry','click',()=>changeMode('demo'));on('retry','click',()=>load());on('building','change',e=>{formState.building=e.target.value;formState.household=households.find(h=>h.id.replace(/-\d+F$/,'')===formState.building).id;formState.quantity=1;formState.consent=false;formState.token='';receipt=null;draw();});on('household','change',e=>{formState.household=e.target.value;formState.quantity=1;formState.consent=false;formState.token='';receipt=null;draw();});on('quantity','change',e=>formState.quantity=Number(e.target.value));on('consent','change',e=>formState.consent=e.target.checked);on('modifyToken','input',e=>formState.token=e.target.value.trim());on('registerForm','submit',async e=>{e.preventDefault();if(!formState.consent)return toast('請先閱讀並勾選同意管理辦法');await submitRegister(formState.quantity);});on('cancelReg','click',()=>ask('取消年度登記',`確定取消 ${formState.household} 的登記？需使用原修改碼。`,()=>submitRegister(0)));on('copyToken','click',()=>navigator.clipboard.writeText(receipt.token).then(()=>toast('修改碼已複製')).catch(()=>toast('請長按或選取修改碼複製')));on('mapFit','click',()=>{mapZoom=1;draw();});on('zoomIn','click',()=>{mapZoom=Math.min(2.4,+(mapZoom+.1).toFixed(1));draw();});on('zoomOut','click',()=>{mapZoom=Math.max(.5,+(mapZoom-.1).toFixed(1));draw();});on('mapStyle','click',()=>{mapStyle=mapStyle==='plan'?'grid':'plan';draw();});on('toggleTable','click',()=>{drawer=drawer==='lots'?'registrations':'lots';draw();});document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{if(['reopen','lock','draw','waive'].includes(b.dataset.action))ask(b.textContent,b.dataset.action==='reopen'?'解除名單鎖定後，原有登記會保留。尚未登記的住戶可以補登，已登記的住戶可以修改申請。':b.dataset.action==='draw'?'將一次產生全部順位並保存，本次不能重抽。':b.dataset.action==='lock'?'鎖定後住戶將無法新增或修改登記。':'僅放棄目前名額，不影響同戶另一個名額。',()=>act(b.dataset.action));else act(b.dataset.action);});document.querySelectorAll('[data-spot]:not(:disabled)').forEach(b=>b.onclick=()=>act(current()?.spot?'change_pending':'pending',Number(b.dataset.spot)));on('editSpot','click',()=>{editingRank=state.event.current_rank;broadcastDisplay(state);draw();});on('cancelEdit','click',()=>{editingRank=null;broadcastDisplay(state);draw();});on('propose','click',()=>act('pending',Number($('#spotNumber').value)));on('spotNumber','keydown',e=>{if(e.key==='Enter'){e.preventDefault();act('pending',Number(e.target.value));}});on('delegate','click',()=>{const n=available(state)[0];if(!n)return toast('已無可用車位');ask('未到場代排',`建議依編號安排 ${n} 號，請管理中心核對後再確認選位。`,()=>act('delegate',n));});on('exportResults','click',exportCSV);on('print','click',()=>window.print());on('showAnnualLookup','click',()=>{$('#annualLookup')?.scrollIntoView({behavior:'smooth',block:'start'});$('#lookup')?.focus({preventScroll:true});});on('lookup','input',e=>lookQuery=e.target.value);on('annualLookupForm','submit',e=>{e.preventDefault();draw();$('#lookup')?.focus();});on('clearAnnualLookup','click',()=>{lookQuery='';draw();});on('resetDemo','click',()=>ask('重設現場演練模式','只重設目前演練進度，不影響本年度登記與選位結果。',()=>{saveDemo(demoSeed());state=null;load();}));on('fullscreen','click',()=>document.documentElement.requestFullscreen?.().catch(()=>toast('請使用瀏覽器全螢幕功能')));on('logout','click',()=>{clearHistory();session=null;sessionStorage.removeItem(authKey);load();});on('loginForm','submit',async e=>{e.preventDefault();const email=$('#email').value.trim(),password=$('#password').value;try{session=await api('/auth/v1/token?grant_type=password',{email,password});sessionStorage.setItem(idleKey,String(Date.now()));session.expires_at=Date.now()/1000+session.expires_in;sessionStorage.setItem(authKey,JSON.stringify(session));await load();if(state?.is_admin && route()==='admin'){location.hash='/home';}else if(!state?.is_admin)toast('已登入，但此帳號未獲管理權限');}catch(err){toast(err.message);}});}
async function submitRegister(quantity){if(busy)return;if(!healthy)return toast('請先恢復資料連線');const token=formState.token||randomToken(),household=formState.household;busy=true;try{if(mode==='demo'){if(state.event.phase!=='registration')throw Error('登記已截止');const quota=households.find(h=>h.id===household)?.quota;if(!quota||quantity>quota)throw Error('超過本戶可申請名額');const tokens=JSON.parse(localStorage.getItem('next1-demo-tokens')||'{}'),r=state.registrations.find(r=>r.household===household);if(r&&tokens[household]!==token)throw Error('此戶已有登記，請使用原修改碼，或洽管理中心協助');if(quantity===0){if(!r)throw Error('查無登記');state.registrations=state.registrations.filter(r=>r!==r);}else{if(r)r.quantity=quantity;else state.registrations.push({household,quantity,sample:false,registered_at:new Date().toISOString()});tokens[household]=token;}localStorage.setItem('next1-demo-tokens',JSON.stringify(tokens));state.event.revision++;saveDemo(state);accept(state);}else accept(await rpc('register',{p_household:household,p_quantity:quantity,p_token:token,p_consent:formState.consent,p_version:state.event.rules_version},false));if(quantity){receipt={household,quantity,token};formState.token=token;}else receipt=null;toast(quantity?'年度登記已保存':'年度登記已取消');}catch(e){toast(e.message);}finally{busy=false;draw();}}
channel.onmessage=e=>{const m=e.data;if(testing&&m.type==='request'&&route()==='admin'&&state?.is_admin)broadcastDisplay(state);if(m.type==='ping'&&route()==='display')channel.postMessage({type:'ack'});if(m.type==='ack'){displayConnected=true;lastAck=Date.now();}if(m.type==='state'&&route()==='display'){if(m.mode!==mode||!state||m.state.event.revision>=state.event.revision){if (state?.event.phase === 'locked' && m.state.event.phase === 'drawn') {
 startReveal(m.state.lots, draw);
}
if(m.state.event.phase==='completed' && Number.isInteger(m.rankPage))rankPage=Math.max(0,m.rankPage);mode=m.mode;editingRank=m.editingRank ?? null;state=m.state;healthy=true;draw();}channel.postMessage({type:'ack'});}};
window.addEventListener('resize',fitParkingMap);window.addEventListener('storage',e=>{if(e.key===demoKey&&mode==='demo')load();});window.addEventListener('hashchange',()=>{receipt=null;draw();load();});setInterval(()=>{if(route()==='admin'){channel.postMessage({type:'ping'});const h=$('#displayHealth');if(h&&displayConnected)h.textContent=Date.now()-lastAck<5000?'● 投放畫面已連接':'投放畫面未回應，請先檢查';}},1500);setInterval(()=>{if(mode==='cloud'&&route()==='display')load();},12000);if(route()==='display'){session=null;if(testing)channel.postMessage({type:'request'});}draw();load();
