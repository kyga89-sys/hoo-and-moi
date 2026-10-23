// 후앤모아 앱 설치용 서비스 워커
// - 안드로이드 Chrome 의 "앱 설치" 버튼이 뜨게 하는 역할만 합니다.
// - 화면을 저장(캐시)하지 않습니다 → 배포하면 항상 최신 화면이 나옵니다.
// - 인터넷이 끊겼을 때만 안내 문구를 보여줍니다.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return; // 사진·데이터 요청은 브라우저가 그대로 처리
  event.respondWith(
    fetch(event.request).catch(() => new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<body style="font-family:sans-serif;text-align:center;padding:60px 20px;background:#FCF6E8;color:#333">' +
      '<h2>인터넷 연결을 확인해주세요</h2><p>연결되면 후앤모아가 다시 열립니다.</p>' +
      '<button onclick="location.reload()" style="margin-top:16px;padding:12px 24px;border:none;border-radius:20px;background:#F06A7D;color:#fff;font-size:15px">다시 시도</button></body>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    ))
  );
});
