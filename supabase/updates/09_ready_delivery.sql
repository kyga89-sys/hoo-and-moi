-- ============================================================
-- 후앤모아 업데이트: 바로 배송(옵션별) + 바로배송/선주문 배송비 따로 받기
-- * 기존 데이터는 바꾸지 않습니다. 주문 함수(create_order)만 다시 만듭니다.
--   - 상품 tags 에 '바로배송' 이 있으면 바로 배송 상품
--   - tags 에 '바로배송|색상|사이즈' 가 하나라도 있으면 그 칸만 바로 배송, 없으면 모든 옵션이 바로 배송
--   - 한 주문에 바로배송과 선주문이 섞이면 배송비를 각각 한 번씩(기본 배송비 x 2) 받음
--   - 바로배송 줄은 주문 상품 이름 끝에 ' [바로배송]' 이 붙음
-- * 새 앱 배포 "전"에 실행하세요 (앱의 배송비 계산과 같은 규칙).
-- Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 Run
-- ============================================================

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
  v_ready boolean;
  v_ready_cnt integer := 0;
  v_pre_cnt integer := 0;
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

    -- 바로 배송 여부 (앱의 isReadyOption 과 같은 규칙)
    v_ready := false;
    if '바로배송' = any (coalesce(v_product.tags, '{}'::text[])) then
      if not exists (select 1 from unnest(v_product.tags) t where t like '바로배송|%') then
        v_ready := true;
      else
        v_ready := ('바로배송|' || coalesce(v_color, '') || '|' || coalesce(v_size, '')) = any (v_product.tags);
      end if;
    end if;
    if v_ready then v_ready_cnt := v_ready_cnt + 1; else v_pre_cnt := v_pre_cnt + 1; end if;

    v_unit := coalesce(v_product.price, 0) + public.option_extra_price(v_size) + public.option_extra_price(v_color);
    v_items_total := v_items_total + v_unit * v_qty;
    v_option := concat_ws(' / ', v_color, v_size);

    v_rows := v_rows || jsonb_build_object(
      'product_name', '[' || coalesce(nullif(v_product.brand, ''), '자체제작') || '] ' || v_product.name || ' '
                      || case when v_option <> '' then '(' || v_option || ')' else '' end
                      || case when v_ready then ' [바로배송]' else '' end,
      'price', v_unit,
      'quantity', v_qty,
      'cost_price', coalesce(v_product.cost_price, 0)
    );
  end loop;

  select coalesce(shipping_fee, 0) into v_shipping from public.store_settings order by id limit 1;
  v_shipping := coalesce(v_shipping, 0);
  -- 바로배송 묶음, 선주문 묶음 각각 한 번씩
  v_shipping := v_shipping * ((case when v_ready_cnt > 0 then 1 else 0 end) + (case when v_pre_cnt > 0 then 1 else 0 end));

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

-- 확인용: 함수가 새 규칙인지(true 면 적용됨)
select position('바로배송' in pg_get_functiondef('public.create_order(text,text,text,text,jsonb)'::regprocedure)) > 0 as 새_배송비_규칙_적용됨;
