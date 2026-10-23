-- ============================================================
-- 후앤모아 업데이트: 카카오톡 신규주문 알림 (관리자 본인에게 "나에게 보내기")
-- * 기존 테이블/데이터는 바꾸지 않습니다. 새 테이블·함수·예약 작업만 "추가"합니다.
-- * 카카오 앱 키·토큰은 손님이 절대 읽을 수 없는 칸에 저장되고, 관리자 함수로만 바꿉니다.
-- * 동작: 새 주문이 들어오면 30초~1분 안에 서버(Supabase)가 관리자 카카오톡으로 알림 전송
--         → 주문하는 손님 화면은 전혀 느려지지 않음 / 알림이 실패해도 주문은 그대로 접수
-- * 연결 유지: 매일 새벽 자동으로 토큰을 갱신하므로 2달 만료 없이 계속 유지됩니다.
-- Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 Run (다시 실행해도 안전)
-- ============================================================

-- 0) 외부 주소 호출(http) · 예약 실행(pg_cron) 기능 켜기 (Supabase 무료 요금제 포함)
create extension if not exists http with schema extensions;
create extension if not exists pg_cron;

-- 1) 카카오 알림 설정 (한 줄만 사용) — 손님·관리자 화면 모두 직접 읽기 불가, 아래 함수로만 접근
create table if not exists public.kakao_notify_settings (
  id integer primary key default 1 check (id = 1),
  enabled boolean not null default true,
  rest_api_key text,
  client_secret text,
  redirect_uri text,
  site_url text,
  access_token text,
  access_expires_at timestamptz,
  refresh_token text,
  refresh_expires_at timestamptz,
  connected_at timestamptz,
  last_sent_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.kakao_notify_settings (id) values (1) on conflict do nothing;
alter table public.kakao_notify_settings enable row level security;
revoke all on public.kakao_notify_settings from anon, authenticated;

-- 2) 주문별 알림 기록 (같은 주문을 두 번 보내지 않도록, 실패는 3번까지 다시 시도)
create table if not exists public.kakao_notify_log (
  order_id uuid primary key references public.orders(id) on delete cascade,
  status text not null,              -- sent / failed
  attempts integer not null default 0,
  error text,
  updated_at timestamptz not null default now()
);
alter table public.kakao_notify_log enable row level security;
revoke all on public.kakao_notify_log from anon, authenticated;


-- 3) 카카오 서버에 form 형식으로 요청 (내부용)
create or replace function public.kakao_http(p_url text, p_form jsonb, p_token text default null)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_res extensions.http_response;
  v_body jsonb;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '8000');
  select * into v_res from extensions.http((
    'POST', p_url,
    case when p_token is null then array[]::extensions.http_header[]
         else array[extensions.http_header('Authorization', 'Bearer ' || p_token)] end,
    'application/x-www-form-urlencoded;charset=utf-8',
    extensions.urlencode(p_form)
  )::extensions.http_request);
  begin
    v_body := v_res.content::jsonb;
  exception when others then
    v_body := jsonb_build_object('raw', left(v_res.content, 300));
  end;
  return jsonb_build_object('status', v_res.status, 'body', v_body);
end;
$$;
revoke all on function public.kakao_http(text, jsonb, text) from public, anon, authenticated;


