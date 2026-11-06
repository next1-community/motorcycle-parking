-- NEXT1 isolated TEST environment. No production data or account credentials.
begin;
create schema if not exists next1_test;
create extension if not exists pgcrypto with schema extensions;
revoke all on schema next1_test from public;
grant usage on schema next1_test to anon, authenticated;
create table next1_test.events (
 id text primary key, title text not null, phase text not null default 'registration'
 check(phase in ('registration','locked','drawn','selecting','completed')),
 revision integer not null default 0, current_rank integer not null default 1,
 pending_spot integer check(pending_spot between 4 and 62), pending_mode text not null default 'selected' check(pending_mode in ('selected','delegated')),
 rules_version text not null default '2027年度管理辦法及登記須知',
 rules_text text not null,
 draw_at timestamptz, created_at timestamptz not null default now()
);
create table next1_test.households (id text primary key, quota integer not null check(quota in (1,2)));
create table next1_test.registrations (
 event_id text references next1_test.events, household text references next1_test.households,
 quantity integer not null check(quantity between 1 and 2), token_hash text not null,
 consent_version text not null, consent_at timestamptz not null default now(),
 sample boolean not null default false, primary key(event_id,household)
);
create table next1_test.lots (
 event_id text references next1_test.events, rank integer not null check(rank>0),
 household text references next1_test.households, slot integer not null check(slot in (1,2)),
 spot integer check(spot between 4 and 62), status text not null default 'waiting'
 check(status in ('waiting','selected','delegated','waived','unallocated')),
 primary key(event_id,rank), unique(event_id,household,slot), unique(event_id,spot)
);
create table next1_test.admins (email text primary key);
create table next1_test.audit (id bigint generated always as identity primary key,
 event_id text, action text, actor uuid, detail jsonb, created_at timestamptz default now());
alter table next1_test.events enable row level security;
alter table next1_test.households enable row level security;
alter table next1_test.registrations enable row level security;
alter table next1_test.lots enable row level security;
alter table next1_test.admins enable row level security;
alter table next1_test.audit enable row level security;
revoke all on all tables in schema next1_test from anon, authenticated;

