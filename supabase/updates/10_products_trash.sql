-- ============================================================
-- 후앤모아 업데이트: 삭제된 상품 보관함(휴지통) — 삭제하면 7일 동안 보관, 그 안에는 복원 가능
-- * 기존 상품·주문 데이터는 바꾸지 않습니다. 새 표(products_trash)와 함수 3개만 "추가"합니다.
--   - 삭제한 상품은 상품 표에서 빠지고(손님 화면에서 사라짐) 보관함에 통째로 복사해 둠
--   - 7일이 지나면 자동으로 완전 삭제(매일 새벽 + 보관함을 열 때마다)
--   - 상품 사진 파일(저장소)은 지우지 않음
-- * 새 앱 배포 "전"에 실행하세요.
-- Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 Run
-- ============================================================

create table if not exists public.products_trash (
  id text primary key,
  data jsonb not null,
  deleted_at timestamptz not null default now()
);
alter table public.products_trash enable row level security;
revoke all on public.products_trash from anon, authenticated;
grant select, delete on public.products_trash to authenticated;
drop policy if exists "관리자 전체" on public.products_trash;
create policy "관리자 전체" on public.products_trash for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 1) 보관함으로 옮기기 (상품 표에서 빼고 보관함에 복사, 한 번에 처리)
create or replace function public.trash_products(p_ids text[])
returns integer
language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  if not public.is_admin() then raise exception '관리자만 사용할 수 있습니다.'; end if;
  insert into public.products_trash (id, data, deleted_at)
  select p.id::text, to_jsonb(p), now() from public.products p where p.id::text = any (p_ids)
  on conflict (id) do update set data = excluded.data, deleted_at = excluded.deleted_at;
  delete from public.products p where p.id::text = any (p_ids);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- 2) 복원 (보관함에서 상품 표로 되돌리기)
create or replace function public.restore_products(p_ids text[])
returns integer
language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  if not public.is_admin() then raise exception '관리자만 사용할 수 있습니다.'; end if;
  with ins as (
    insert into public.products
    select (jsonb_populate_record(null::public.products, t.data)).*
    from public.products_trash t where t.id = any (p_ids)
    on conflict (id) do nothing
    returning id::text as rid
  )
  delete from public.products_trash t using ins where t.id = ins.rid;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- 3) 7일 지난 것 완전 삭제
create or replace function public.purge_products_trash()
returns integer
language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  delete from public.products_trash where deleted_at < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.trash_products(text[]), public.restore_products(text[]), public.purge_products_trash() from public, anon;
grant execute on function public.trash_products(text[]), public.restore_products(text[]), public.purge_products_trash() to authenticated;

-- 4) 매일 새벽 자동 정리 (예약 기능이 없는 경우엔 건너뜀 — 보관함을 열 때도 정리됨)
do $$
begin
  perform cron.schedule('purge-products-trash', '15 18 * * *', 'select public.purge_products_trash()');
exception when others then
  raise notice '예약 정리는 건너뜀: %', sqlerrm;
end;
$$;

-- 확인용
select (select count(*) from information_schema.tables where table_name = 'products_trash') as 보관함표,
       (select count(*) from pg_proc where proname in ('trash_products', 'restore_products', 'purge_products_trash')) as 함수수;