-- 4) 카카오 오류를 알아보기 쉬운 말로 (내부용)
create or replace function public.kakao_error_text(p_res jsonb)
returns text
language sql immutable
as $$
  select case
    when p_res -> 'body' ->> 'error_code' = 'KOE010' or p_res -> 'body' ->> 'error' = 'invalid_client'
      then 'REST API 키 또는 Client Secret 이 맞지 않습니다. (설정 > 카카오톡 주문 알림에서 확인)'
    when p_res -> 'body' ->> 'error_code' = 'KOE006'
      then 'Redirect URI 가 카카오 앱에 등록된 주소와 다릅니다.'
    when p_res -> 'body' ->> 'error_code' = 'KOE320'
      then '카카오 인증 코드가 만료됐습니다. [카카오 연결하기]를 다시 눌러주세요.'
    when p_res -> 'body' ->> 'error' = 'invalid_grant'
      then '카카오 연결이 끊겼습니다. [카카오 연결하기]를 다시 눌러주세요.'
    when (p_res -> 'body' ->> 'code') = '-402'
      then '카카오톡 메시지 전송 동의가 없습니다. 카카오 앱 동의항목에서 "카카오톡 메시지 전송"을 켜고 다시 연결해주세요.'
    when (p_res -> 'body' ->> 'code') = '-401'
      then '카카오 연결이 만료됐습니다. [카카오 연결하기]를 다시 눌러주세요.'
    else '카카오 오류 (' || coalesce(p_res ->> 'status', '?') || '): '
         || left(coalesce(p_res -> 'body' ->> 'error_description', p_res -> 'body' ->> 'msg', p_res -> 'body' ->> 'raw', p_res ->> 'body', ''), 200)
  end;
$$;


-- 5) 유효한 액세스 토큰 꺼내기 (만료 5분 전이면 갱신, p_force = 무조건 갱신) (내부용)
create or replace function public.kakao_access_token(p_force boolean default false)
returns text
language plpgsql security definer set search_path = public, extensions
as $$
declare
  s public.kakao_notify_settings%rowtype;
  v_res jsonb;
  v_form jsonb;
begin
  select * into s from public.kakao_notify_settings where id = 1;
  if s.refresh_token is null or s.rest_api_key is null then
    return null;
  end if;
  if not p_force and s.access_token is not null and s.access_expires_at > now() + interval '5 minutes' then
    return s.access_token;
  end if;

  v_form := jsonb_build_object('grant_type', 'refresh_token', 'client_id', s.rest_api_key, 'refresh_token', s.refresh_token);
  if coalesce(s.client_secret, '') <> '' then
    v_form := v_form || jsonb_build_object('client_secret', s.client_secret);
  end if;
  v_res := public.kakao_http('https://kauth.kakao.com/oauth/token', v_form);

  if (v_res ->> 'status')::int <> 200 then
    update public.kakao_notify_settings
       set last_error = public.kakao_error_text(v_res), last_error_at = now(),
           -- 리프레시 토큰 자체가 무효면 더 시도하지 않고 "다시 연결" 안내
           refresh_token = case when v_res -> 'body' ->> 'error' = 'invalid_grant' then null else refresh_token end,
           access_token = case when v_res -> 'body' ->> 'error' = 'invalid_grant' then null else access_token end
     where id = 1;
    return null;
  end if;

  update public.kakao_notify_settings
     set access_token = v_res -> 'body' ->> 'access_token',
         access_expires_at = now() + make_interval(secs => coalesce((v_res -> 'body' ->> 'expires_in')::int, 21599)),
         -- 남은 기간이 1개월 미만일 때만 카카오가 새 리프레시 토큰을 줌 → 받으면 교체
         refresh_token = coalesce(v_res -> 'body' ->> 'refresh_token', refresh_token),
         refresh_expires_at = case when v_res -> 'body' ? 'refresh_token_expires_in'
                                   then now() + make_interval(secs => (v_res -> 'body' ->> 'refresh_token_expires_in')::int)
                                   else refresh_expires_at end,
         updated_at = now()
   where id = 1;
  return v_res -> 'body' ->> 'access_token';
end;
$$;
revoke all on function public.kakao_access_token(boolean) from public, anon, authenticated;


-- 6) 나에게 보내기 (내부용) — 성공하면 null, 실패하면 오류 문구
create or replace function public.kakao_send_memo(p_text text, p_button text default '관리자 화면 열기')
returns text
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_token text;
  v_res jsonb;
  v_site text;
  v_err text;
