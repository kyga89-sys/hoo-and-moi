-- ============================================================
-- 후앤모아 업데이트: 품절 처리 + 정가 삭선(할인율)
-- * 기존 데이터는 바꾸지 않습니다. 새 칸만 "추가"하고 주문 함수에 품절 검사를 더합니다.
--   - 품절: 모든 상품 "판매중"으로 시작
--   - 정가: 비어 있음 = 설정 배율로 자동 계산, 0 = 정가 표시 안 함
--   - 배율: 기본 30% (설정 > 가격 표시에서 변경)
-- * 새 코드 배포 전·후 언제 실행해도 됩니다.
-- Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 Run
-- ============================================================

-- 1) 품절 · 정가 칸
alter table public.products add column if not exists is_soldout boolean not null default false;
alter table public.products add column if not exists list_price integer;
grant select (is_soldout, list_price) on public.products to anon;

-- 2) 정가 배율(%) 설정 칸
alter table public.store_settings add column if not exists list_price_rate integer default 30;
grant select (list_price_rate) on public.store_settings to anon;

-- 3) 고객 주문 생성 (보안 1단계 함수와 같고, 품절 검사 2곳만 추가) (가격·원가·배송비는 서버에서 계산 → 금액 조작 불가)
--    p_items: [{"product_id": "...", "size": "...", "color": "...", "quantity": 1}, ...]
create or replace function public.create_order(
  p_customer_name text,
  p_phone text,
  p_address text,
  p_memo text,
  p_items jsonb
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_item jsonb;
  v_product public.products%rowtype;
  v_size text;
  v_color text;
  v_qty integer;
  v_option text;
  v_unit integer;
  v_items_total integer := 0;
  v_shipping integer;
  v_number text;
  v_order public.orders%rowtype;
  v_rows jsonb := '[]'::jsonb;
begin
  if coalesce(trim(p_customer_name), '') = '' or coalesce(trim(p_phone), '') = '' or coalesce(trim(p_address), '') = '' then
    raise exception '이름, 연락처, 배송지를 모두 입력해주세요.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception '장바구니가 비어있습니다.';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception '한 번에 주문할 수 있는 상품 수를 넘었습니다.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products where id::text = (v_item ->> 'product_id');
    if not found then
      raise exception '판매가 종료된 상품이 있습니다. 장바구니를 확인해주세요.';
    end if;
    if coalesce(v_product.is_soldout, false) then
      raise exception '[%] 품절된 상품입니다. 장바구니에서 빼주세요.', v_product.name;
    end if;

    v_size  := nullif(trim(coalesce(v_item ->> 'size', '')), '');
    v_color := nullif(trim(coalesce(v_item ->> 'color', '')), '');
    v_qty   := coalesce((v_item ->> 'quantity')::integer, 0);
    if v_qty < 1 or v_qty > 99 then
      raise exception '수량이 올바르지 않습니다.';
    end if;

    -- 상품에 등록된 옵션만 허용
    if coalesce(v_product.sizes, '') <> '' and (v_size is null or not v_size = any (
         select trim(s) from unnest(string_to_array(v_product.sizes, ',')) s)) then
      raise exception '[%] 사이즈를 다시 선택해주세요.', v_product.name;
    end if;
    if coalesce(v_product.colors, '') <> '' and (v_color is null or not v_color = any (
         select trim(c) from unnest(string_to_array(v_product.colors, ',')) c)) then
      raise exception '[%] 색상을 다시 선택해주세요.', v_product.name;
    end if;

    if coalesce(v_size, '') like '%품절%' or coalesce(v_color, '') like '%품절%' then
      raise exception '[%] 선택한 옵션이 품절입니다.', v_product.name;
    end if;

    v_unit := coalesce(v_product.price, 0) + public.option_extra_price(v_size) + public.option_extra_price(v_color);
    v_items_total := v_items_total + v_unit * v_qty;
    v_option := concat_ws(' / ', v_color, v_size);

    v_rows := v_rows || jsonb_build_object(
      'product_name', '[' || coalesce(nullif(v_product.brand, ''), '자체제작') || '] ' || v_product.name || ' '
                      || case when v_option <> '' then '(' || v_option || ')' else '' end,
      'price', v_unit,
      'quantity', v_qty,
      'cost_price', coalesce(v_product.cost_price, 0)
    );
  end loop;

  select coalesce(shipping_fee, 0) into v_shipping from public.store_settings order by id limit 1;
  v_shipping := coalesce(v_shipping, 0);

  loop
    v_number := 'HM-' || to_char(now() at time zone 'Asia/Seoul', 'YYYYMMDD') || '-' || floor(random() * 1000)::integer::text;
    exit when not exists (select 1 from public.orders where order_number = v_number);
  end loop;

  insert into public.orders (order_number, customer_name, phone, address, memo, total_amount, status)
  values (v_number, trim(p_customer_name), trim(p_phone), trim(p_address), coalesce(p_memo, ''), v_items_total + v_shipping, '입금대기')
  returning * into v_order;

  insert into public.order_items (order_id, product_name, price, quantity, cost_price)
  select v_order.id, r ->> 'product_name', (r ->> 'price')::integer, (r ->> 'quantity')::integer, (r ->> 'cost_price')::integer
  from jsonb_array_elements(v_rows) r;

  return json_build_object(
    'id', v_order.id,
    'order_number', v_order.order_number,
    'customer_name', v_order.customer_name,
    'phone', v_order.phone,
    'total_amount', v_order.total_amount,
    'status', v_order.status,
    'created_at', v_order.created_at
  );
end;
$$;
grant execute on function public.create_order(text, text, text, text, jsonb) to anon, authenticated;

-- 4) 확인용
select count(*) as 전체상품, count(*) filter (where is_soldout) as 품절상품, count(list_price) as 정가지정상품,
       (select list_price_rate from public.store_settings order by id limit 1) as 정가배율
from public.products;