insert into next1_test.households
select b||'-'||f||'F', case when b='225' and f>=8 then 2 else 1 end
from unnest(array['215','217','219','221','223','225','225-1']) b
cross join generate_series(1,15) f
where not (b='225' and f<3) and not (b='225-1' and (f<3 or f>7));
insert into next1_test.events(id,title,rules_text) values ('test-2027','2027 年度機車位抽籤',
'一、每戶一個抽籤權益；225號8F至15F每戶最多兩個權利名額。兩個名額一起抽，每個名額取得獨立順位，每次輪到各選一格。
二、僅限戶別清單內登記，不另做資格審核。每車位可停一部機車（含重機）或兩台自行車。
三、管委會公開抽籤，以戶別識別。未到者由管理委員或總幹事依車位編號安排。
四、每年1月區權會抽籤；車位使用期間為當年度4月1日至次年度3月31日。
五、季繳費用，逾期未繳將釋出。選位後至管理室繳交車籍資料及費用。
六、1～3號不開放，4～62號每年度重新開放。
七、2027年度不開放超過原有權利名額的額外車位登記或第二格候補。225號8F～15F固有的兩個抽籤權益不受影響。
八、車位專屬使用，不得佔用他戶車位；不再需要時交管委會收回。非本社區住戶不得停放。
請一併閱讀完整《機車位抽籤、使用、繳費管理辦法》。本年度名額及開放車位依本頁登記須知辦理。');
-- Sample entries demonstrate one- and two-lot households; not real registrations.
insert into next1_test.registrations(event_id,household,quantity,token_hash,consent_version,sample)
select 'test-2027',h,case when h like '225-%' then 2 else 1 end,
 encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex'),'示範資料，非住戶同意',true
from unnest(array['215-3F','217-6F','219-5F','221-9F','223-3F','225-8F','225-10F','217-12F','223-14F','225-15F']) h;

create function next1_test.is_admin() returns boolean language sql stable security definer set search_path=''
as $$ select auth.uid() is not null and exists(select 1 from next1_test.admins where email=lower(auth.jwt()->>'email')); $$;
create function next1_test.snapshot() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('event',to_jsonb(e),'households',(select jsonb_agg(to_jsonb(h) order by h.id) from next1_test.households h),
 'registrations',coalesce((select jsonb_agg(jsonb_build_object('household',r.household,'quantity',r.quantity,'sample',r.sample) order by r.household) from next1_test.registrations r where r.event_id=e.id),'[]'::jsonb),
 'lots',coalesce((select jsonb_agg(to_jsonb(l) order by l.rank) from next1_test.lots l where l.event_id=e.id),'[]'::jsonb),
 'is_admin',next1_test.is_admin()) from next1_test.events e where e.id='test-2027'; $$;
create function next1_test.register(p_household text,p_quantity integer,p_token text,p_consent boolean,p_version text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e next1_test.events; q integer; old_hash text; th text;
begin
 select * into e from next1_test.events where id='test-2027' for update;
 if e.phase<>'registration' then raise exception '登記已截止'; end if;
 select quota into q from next1_test.households where id=p_household;
 if q is null or p_quantity is null or p_quantity<0 or p_quantity>q then raise exception '戶別或申請數量不符合規則'; end if;
 if p_token is null or length(p_token)<32 or length(p_token)>128 then raise exception '修改碼格式錯誤'; end if;
 th:=encode(extensions.digest(p_token,'sha256'),'hex');
 select token_hash into old_hash from next1_test.registrations where event_id=e.id and household=p_household;
 if old_hash is not null and old_hash<>th then raise exception '此戶已有登記，請輸入原修改碼或洽管理中心'; end if;
 if p_quantity=0 then
  if old_hash is null then raise exception '查無此戶登記'; end if;
  delete from next1_test.registrations where event_id=e.id and household=p_household;
 else
  if p_consent is distinct from true or p_version is distinct from e.rules_version then raise exception '請閱讀並同意目前版本管理辦法'; end if;
  insert into next1_test.registrations(event_id,household,quantity,token_hash,consent_version)
  values(e.id,p_household,p_quantity,th,e.rules_version)
  on conflict(event_id,household) do update set quantity=excluded.quantity,consent_version=excluded.consent_version,consent_at=now(),sample=false;
 end if;
 update next1_test.events set revision=revision+1 where id=e.id;
 insert into next1_test.audit(event_id,action,detail) values(e.id,'register',jsonb_build_object('household',p_household,'quantity',p_quantity));
 return next1_test.snapshot();
end; $$;
create function next1_test.admin(p_action text,p_revision integer,p_spot integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e next1_test.events; l next1_test.lots; n integer;
begin
 if not next1_test.is_admin() then raise exception '僅指定管理人員可操作'; end if;
 select * into e from next1_test.events where id='test-2027' for update;
 if e.revision<>p_revision then raise exception '資料已更新，請重新確認目前畫面'; end if;
 if p_action='lock' then
  if e.phase<>'registration' then raise exception '目前無法鎖定'; end if;
  if not exists(select 1 from next1_test.registrations where event_id=e.id) then raise exception '沒有登記名額'; end if;
  update next1_test.events set phase='locked' where id=e.id;
 elsif p_action='draw' then
  if e.phase<>'locked' or exists(select 1 from next1_test.lots where event_id=e.id) then raise exception '名單未鎖定或已完成抽籤，不能重抽'; end if;
  insert into next1_test.lots(event_id,rank,household,slot)
  select e.id,row_number() over(order by entropy),household,slot from
  (select r.household,s slot,extensions.gen_random_bytes(32) entropy from next1_test.registrations r cross join lateral generate_series(1,r.quantity) s where r.event_id=e.id) t;
  update next1_test.events set phase='drawn',draw_at=now() where id=e.id;
 elsif p_action='start' then
  if e.phase<>'drawn' then raise exception '尚未抽籤或已開始選位'; end if;
  update next1_test.events set phase='selecting' where id=e.id;
 elsif p_action in ('pending','delegate','confirm','waive','clear') then
  if e.phase<>'selecting' then raise exception '目前不在選位階段'; end if;
  select * into l from next1_test.lots where event_id=e.id and rank=e.current_rank;
  if l.rank is null or l.status<>'waiting' then raise exception '請先叫下一位'; end if;
  if p_action='clear' then update next1_test.events set pending_spot=null where id=e.id;
  elsif p_action='waive' then
   update next1_test.lots set status='waived' where event_id=e.id and rank=l.rank;
   update next1_test.events set pending_spot=null where id=e.id;
  else
   n:=case when p_action='confirm' then e.pending_spot else p_spot end;
   if n is null or n<4 or n>62 or exists(select 1 from next1_test.lots where event_id=e.id and spot=n) then raise exception '車位不開放、已被選取或尚未指定'; end if;
   if p_action in ('pending','delegate') then
    -- Delegate proposes smallest remaining number in UI; explicit confirmation still required.
    update next1_test.events set pending_spot=n,pending_mode=case when p_action='delegate' then 'delegated' else 'selected' end where id=e.id;
   else
    update next1_test.lots set spot=n,status=e.pending_mode where event_id=e.id and rank=l.rank;
    update next1_test.events set pending_spot=null where id=e.id;
   end if;
  end if;
 elsif p_action='next' then
  if e.phase<>'selecting' then raise exception '目前不在選位階段'; end if;
  if exists(select 1 from next1_test.lots where event_id=e.id and rank=e.current_rank and status='waiting') then raise exception '請先完成目前戶別選位或記錄放棄'; end if;
  if exists(select 1 from next1_test.lots where event_id=e.id and rank>e.current_rank) and (select count(*) from next1_test.lots where event_id=e.id and spot is not null)<59 then
   update next1_test.events set current_rank=current_rank+1 where id=e.id;
  else
   update next1_test.lots set status='unallocated' where event_id=e.id and status='waiting';
   update next1_test.events set phase='completed' where id=e.id;
  end if;
 else raise exception '不支援的操作'; end if;
 update next1_test.events set revision=revision+1 where id=e.id;
 insert into next1_test.audit(event_id,action,actor,detail) values(e.id,p_action,auth.uid(),jsonb_build_object('rank',e.current_rank,'spot',p_spot));
 return next1_test.snapshot();
end; $$;
create function public.next1_test_snapshot() returns jsonb language sql security invoker set search_path='' as $$ select next1_test.snapshot(); $$;
create function public.next1_test_register(p_household text,p_quantity integer,p_token text,p_consent boolean,p_version text) returns jsonb language sql security invoker set search_path='' as $$ select next1_test.register(p_household,p_quantity,p_token,p_consent,p_version); $$;
create function public.next1_test_admin(p_action text,p_revision integer,p_spot integer default null) returns jsonb language sql security invoker set search_path='' as $$ select next1_test.admin(p_action,p_revision,p_spot); $$;
revoke all on all functions in schema next1_test from public,anon,authenticated;
grant execute on function next1_test.snapshot() to anon,authenticated;
grant execute on function next1_test.register(text,integer,text,boolean,text) to anon,authenticated;
grant execute on function next1_test.admin(text,integer,integer) to authenticated;
revoke all on function public.next1_test_snapshot(),public.next1_test_register(text,integer,text,boolean,text),public.next1_test_admin(text,integer,integer) from public,anon,authenticated;
grant execute on function public.next1_test_snapshot(),public.next1_test_register(text,integer,text,boolean,text) to anon,authenticated;
grant execute on function public.next1_test_admin(text,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;
