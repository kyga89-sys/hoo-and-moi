-- ============================================================
-- 업데이트 08: 기린 수집함을 DB에 저장 (PC·아이폰 어디서 수집해도 같은 수집함)
-- * 기존 데이터는 바꾸지 않습니다. 수집함 전용 표 하나만 "추가"합니다.
-- * 관리자만 읽고 쓸 수 있습니다. (손님·비로그인은 볼 수 없음)
-- Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 Run (다시 실행해도 안전)
-- ============================================================

create table if not exists public.collect_inbox (
  source_id  text primary key,              -- 예: girin:1238884
  item       jsonb not null,                -- 수집한 상품 정보(이름·가격·옵션·사진 주소 등)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.collect_inbox enable row level security;
revoke all on public.collect_inbox from anon;
grant select, insert, update, delete on public.collect_inbox to authenticated;

drop policy if exists "관리자 전체" on public.collect_inbox;
create policy "관리자 전체" on public.collect_inbox for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 확인용
select count(*) as 수집함 from public.collect_inbox;
