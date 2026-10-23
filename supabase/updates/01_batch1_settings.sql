-- ============================================================
-- 후앤모아 1차 업데이트: 쇼핑몰 설정 칸 추가
-- * 기존 데이터는 바꾸지 않습니다. 새 칸만 "추가"합니다.
-- * ⚠️ 새 코드를 배포하기 "전에" 먼저 실행하세요.
--   (새 코드는 이 칸들을 읽으므로, 없으면 설정을 못 불러옵니다)
-- Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 Run
-- ============================================================

-- 1) 새 칸 추가 (값이 비어 있으면 기본값으로 채워짐)
alter table public.store_settings add column if not exists community_url    text default 'https://open.kakao.com/o/g48GLFNi';
alter table public.store_settings add column if not exists biz_owner        text default '권용훈';
alter table public.store_settings add column if not exists biz_number       text default '229-36-01007';
alter table public.store_settings add column if not exists ecommerce_number text default '2026-대구동구-0101';
alter table public.store_settings add column if not exists biz_email        text default 'hooandmoi@gmail.com';

-- 2) 손님 화면에서 읽을 수 있도록 허용 (보안 2단계에서 칸 단위로 잠갔기 때문에 필요)
grant select (community_url, biz_owner, biz_number, ecommerce_number, biz_email)
  on public.store_settings to anon;

-- 3) 확인용
select shop_name_kr, kakao_url, community_url, biz_owner, biz_number, ecommerce_number, biz_email
from public.store_settings;
