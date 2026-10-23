-- ============================================================
-- 후앤모아 업데이트: 홈 화면 배치 (분류 탭 · 브랜드 · 상품 순서)
-- * 기존 데이터는 바꾸지 않습니다. 새 칸과 함수만 "추가"합니다.
--   (새 칸은 비어 있는 상태로 시작 → 지금 보이는 순서 그대로)
-- * 새 코드 배포 전·후 언제 실행해도 됩니다. (새 코드는 칸이 없으면 예전 방식으로 동작)
-- Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 Run
-- ============================================================

-- 1) 상품 노출 순서 칸 (작은 숫자가 앞, 비어 있으면 = 새 상품 → 맨 앞)
alter table public.products add column if not exists display_order integer;
grant select (display_order) on public.products to anon;

-- 2) 홈 화면 배치 설정 칸 (분류 탭 순서, 브랜드 순서)
alter table public.store_settings add column if not exists home_layout jsonb default '{}'::jsonb;
grant select (home_layout) on public.store_settings to anon;

-- 3) 상품 순서 한 번에 저장 (관리자만)
--    p_ids: 원하는 순서대로 나열한 상품 id 목록 → 1, 2, 3 ... 번호 부여
--    p_ids 가 비어 있으면(null) 전체 순서 초기화 → 최신 등록순
create or replace function public.set_product_order(p_ids uuid[])
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_count integer;
begin
  if not public.is_admin() then
    raise exception '관리자만 순서를 바꿀 수 있습니다.';
  end if;

  if p_ids is null then
    update public.products set display_order = null where display_order is not null;
    get diagnostics v_count = row_count;
    return v_count;
  end if;

  update public.products p
     set display_order = t.ord
    from unnest(p_ids) with ordinality as t(id, ord)
   where p.id = t.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.set_product_order(uuid[]) from public, anon;
grant execute on function public.set_product_order(uuid[]) to authenticated;

-- 4) 확인용
select count(*) as 전체상품, count(display_order) as 순서지정상품 from public.products;
