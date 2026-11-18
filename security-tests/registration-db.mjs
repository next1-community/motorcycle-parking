import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
// PGlite 0.5.16 is a dev-only PostgreSQL/pgcrypto test engine, never a browser dependency.
const base=process.env.PGLITE_PACKAGE;
const {PGlite}=await import(base?pathToFileURL(base+'/dist/index.js').href:'@electric-sql/pglite');
const {pgcrypto}=await import(base?pathToFileURL(base+'/dist/contrib/pgcrypto.js').href:'@electric-sql/pglite/contrib/pgcrypto');
const read=name=>readFile(new URL('../'+name,import.meta.url),'utf8');
const manager='00000000-0000-4000-8000-000000000001';
export async function fixture(setup='db-setup.sql'){
 const db=new PGlite({extensions:{pgcrypto}});
 await db.exec(`create role anon; create role authenticated; create schema auth; create schema extensions;
 create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;`);
 await db.exec(await read(setup));
 await db.exec(`insert into next1_test.admins values ('test-manager@example.invalid') on conflict do nothing;`);
 const version=(await db.query('select rules_version from next1_test.events')).rows[0].rules_version;
 const role=async admin=>{
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)",[admin?JSON.stringify({sub:manager,email:'test-manager@example.invalid'}):'{}']);
  await db.exec('set role '+(admin?'authenticated':'anon'));
 };
 const call=async(household,quantity,token,consent=true,v=version,internal=false)=>(await db.query(`select ${internal?'next1_test.register':'public.next1_test_register'}($1,$2,$3,$4,$5) as result`,[household,quantity,token,consent,v])).rows[0].result;
 const issue=async household=>{await role(true);return (await db.query('select public.next1_test_issue_registration_code($1) as code',[household])).rows[0].code;};
 return {db,role,call,issue,version};
}
