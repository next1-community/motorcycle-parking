import assert from 'node:assert/strict';
import {config} from './config.js';
async function rpc(name,body={}){let r=await fetch(config.url+'/rest/v1/rpc/next1_test_'+name,{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,ok:r.ok,data:await r.json()};}
let s=await rpc('snapshot');assert.equal(s.ok,true,JSON.stringify(s));assert.equal(s.data.households.filter(h=>h.quota===2).length,8);assert.ok(!JSON.stringify(s.data).includes('token_hash'));console.log('PASS 公開快照、固定八戶名額、無修改碼雜湊外洩');
let token=crypto.randomUUID()+crypto.randomUUID(),args={p_household:'215-1F',p_quantity:2,p_token:token,p_consent:true,p_version:s.data.event.rules_version};
assert.equal((await rpc('register',args)).ok,false);console.log('PASS 後端拒絕一般戶兩名額');
assert.equal((await rpc('register',{...args,p_quantity:1,p_consent:false})).ok,false);console.log('PASS 後端拒絕未同意登記');
assert.equal((await rpc('admin',{p_action:'lock',p_revision:s.data.event.revision,p_spot:null})).ok,false);console.log('PASS 未登入無法執行管理操作');
const table=await fetch(config.url+'/rest/v1/registrations?select=*',{headers:{apikey:config.key}});assert.ok(!table.ok);console.log('PASS 無法直接讀取私有登記資料表');
const created=await rpc('register',{...args,p_quantity:1});assert.equal(created.ok,true,JSON.stringify(created));
try {assert.equal((await rpc('register',{...args,p_quantity:1,p_token:crypto.randomUUID()})).ok,false);console.log('PASS 雲端登記保存、拒絕他人覆寫');}
finally {const cancelled=await rpc('register',{...args,p_quantity:0});assert.equal(cancelled.ok,true,JSON.stringify(cancelled));console.log('PASS 持原修改碼可取消測試登記');}
