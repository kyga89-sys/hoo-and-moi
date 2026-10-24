-- ============================================================
-- 후앤모아 업데이트: 카테고리 재구성 (새 분류 + 기획전 태그)
-- * 기존 데이터는 바꾸지 않습니다. 지금 쓰는 분류 칸(category)은 그대로 두고
--   새 분류 칸(category2)과 기획전 태그 칸(tags)을 "추가"만 합니다.
-- * 관리자 > 설정 > 분류 정리에서 새 분류를 확인·저장하고,
--   [새 분류로 전환]을 켜기 전까지 손님 화면은 지금과 똑같습니다.
-- Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 Run (다시 실행해도 안전)
-- ============================================================

-- 1) 새 분류 · 기획전 태그 칸
alter table public.products add column if not exists category2 text;
alter table public.products add column if not exists tags text[] not null default '{}';
grant select (category2, tags) on public.products to anon;

-- 2) 손님 화면에 새 분류를 쓸지 (기본: 꺼짐 = 지금 분류 그대로)
alter table public.store_settings add column if not exists use_new_category boolean not null default false;
grant select (use_new_category) on public.store_settings to anon;

-- 3) 관리자: 여러 상품의 새 분류·태그를 한 번에 저장
--    p_items: [{"id": "...", "category2": "상의 > 니트", "tags": ["NEW 할로윈특가"]}, ...]
create or replace function public.set_product_categories(p_items jsonb)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then raise exception '관리자만 사용할 수 있습니다.'; end if;
  update public.products p
     set category2 = nullif(trim(x ->> 'category2'), ''),
         tags = coalesce(array(select jsonb_array_elements_text(coalesce(x -> 'tags', '[]'::jsonb))), '{}')
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x
   where p.id::text = x ->> 'id';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.set_product_categories(jsonb) from public, anon;
grant execute on function public.set_product_categories(jsonb) to authenticated;

-- 4) 확인용
select count(*) as 전체상품, count(category2) as 새분류지정, count(*) filter (where cardinality(tags) > 0) as 태그있음,
       (select use_new_category from public.store_settings order by id limit 1) as 새분류사용
from public.products;
