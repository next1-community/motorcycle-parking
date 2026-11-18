import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {fixture} from './registration-db.mjs';
const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
const attackerToken='unissued-token-0000000000000000000000000000';
test('anonymous first claim, direct internal call, and credential-table writes are rejected',async()=>{
 const {db,role,call}=await fixture();
 try{
  await role(false);
  for(const token of [attackerToken,'A'.repeat(32),'0'.repeat(128)]){
   await assert.rejects(call('215-1F',1,token),/本戶登記驗證碼/);
   await assert.rejects(call('215-1F',1,token,true,undefined,true),/本戶登記驗證碼/);
  }
  await assert.rejects(db.query("select public.next1_test_issue_registration_code('215-1F')"),/permission denied/);
  await assert.rejects(db.query('select * from next1_test.registration_credentials'),/permission denied/);
  await assert.rejects(db.query("insert into next1_test.registration_credentials values ('test-2027','215-1F','fake',null,now())"),/permission denied/);
  await db.exec('reset role; set role authenticated');
  await assert.rejects(db.query("select public.next1_test_issue_registration_code('215-1F')"),/僅指定管理人員/);
  await db.exec('reset role');
  assert.equal((await db.query("select count(*)::int as n from next1_test.registrations where household='215-1F'")).rows[0].n,0);
  assert.equal((await db.query('select revision from next1_test.events')).rows[0].revision,0);
 }finally{await db.close();}
});
test('valid code permits first registration, updates, cancellation and safe re-registration',async()=>{
 const {db,role,call,issue}=await fixture();
 try{
  const code=await issue('225-9F');assert.match(code,/^[a-f0-9]{48}$/);
  await role(false);
  const first=await call('225-9F',2,code);assert.equal(first.registrations.find(x=>x.household==='225-9F').quantity,2);
  const changed=await call('225-9F',1,code);assert.equal(changed.registrations.find(x=>x.household==='225-9F').quantity,1);
  await assert.rejects(call('225-9F',1,attackerToken),/原修改碼/);
  await assert.rejects(call('225-9F',0,attackerToken),/原修改碼/);
  const cancelled=await call('225-9F',0,code,false);assert.ok(!cancelled.registrations.some(x=>x.household==='225-9F'));
  await assert.rejects(call('225-9F',1,attackerToken),/本戶登記驗證碼/);
  const again=await call('225-9F',1,code);assert.equal(again.registrations.find(x=>x.household==='225-9F').quantity,1);
  assert.ok(!JSON.stringify(again).includes(code));assert.ok(!JSON.stringify(again).includes('token_hash'));
  await db.exec('reset role');
  assert.ok(!JSON.stringify((await db.query('select detail from next1_test.audit')).rows).includes(code));
 }finally{await db.close();}
});
test('codes are bound to event and household; reissue revokes unused codes but cannot replace active credentials',async()=>{
 const {db,role,call,issue}=await fixture();
 try{
  const old=await issue('215-1F'),code=await issue('215-1F');assert.notEqual(code,old);
  await role(false);
  await assert.rejects(call('215-1F',1,old),/本戶登記驗證碼/);
  await assert.rejects(call('215-2F',1,code),/本戶登記驗證碼/);
  await assert.rejects(call('215-1f',1,code),/戶別或申請數量/);
  await assert.rejects(call(' 215-1F',1,code),/戶別或申請數量/);
  await call('215-1F',1,code);
  await assert.rejects(issue('215-1F'),/不能重新核發/);
  await db.exec('reset role');
  await db.exec("insert into next1_test.events(id,title,rules_text) values ('other','other','other'); insert into next1_test.registration_credentials(event_id,household,token_hash) select 'other','215-2F',token_hash from next1_test.registration_credentials where household='215-1F'");
  await role(false);await assert.rejects(call('215-2F',1,code),/本戶登記驗證碼/);
 }finally{await db.close();}
});
test('quota, consent, version, token length, phase and missing cancellation checks remain enforced',async()=>{
 const {db,role,call,issue}=await fixture();
 try{
  const code=await issue('215-1F');await role(false);
  await assert.rejects(call('215-1F',2,code),/戶別或申請數量/);
  await assert.rejects(call('215-1F',-1,code),/戶別或申請數量/);
  await assert.rejects(call('215-1F',1,null),/修改碼格式/);
  await assert.rejects(call('215-1F',1,'A'.repeat(129)),/修改碼格式/);
  await assert.rejects(call('215-1F',1,code,false),/請閱讀並同意/);
  await assert.rejects(call('215-1F',1,code,true,'old version'),/請閱讀並同意/);
  await assert.rejects(call('215-1F',0,code),/查無此戶登記/);
  await call('215-1F',1,code);
  await db.exec("reset role; update next1_test.events set phase='locked'");await role(false);
  await assert.rejects(call('215-1F',1,code),/登記已截止/);
  await assert.rejects(call('215-1F',0,code),/登記已截止/);
  await assert.rejects(issue('215-2F'),/登記已截止/);
 }finally{await db.close();}
});
test('legacy registrations retain original modification codes and stay protected after cancellation',async()=>{
 const {db,role,call}=await fixture();
 try{
  const token='legacy-token-000000000000000000000000000000';
  await db.query("insert into next1_test.registrations(event_id,household,quantity,token_hash,consent_version) select 'test-2027','215-1F',1,encode(extensions.digest($1,'sha256'),'hex'),rules_version from next1_test.events where id='test-2027'",[token]);
  await role(false);await call('215-1F',1,token);await call('215-1F',0,token);
  await assert.rejects(call('215-1F',1,attackerToken),/本戶登記驗證碼/);
  await call('215-1F',1,token);
 }finally{await db.close();}
});
test('upgrade is idempotent and preserves installed response and administrator checks',async()=>{
 for(const restricted of [false,true]){
  const {db,role,call,issue}=await fixture();
  try{
   // Install the pre-fix version from the independently captured source when supplied.
   if(process.env.NEXT1_BASELINE_DIR){
    const original=await readFile(process.env.NEXT1_BASELINE_DIR+'/'+(restricted?'private__testing-project-setup.sql':'db__setup.sql'),'utf8');
    const start=original.indexOf('create function next1_test.register('),end=original.indexOf('create function next1_test.admin(',start);
    await db.exec(original.slice(start,end).replace('create function','create or replace function'));
    await db.exec('drop table next1_test.registration_credentials; drop function public.next1_test_issue_registration_code(text)');
   }
   await db.exec(await read('db-registration-authorization.sql'));
   await db.exec(await read('db-registration-authorization.sql'));
   const code=await issue('215-1F');await role(false);
   if(restricted&&process.env.NEXT1_BASELINE_DIR){
    await assert.rejects(call('215-1F',1,code),/需測試版管理權限/);
    await role(true);
   }
   await assert.rejects(call('215-1F',1,attackerToken),/本戶登記驗證碼/);
   await call('215-1F',1,code);
  }finally{await db.close();}
 }
});
test('testing public-registration replacement also enforces first-registration authority',{skip:!existsSync(new URL('../private/testing-public-registration.sql',import.meta.url))},async()=>{
 const {db,role,call,issue}=await fixture();
 try{
  await db.exec(await read('private/testing-public-registration.sql'));
  await db.exec(await read('db-registration-authorization.sql'));
  const code=await issue('215-1F');await role(false);
  await assert.rejects(call('215-1F',1,attackerToken),/本戶登記驗證碼/);
  const result=await call('215-1F',1,code);assert.deepEqual(result.registrations,[]);
  await call('215-1F',0,code);await call('215-1F',1,code);
 }finally{await db.close();}
});
