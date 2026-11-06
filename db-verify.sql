-- All temporary data changes are rolled back; preserves open test registration.
begin;
insert into next1_test.admins(email) values('qa-admin@example.invalid');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","email":"qa-admin@example.invalid","role":"authenticated"}',true);
do $$
declare s jsonb; rev integer; count_lots integer;
begin
 s:=public.next1_test_snapshot();
 if (s->>'is_admin')::boolean is distinct from true then raise exception 'admin check failed'; end if;
 rev:=(s->'event'->>'revision')::integer;
 s:=public.next1_test_admin('lock',rev,null);
 s:=public.next1_test_admin('draw',(s->'event'->>'revision')::integer,null);
 count_lots:=jsonb_array_length(s->'lots');
 if count_lots<>13 then raise exception 'wrong lot count %',count_lots; end if;
 begin
  perform public.next1_test_admin('draw',(s->'event'->>'revision')::integer,null);
  raise exception 'repeat draw was accepted';
 exception when others then if sqlerrm='repeat draw was accepted' then raise; end if; end;
 s:=public.next1_test_admin('start',(s->'event'->>'revision')::integer,null);
 s:=public.next1_test_admin('pending',(s->'event'->>'revision')::integer,4);
 s:=public.next1_test_admin('confirm',(s->'event'->>'revision')::integer,null);
 s:=public.next1_test_admin('next',(s->'event'->>'revision')::integer,null);
 begin
  perform public.next1_test_admin('pending',(s->'event'->>'revision')::integer,4);
  raise exception 'duplicate allocation was accepted';
 exception when others then if sqlerrm='duplicate allocation was accepted' then raise; end if; end;
 begin
  perform public.next1_test_admin('pending',0,5);
  raise exception 'stale revision was accepted';
 exception when others then if sqlerrm='stale revision was accepted' then raise; end if; end;
 s:=public.next1_test_admin('delegate',(s->'event'->>'revision')::integer,5);
 s:=public.next1_test_admin('confirm',(s->'event'->>'revision')::integer,null);
 if not exists(select 1 from next1_test.lots where rank=2 and status='delegated' and spot=5) then raise exception 'delegate state failed'; end if;
end $$;
rollback;
select 'PASS: admin auth, full draw, no redraw, unique allocation, stale revision guard, delegate state; rolled back' as verification;
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='next1_test' and c.relkind='r';
