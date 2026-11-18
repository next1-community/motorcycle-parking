-- Shared installation block, also embedded in setup and upgrade scripts.
-- Codes must be handed to the verified household privately; never publish them.
create table if not exists next1_test.registration_credentials (
 event_id text references next1_test.events,
 household text references next1_test.households,
 token_hash text not null,
 issued_by uuid,
 issued_at timestamptz not null default now(),
 primary key(event_id,household)
);
alter table next1_test.registration_credentials enable row level security;
revoke all on next1_test.registration_credentials from public,anon,authenticated;

create or replace function public.next1_test_issue_registration_code(p_household text) returns text
language plpgsql security definer set search_path='' as $$
declare e next1_test.events; code text;
begin
 if next1_test.is_admin() is distinct from true then raise exception '僅指定管理人員可核發戶別驗證碼'; end if;
 select * into e from next1_test.events where id='test-2027' for update;
 if e.id is null or e.phase<>'registration' then raise exception '登記已截止'; end if;
 if not exists(select 1 from next1_test.households where id=p_household) then raise exception '戶別不存在'; end if;
 if exists(select 1 from next1_test.registrations where event_id=e.id and household=p_household) then
  raise exception '此戶已有登記，請使用原修改碼；不能重新核發';
 end if;
 code:=encode(extensions.gen_random_bytes(24),'hex');
 insert into next1_test.registration_credentials(event_id,household,token_hash,issued_by)
 values(e.id,p_household,encode(extensions.digest(code,'sha256'),'hex'),auth.uid())
 on conflict(event_id,household) do update set token_hash=excluded.token_hash,issued_by=excluded.issued_by,issued_at=now();
 insert into next1_test.audit(event_id,action,actor,detail)
 values(e.id,'issue_registration_code',auth.uid(),jsonb_build_object('household',p_household));
 return code;
end; $$;
revoke all on function public.next1_test_issue_registration_code(text) from public,anon,authenticated;
grant execute on function public.next1_test_issue_registration_code(text) to authenticated;
