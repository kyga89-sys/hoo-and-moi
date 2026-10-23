-- ============================================================
-- 비상용: 2단계(02_lock_down.sql) 되돌리기
-- 사이트가 안 될 때만 실행하세요. 권한을 보안 작업 이전처럼 "누구나 허용"으로 돌립니다.
-- 데이터는 바꾸지 않습니다.
-- ============================================================

grant select, insert, update, delete on
  public.products, public.categories, public.brands, public.notices,
  public.store_settings, public.orders, public.order_items
to anon, authenticated;

alter table public.products       disable row level security;
alter table public.categories     disable row level security;
alter table public.brands         disable row level security;
alter table public.notices        disable row level security;
alter table public.store_settings disable row level security;
alter table public.orders         disable row level security;
alter table public.order_items    disable row level security;

drop policy if exists "products 관리자 보기" on storage.objects;
drop policy if exists "products 관리자 업로드" on storage.objects;
drop policy if exists "products 관리자 수정" on storage.objects;
drop policy if exists "products 관리자 삭제" on storage.objects;
create policy "products 누구나 업로드(임시)" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'products');