begin
  v_token := public.kakao_access_token(false);
  if v_token is null then
    select coalesce(last_error, '카카오가 연결되지 않았습니다.') into v_err from public.kakao_notify_settings where id = 1;
    return v_err;
  end if;
  select coalesce(site_url, 'https://hoo-and-moi.web.app') into v_site from public.kakao_notify_settings where id = 1;

  v_res := public.kakao_http(
    'https://kapi.kakao.com/v2/api/talk/memo/default/send',
    jsonb_build_object('template_object', jsonb_build_object(
      'object_type', 'text',
      'text', case when char_length(p_text) > 200 then left(p_text, 199) || '…' else p_text end,
      'link', jsonb_build_object('web_url', v_site, 'mobile_web_url', v_site),
      'button_title', p_button
    )::text),
    v_token
  );

  if (v_res ->> 'status')::int = 200 then
    update public.kakao_notify_settings set last_sent_at = now(), last_error = null, last_error_at = null where id = 1;
    return null;
  end if;
  v_err := public.kakao_error_text(v_res);
  update public.kakao_notify_settings set last_error = v_err, last_error_at = now() where id = 1;
  return v_err;
end;
$$;
revoke all on function public.kakao_send_memo(text, text) from public, anon, authenticated;


-- 7) 새 주문 알림 보내기 (예약 작업이 30초~1분마다 실행) (내부용)
create or replace function public.kakao_process_new_orders()
returns integer
language plpgsql security definer set search_path = public, extensions
as $$
declare
  s public.kakao_notify_settings%rowtype;
  o record;
  v_items text;
  v_count integer;
  v_text text;
  v_err text;
  v_sent integer := 0;
begin
  select * into s from public.kakao_notify_settings where id = 1;
  if not s.enabled or s.refresh_token is null or s.connected_at is null then
    return 0;
  end if;

  for o in
    select ord.* from public.orders ord
    left join public.kakao_notify_log l on l.order_id = ord.id
    where ord.created_at >= greatest(s.connected_at, now() - interval '1 day')
      and (l.order_id is null or (l.status = 'failed' and l.attempts < 3))
    order by ord.created_at
    limit 10
  loop
    select string_agg(i.product_name || ' ×' || i.quantity, E'\n'), count(*)
      into v_items, v_count
      from public.order_items i where i.order_id = o.id;

    v_text := '🛍 새 주문이 들어왔어요' || E'\n\n'
      || '주문번호 ' || o.order_number || E'\n'
      || '주문자 ' || o.customer_name || E'\n'
      || '금액 ' || to_char(o.total_amount, 'FM999,999,999') || '원 (' || coalesce(o.status, '입금대기') || ')' || E'\n'
      || '상품 ' || coalesce(v_count, 0) || '건' || E'\n'
      || coalesce(v_items, '');

    v_err := public.kakao_send_memo(v_text, '주문 확인하기');

    insert into public.kakao_notify_log (order_id, status, attempts, error, updated_at)
    values (o.id, case when v_err is null then 'sent' else 'failed' end, 1, v_err, now())
    on conflict (order_id) do update
      set status = excluded.status, attempts = public.kakao_notify_log.attempts + 1,
          error = excluded.error, updated_at = now();

    if v_err is null then v_sent := v_sent + 1; else exit; end if;  -- 실패하면 이번 회차는 멈추고 다음에 다시
  end loop;
  return v_sent;
end;
$$;
revoke all on function public.kakao_process_new_orders() from public, anon, authenticated;


-- 8) 연결 유지 (매일 1번): 리프레시 토큰이 1개월 미만 남으면 갱신 → 사실상 만료 없음 (내부용)
create or replace function public.kakao_keep_alive()
returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare
  s public.kakao_notify_settings%rowtype;
