import test from 'node:test';
import assert from 'node:assert/strict';
import {config} from './config.js';
const enabled=process.env.NEXT1_ALLOW_LIVE_REGISTRATION==='1';
test('explicitly authorized live registration fixture',{skip:!enabled},async()=>{
 const household=process.env.NEXT1_TEST_HOUSEHOLD,token=process.env.NEXT1_TEST_CODE;
 assert.ok(household&&token,'Use a dedicated unregistered test household and its privately issued code');
 async function rpc(name,body={}){
  const r=await fetch(config.url+'/rest/v1/rpc/next1_test_'+name,{method:'POST',headers:{apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify(body)});
  return {ok:r.ok,data:await r.json()};
 }
 const snapshot=await rpc('snapshot');assert.ok(snapshot.ok);
 assert.ok(!snapshot.data.registrations.some(r=>r.household===household),'Fixture must be unregistered');
 const args={p_household:household,p_quantity:1,p_token:token,p_consent:true,p_version:snapshot.data.event.rules_version};
 assert.equal((await rpc('register',{...args,p_token:'unissued-token-0000000000000000000000'})).ok,false);
 assert.equal((await rpc('register',{...args,p_consent:false})).ok,false);
 const created=await rpc('register',args);assert.ok(created.ok,'Valid household code must register');
 try{
  assert.equal((await rpc('register',{...args,p_token:'another-token-00000000000000000000000'})).ok,false);
  assert.equal((await rpc('register',args)).ok,true,'Original code must permit updates');
 }finally{
  assert.equal((await rpc('register',{...args,p_quantity:0})).ok,true,'Original code must permit cancellation');
 }
});
