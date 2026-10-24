-- ============================================================
-- 후앤모아 보안 2단계: 권한 잠그기 (RLS)
-- ⚠️ 반드시 "새 코드가 배포된 뒤"에 실행하세요.
--    (먼저 실행하면 예전 화면에서 주문/관리자 기능이 막힙니다)
-- * 데이터는 한 줄도 바꾸거나 지우지 않습니다. 권한만 바꿉니다.
-- * 되돌리려면 03_rollback.sql 실행
-- ============================================================

-- 0) 기존 정책 정리 (예전에 만든 "누구나 허용" 정책이 남아 있으면 잠금이 안 되므로 삭제)
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('products', 'categories', 'brands', 'notices', 'store_settings', 'orders', 'order_items')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 1) 모든 테이블 RLS 켜기
alter table public.products       enable row level security;
alter table public.categories     enable row level security;
alter table public.brands         enable row level security;
alter table public.notices        enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;

-- 2) 손님(anon)은 테이블에 직접 쓰기 금지 (주문은 create_order 함수로만)
revoke insert, update, delete, truncate on
  public.products, public.categories, public.brands, public.notices,
  public.store_settings, public.orders, public.order_items
from anon;

-- 3) 주문/주문상품: 손님은 직접 읽기도 금지 (조회는 lookup_orders 함수로만)
revoke select on public.orders, public.order_items from anon;

-- 4) 상품: 손님에게 "매입원가(cost_price)"는 숨김
--    ※ 나중에 products 에 컬럼을 추가하면 아래 grant 목록에도 추가해야 손님 화면에 보입니다
revoke select on public.products from anon;
grant select (id, name, price, category, main_image, description, is_active, created_at,
              sizes, sub_images, brand, colors) on public.products to anon;

-- 5) 쇼핑몰 설정: 손님에게 "관리자 비밀번호" 칸은 숨김
revoke select on public.store_settings from anon;
grant select (id, bank_name, account_number, depositor_name, shop_name, shop_name_kr,
              kakao_url, shipping_fee) on public.store_settings to anon;

-- 6) 읽기 정책: 상품/카테고리/브랜드/공지/설정은 누구나 보기 가능
create policy "누구나 보기" on public.products       for select to anon, authenticated using (true);
create policy "누구나 보기" on public.categories     for select to anon, authenticated using (true);
create policy "누구나 보기" on public.brands         for select to anon, authenticated using (true);
create policy "누구나 보기" on public.notices        for select to anon, authenticated using (true);
create policy "누구나 보기" on public.store_settings for select to anon, authenticated using (true);

-- 7) 관리자 정책: admin_users 에 등록된 계정만 등록/수정/삭제 + 주문 전체 보기
create policy "관리자 전체" on public.products       for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "관리자 전체" on public.categories     for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "관리자 전체" on public.brands         for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "관리자 전체" on public.notices        for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "관리자 전체" on public.store_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "관리자 전체" on public.orders         for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "관리자 전체" on public.order_items    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 8) 이미지 저장소(products 버킷): 올리기/바꾸기/지우기는 관리자만
--    (이미 올라간 사진은 공개 주소로 계속 보입니다)
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') || coalesce(with_check, '')) ilike '%products%'
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy "products 관리자 보기" on storage.objects for select to authenticated
  using (bucket_id = 'products' and public.is_admin());
create policy "products 관리자 업로드" on storage.objects for insert to authenticated
  with check (bucket_id = 'products' and public.is_admin());
create policy "products 관리자 수정" on storage.objects for update to authenticated
  using (bucket_id = 'products' and public.is_admin());
create policy "products 관리자 삭제" on storage.objects for delete to authenticated
  using (bucket_id = 'products' and public.is_admin());

-- 9) 확인용: 남아 있는 storage 정책 목록 (products 와 무관한 "누구나 허용" 정책이 보이면 알려주세요)
select policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'storage' and tablename = 'objects';

-- 9) 업데이트 SQL(updates/01~05)로 추가된 칸도 손님이 다시 읽을 수 있게 (이 파일을 나중에 실행해도 화면이 깨지지 않도록)
do $$
begin
  begin grant select (community_url, biz_owner, biz_number, ecommerce_number, biz_email) on public.store_settings to anon; exception when undefined_column then null; end;
  begin grant select (home_layout) on public.store_settings to anon; exception when undefined_column then null; end;
  begin grant select (list_price_rate) on public.store_settings to anon; exception when undefined_column then null; end;
  begin grant select (use_new_category) on public.store_settings to anon; exception when undefined_column then null; end;
  begin grant select (display_order) on public.products to anon; exception when undefined_column then null; end;
  begin grant select (is_soldout, list_price) on public.products to anon; exception when undefined_column then null; end;
  begin grant select (category2, tags) on public.products to anon; exception when undefined_column then null; end;
end $$;

-- 10) 확인용: 손님이 주문을 못 읽고(false), 원가를 못 읽고(false), 새 칸은 읽을 수 있으면(true) 성공
select has_table_privilege('anon', 'public.orders', 'select') as 손님_주문읽기,
       has_column_privilege('anon', 'public.products', 'cost_price', 'select') as 손님_원가읽기,
       has_column_privilege('anon', 'public.products', 'is_soldout', 'select') as 손님_품절읽기,
       has_column_privilege('anon', 'public.store_settings', 'biz_owner', 'select') as 손님_사업자정보읽기;