begin
  select * into s from public.kakao_notify_settings where id = 1;
  if s.refresh_token is null then return; end if;
  if s.refresh_expires_at is null or s.refresh_expires_at < now() + interval '30 days' then
    perform public.kakao_access_token(true);
  end if;
  -- 예약 실행 기록이 쌓이지 않도록 3일 지난 기록 정리
  delete from cron.job_run_details d
   using cron.job j
   where d.jobid = j.jobid and j.jobname like 'hm-kakao-%' and d.end_time < now() - interval '3 days';
end;
$$;
revoke all on function public.kakao_keep_alive() from public, anon, authenticated;


-- ============== 관리자 화면에서 쓰는 함수 (관리자 로그인 필요) ==============

-- 9) 현재 상태 보기 (토큰 값은 절대 내보내지 않음)
create or replace function public.kakao_admin_status()
returns json
language plpgsql security definer set search_path = public
as $$
declare
  s public.kakao_notify_settings%rowtype;
begin
  if not public.is_admin() then raise exception '관리자만 사용할 수 있습니다.'; end if;
  select * into s from public.kakao_notify_settings where id = 1;
  return json_build_object(
    'enabled', s.enabled,
    'rest_api_key', s.rest_api_key,
    'has_client_secret', coalesce(s.client_secret, '') <> '',
    'connected', s.refresh_token is not null,
    'connected_at', s.connected_at,
    'refresh_expires_at', s.refresh_expires_at,
    'redirect_uri', s.redirect_uri,
    'last_sent_at', s.last_sent_at,
    'last_error', s.last_error,
    'last_error_at', s.last_error_at,
    'sent_count', (select count(*) from public.kakao_notify_log where status = 'sent'),
    'failed_count', (select count(*) from public.kakao_notify_log where status = 'failed')
  );
end;
$$;
grant execute on function public.kakao_admin_status() to authenticated;

-- 10) 앱 키 저장 / 알림 켜고 끄기
--     p_client_secret: null = 그대로 두기, '' = 지우기, 값 = 바꾸기
--     REST API 키가 바뀌면(다른 카카오 앱) 기존 연결은 끊고 다시 연결하도록 함
create or replace function public.kakao_admin_save(p_rest_api_key text, p_client_secret text, p_enabled boolean)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_old text;
begin
  if not public.is_admin() then raise exception '관리자만 사용할 수 있습니다.'; end if;
  select rest_api_key into v_old from public.kakao_notify_settings where id = 1;
  update public.kakao_notify_settings
     set rest_api_key = nullif(trim(coalesce(p_rest_api_key, '')), ''),
         client_secret = case when p_client_secret is null then client_secret else nullif(trim(p_client_secret), '') end,
         enabled = coalesce(p_enabled, enabled),
         access_token = case when coalesce(v_old, '') is distinct from coalesce(nullif(trim(p_rest_api_key), ''), '') then null else access_token end,
         refresh_token = case when coalesce(v_old, '') is distinct from coalesce(nullif(trim(p_rest_api_key), ''), '') then null else refresh_token end,
         updated_at = now()
   where id = 1;
  return public.kakao_admin_status();
end;
$$;
grant execute on function public.kakao_admin_save(text, text, boolean) to authenticated;

-- 11) 카카오 로그인 후 돌아온 인증 코드로 연결 (연결되면 확인 메시지 1통 전송)
create or replace function public.kakao_admin_connect(p_code text, p_redirect_uri text)
returns json
language plpgsql security definer set search_path = public, extensions
as $$
declare
  s public.kakao_notify_settings%rowtype;
  v_form jsonb;
  v_res jsonb;
  v_err text;
