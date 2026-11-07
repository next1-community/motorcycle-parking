-- Historical results: separate from test events and registration data.
begin;
create schema if not exists next1_archive;
revoke all on schema next1_archive from public,anon,authenticated;
grant usage on schema next1_archive to authenticated;
create table if not exists next1_archive.seasons (
 year integer primary key check(year between 2000 and 2200),
 use_start date not null, use_end date not null check(use_end>=use_start),
 source_name text not null, source_sha256 text,
 notes text not null default '', imported_at timestamptz not null default now()
);
create table if not exists next1_archive.results (
 year integer not null references next1_archive.seasons(year),
 spot integer not null check(spot between 1 and 62),
 household text, draw_rank integer check(draw_rank>0),
 status text not null check(status in ('assigned','not_recorded','unavailable')),
 primary key(year,spot),
 check((status='assigned' and household is not null and length(household)>0) or (status in ('not_recorded','unavailable') and household is null))
);
alter table next1_archive.seasons enable row level security;
alter table next1_archive.results enable row level security;
revoke all on all tables in schema next1_archive from public,anon,authenticated;
create or replace function next1_archive.history(p_year integer default null,p_household text default '',p_spot integer default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not next1_test.is_admin() then raise exception '僅授權管理員可查詢歷年紀錄' using errcode='42501'; end if;
 if length(coalesce(p_household,''))>50 or (p_spot is not null and p_spot not between 1 and 62) then raise exception '查詢條件不正確'; end if;
 select jsonb_build_object(
  'seasons',coalesce((select jsonb_agg(to_jsonb(s) order by s.year desc) from next1_archive.seasons s),'[]'::jsonb),
  'rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.year desc,r.spot) from next1_archive.results r
    where (p_year is null or r.year=p_year)
    and (p_spot is null or r.spot=p_spot)
    and strpos(upper(coalesce(r.household,'')),upper(trim(coalesce(p_household,''))))>0),'[]'::jsonb)
 ) into result;
 return result;
end; $$;
create or replace function public.next1_test_history(p_year integer default null,p_household text default '',p_spot integer default null)
returns jsonb language sql stable security invoker set search_path='' as $$ select next1_archive.history(p_year,p_household,p_spot); $$;
revoke all on function next1_archive.history(integer,text,integer) from public,anon,authenticated;
revoke all on function public.next1_test_history(integer,text,integer) from public,anon,authenticated;
grant execute on function next1_archive.history(integer,text,integer) to authenticated;
grant execute on function public.next1_test_history(integer,text,integer) to authenticated;
commit;
