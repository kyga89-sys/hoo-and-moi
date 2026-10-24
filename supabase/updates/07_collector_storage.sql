-- ============================================================
-- 업데이트 07: 기린컴퍼니 수집함 + 저장 공간(무료 한도) 보기
-- * 기존 데이터는 바꾸지 않습니다. 칸 하나와 관리자용 함수만 "추가"합니다.
--   - products.source_id : 어디서 가져온 상품인지 (예: girin:1238595) → 같은 상품 두 번 등록 막기
--   - admin_storage_usage() : DB·사진 저장 공간 사용량 (관리자만)
-- Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 Run (다시 실행해도 안전)
-- ============================================================

-- 1) 수집 출처 칸 (손님 화면에는 안 보냄)
alter table public.products add column if not exists source_id text;
create unique index if not exists products_source_id_key on public.products (source_id) where source_id is not null;

-- 2) 저장 공간 사용량 (무료: DB 500MB · 사진 저장소 1GB)
create or replace function public.admin_storage_usage()
returns json
language plpgsql security definer set search_path = public, storage
as $$
declare r json;
begin
  if not public.is_admin() then raise exception '관리자만 볼 수 있습니다.'; end if;
  select json_build_object(
    'db_bytes', pg_database_size(current_database()),
    'db_limit', 500 * 1024 * 1024,
    'products', (select count(*) from public.products),
    'products_bytes', pg_total_relation_size('public.products'),
    'storage_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0),
    'storage_files', (select count(*) from storage.objects),
    'storage_limit', 1024 * 1024 * 1024,
    'uploaded_products', (select count(*) from public.products where main_image like '%/storage/v1/object/public/%'),
    'collected_products', (select count(*) from public.products where source_id is not null),
    'photo_avg_bytes', coalesce((select avg((metadata->>'size')::bigint)::bigint from storage.objects
                                  where name like 'opt/%' or name ~ '^(main|sub)_\d+_[a-z0-9]{4}\.jpg$'), 120000)
  ) into r;
  return r;
end;
$$;
revoke all on function public.admin_storage_usage() from public, anon;
grant execute on function public.admin_storage_usage() to authenticated;

-- 3) 확인용
select count(*) as 전체상품, count(source_id) as 수집상품 from public.products;