begin
  if not public.is_admin() then raise exception '관리자만 사용할 수 있습니다.'; end if;
  select * into s from public.kakao_notify_settings where id = 1;
  if s.rest_api_key is null then raise exception 'REST API 키를 먼저 저장해주세요.'; end if;

  v_form := jsonb_build_object('grant_type', 'authorization_code', 'client_id', s.rest_api_key,
                               'redirect_uri', p_redirect_uri, 'code', p_code);
  if coalesce(s.client_secret, '') <> '' then
    v_form := v_form || jsonb_build_object('client_secret', s.client_secret);
  end if;
  v_res := public.kakao_http('https://kauth.kakao.com/oauth/token', v_form);
  if (v_res ->> 'status')::int <> 200 then
    raise exception '%', public.kakao_error_text(v_res);
  end if;
  if position('talk_message' in coalesce(v_res -> 'body' ->> 'scope', 'talk_message')) = 0 then
    raise exception '카카오톡 메시지 전송에 동의하지 않았습니다. 동의 화면에서 "카카오톡 메시지 전송"을 체크해주세요.';
  end if;

  update public.kakao_notify_settings
     set access_token = v_res -> 'body' ->> 'access_token',
         access_expires_at = now() + make_interval(secs => coalesce((v_res -> 'body' ->> 'expires_in')::int, 21599)),
         refresh_token = v_res -> 'body' ->> 'refresh_token',
         refresh_expires_at = now() + make_interval(secs => coalesce((v_res -> 'body' ->> 'refresh_token_expires_in')::int, 5183999)),
         redirect_uri = p_redirect_uri,
         site_url = regexp_replace(p_redirect_uri, '^(https?://[^/]+).*$', '\1'),
         connected_at = now(), enabled = true, last_error = null, last_error_at = null, updated_at = now()
   where id = 1;

  v_err := public.kakao_send_memo('✅ 후앤모아 주문 알림이 연결됐어요.' || E'\n' || '이제 새 주문이 들어오면 이 카카오톡으로 알려드릴게요.');
  if v_err is not null then raise exception '연결은 됐지만 확인 메시지 전송 실패: %', v_err; end if;
  return public.kakao_admin_status();
end;
$$;
grant execute on function public.kakao_admin_connect(text, text) to authenticated;

-- 12) 테스트 메시지 보내기
create or replace function public.kakao_admin_test()
returns json
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_err text;
begin
  if not public.is_admin() then raise exception '관리자만 사용할 수 있습니다.'; end if;
  v_err := public.kakao_send_memo('🔔 후앤모아 알림 테스트' || E'\n' || to_char(now() at time zone 'Asia/Seoul', 'MM/DD HH24:MI') || ' 정상 연결되어 있어요.');
  if v_err is not null then raise exception '%', v_err; end if;
  return public.kakao_admin_status();
end;
$$;
grant execute on function public.kakao_admin_test() to authenticated;

-- 13) 연결 끊기 (토큰만 지움, 앱 키는 남겨둠)
create or replace function public.kakao_admin_disconnect()
returns json
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception '관리자만 사용할 수 있습니다.'; end if;
  update public.kakao_notify_settings
     set access_token = null, access_expires_at = null, refresh_token = null, refresh_expires_at = null,
         connected_at = null, last_error = null, last_error_at = null, updated_at = now()
   where id = 1;
  return public.kakao_admin_status();
end;
$$;
grant execute on function public.kakao_admin_disconnect() to authenticated;


-- 14) 예약 작업 등록 (같은 이름이 있으면 지우고 다시 등록)
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('hm-kakao-notify', 'hm-kakao-keepalive');
  begin
    perform cron.schedule('hm-kakao-notify', '30 seconds', 'select public.kakao_process_new_orders()');
  exception when others then
    -- 초 단위를 지원하지 않는 버전이면 1분마다
    perform cron.schedule('hm-kakao-notify', '* * * * *', 'select public.kakao_process_new_orders()');
  end;
  perform cron.schedule('hm-kakao-keepalive', '17 19 * * *', 'select public.kakao_keep_alive()');  -- 매일 새벽 4:17 (한국)
end;
$$;

-- 15) 확인용: 예약 작업 2개가 보이면 성공
select jobname as 예약작업, schedule as 주기, active as 켜짐 from cron.job where jobname like 'hm-kakao-%' order by jobname;
