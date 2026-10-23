-- ============================================================
-- 후앤모아 보안 1단계: 함수 + 관리자 목록 만들기
-- * 기존 테이블/데이터는 건드리지 않습니다 (새로 "추가"만 함)
-- * 실행해도 지금 운영 중인 사이트는 그대로 동작합니다
-- Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 Run
-- ============================================================

-- 1) 관리자 이메일 목록 (이 목록에 있는 계정만 관리자 권한)
create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

-- ▼▼ 관리자로 쓸 이메일을 여기에 적으세요 (여러 개 가능) ▼▼
-- insert into public.admin_users(email) values ('관리자이메일@example.com') on conflict do nothing;


-- 2) 로그인한 사람이 관리자인지 확인
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;


-- 3) 옵션 글자에서 추가금 읽기: "XL(+2,000원)" -> 2000  (앱의 getExtraPrice 와 같은 규칙)
create or replace function public.option_extra_price(opt text)
returns integer
language sql immutable
as $$
  select coalesce(
    nullif(replace(substring(coalesce(opt, '') from '\(\s*\+([0-9,]+)\s*원?\s*\)'), ',', ''), '')::integer,
    0
  );
$$;


-- 4) 고객 주문 생성 (가격·원가·배송비는 서버에서 계산 → 금액 조작 불가)
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


-- 5) 고객 주문 조회 (연락처 + 주문번호 또는 이름이 맞아야 조회됨, 원가는 보내지 않음)
create or replace function public.lookup_orders(
  p_phone text,
  p_order_number text default null,
  p_name text default null
)
returns json
language sql stable security definer set search_path = public
as $$
  select coalesce(json_agg(o order by o.created_at desc), '[]'::json)
  from (
    select
      ord.id, ord.order_number, ord.customer_name, ord.phone, ord.address, ord.memo,
      ord.total_amount, ord.status, ord.tracking_number, ord.admin_memo, ord.created_at,
      coalesce((
        select json_agg(json_build_object('product_name', i.product_name, 'price', i.price, 'quantity', i.quantity))
        from public.order_items i where i.order_id = ord.id
      ), '[]'::json) as order_items
    from public.orders ord
    where regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') <> ''
      and regexp_replace(ord.phone, '[^0-9]', '', 'g') = regexp_replace(p_phone, '[^0-9]', '', 'g')
      and (
        (coalesce(trim(p_order_number), '') <> '' and ord.order_number = trim(p_order_number))
        or (coalesce(trim(p_order_number), '') = '' and coalesce(trim(p_name), '') <> '' and ord.customer_name = trim(p_name))
      )
  ) o;
$$;
grant execute on function public.lookup_orders(text, text, text) to anon, authenticated;


-- 6) 고객 배송지 수정 (본인 연락처가 맞고 '입금대기' 상태일 때만)
create or replace function public.update_my_order(
  p_order_id uuid,
  p_phone text,
  p_customer_name text,
  p_new_phone text,
  p_address text,
  p_memo text
)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(trim(p_customer_name), '') = '' or coalesce(trim(p_new_phone), '') = '' or coalesce(trim(p_address), '') = '' then
    raise exception '이름, 연락처, 배송지를 모두 입력해주세요.';
  end if;
  update public.orders
     set customer_name = trim(p_customer_name),
         phone = trim(p_new_phone),
         address = trim(p_address),
         memo = coalesce(p_memo, '')
   where id = p_order_id
     and status = '입금대기'
     and regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  return found;
end;
$$;
grant execute on function public.update_my_order(uuid, text, text, text, text, text) to anon, authenticated;
