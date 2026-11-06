export const VERSION='2027年度管理辦法及登記須知';
export const rules=`一、每戶一個抽籤權益；225號8F至15F每戶最多兩個權利名額。兩個名額一起抽，每個名額取得獨立順位，每次輪到各選一格。
二、僅限戶別清單內登記，不另做資格審核。每車位可停一部機車（含重機）或兩台自行車。
三、管委會公開抽籤，以戶別識別。未到者由管理委員或總幹事依車位編號安排。
四、每年1月區權會抽籤；車位使用期間為當年度4月1日至次年度3月31日。
五、季繳費用，逾期未繳將釋出。選位後至管理室繳交車籍資料及費用。
六、1～3號不開放，4～62號每年度重新開放。
七、2027年度不開放超過原有權利名額的額外車位登記或第二格候補。225號8F～15F固有的兩個抽籤權益不受影響。
八、車位專屬使用，不得佔用他戶車位；不再需要時交管委會收回。非本社區住戶不得停放。
請一併閱讀完整《機車位抽籤、使用、繳費管理辦法》。本年度名額及開放車位依本頁登記須知辦理。`;
export const households=['215','217','219','221','223','225','225-1'].flatMap(b=>Array.from({length:15},(_,i)=>i+1).filter(f=>!(b==='225'&&f<3)&&!(b==='225-1'&&(f<3||f>7))).map(f=>({id:`${b}-${f}F`,quota:b==='225'&&f>=8?2:1})));
export function demoSeed(){return {event:{id:'demo',title:'2027 年度機車位抽籤',phase:'registration',revision:0,current_rank:1,pending_spot:null,pending_mode:'selected',rules_version:VERSION,rules_text:rules},households,registrations:['215-3F','217-6F','219-5F','221-9F','223-3F','225-8F','225-10F','217-12F','223-14F','225-15F'].map(h=>({household:h,quantity:households.find(x=>x.id===h).quota,sample:true})),lots:[],is_admin:true};}
export function randomOrder(items,source=()=>crypto.getRandomValues(new Uint32Array(1))[0]){const a=[...items];for(let i=a.length-1;i>0;i--){const limit=Math.floor(4294967296/(i+1))*(i+1);let n;do{n=source();}while(n>=limit);const j=n%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function available(s){const used=new Set(s.lots.map(l=>l.spot));return Array.from({length:59},(_,i)=>i+4).filter(n=>!used.has(n));}
export function demoAction(s,action,spot){s=structuredClone(s);let e=s.event,l=s.lots.find(l=>l.rank===e.current_rank);if(action==='lock'){if(e.phase!=='registration'||!s.registrations.length)throw Error('目前無法鎖定名單');e.phase='locked';}
else if(action==='draw'){if(e.phase!=='locked'||s.lots.length)throw Error('名單尚未鎖定或已完成抽籤');s.lots=randomOrder(s.registrations.flatMap(r=>Array.from({length:r.quantity},(_,i)=>({household:r.household,slot:i+1,status:'waiting',spot:null})))).map((l,i)=>({...l,rank:i+1}));e.phase='drawn';e.draw_at=new Date().toISOString();}
else if(action==='start'){if(e.phase!=='drawn')throw Error('尚未抽籤');e.phase='selecting';}
else if(['pending','delegate','confirm','waive','clear'].includes(action)){if(e.phase!=='selecting'||l?.status!=='waiting')throw Error('請先叫下一位');if(action==='clear'){e.pending_spot=null;}else if(action==='waive'){l.status='waived';e.pending_spot=null;}else {const n=action==='confirm'?e.pending_spot:Number(spot);if(!available(s).includes(n))throw Error('車位不開放、已選取或尚未指定');if(action==='confirm'){l.spot=n;l.status=e.pending_mode||'selected';e.pending_spot=null;}else{e.pending_spot=n;e.pending_mode=action==='delegate'?'delegated':'selected';}}}
else if(action==='next'){if(e.phase!=='selecting'||l?.status==='waiting')throw Error('請先完成目前選位或記錄放棄');if(s.lots.some(l=>l.rank>e.current_rank)&&available(s).length)e.current_rank++;else {s.lots.filter(l=>l.status==='waiting').forEach(l=>l.status='unallocated');e.phase='completed';}}
else throw Error('不支援的操作');e.revision++;return s;}
