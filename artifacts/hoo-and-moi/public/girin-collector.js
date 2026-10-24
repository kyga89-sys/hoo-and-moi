/* 🛒 기린컴퍼니 상품 수집기 — 가게마다 따로 (이 파일을 내려준 쇼핑몰로만 보냄)
 * 기린컴퍼니(gi-rin.com) 화면 위에 수집 패널을 띄워, 선택/페이지 전체/분류 전체/상세 상품을 모아
 * 이 수집기를 설치한 쇼핑몰의 관리자 화면(📥 수집함)으로만 보냅니다. 다른 가게로는 보낼 수 없습니다.
 * 이미 등록됐거나 수집함에 있는 상품은 "등록됨"으로 표시하고 다시 수집하지 않습니다.
 * 사진은 기린 서버 주소를 그대로 씁니다(우리 저장소 사용 안 함).
 * 사용: 즐겨찾기 버튼(관리자 > 수집함 > 수집기 설치)을 기린컴퍼니 페이지에서 누르기
 */
(function () {
  // 이 수집기를 내려준 쇼핑몰 = 보낼 곳 (후앤모아 관리자에서 설치 → 후앤모아로만)
  var me = document.currentScript && document.currentScript.src;
  var SHOP_URL = me ? new URL(me).origin : String(window.__girinCollectorTest || '').replace(/\/$/, '');
  if (!/^https:\/\//.test(SHOP_URL)) { alert('수집기를 쇼핑몰 관리자 화면의 즐겨찾기 버튼으로 실행해 주세요.'); return; }
  var NAMES = { 'hoo-and-moi.web.app': '후앤모아', 'moaruni-shop.web.app': '모아루니' };
  var HOST = new URL(SHOP_URL).hostname;
  var SHOP_NAME = NAMES[HOST] || (/^hoo-and-moi--/.test(HOST) ? '후앤모아(테스트)' : /^moaruni-shop--/.test(HOST) ? '모아루니(테스트)' : HOST);
  var KEY = HOST.replace(/[^a-z0-9]/gi, '_');
  var inst = window['__girinCollector_' + KEY];
  if (inst) { inst.toggle(); return; }

  var DELAY = 350; // 상세 페이지를 하나씩 천천히 읽기 (기린 서버 부담 줄이기)
  var picked = {}; // product_no → true
  var busy = false;
  // 이 쇼핑몰에 이미 등록됐거나 수집함에 있는 기린 상품 번호 (쇼핑몰과 연결할 때마다 새로 받음)
  var known = {};
  try { (JSON.parse(localStorage.getItem('girin_known_' + KEY) || '[]') || []).forEach(function (n) { known[n] = 1; }); } catch (e) {}
  function saveKnown() { try { localStorage.setItem('girin_known_' + KEY, JSON.stringify(Object.keys(known))); } catch (e) {} }
  // 담아 둔 상품: 수집할 때는 기린 쪽에만 모아 두고, [수집함으로 이동]을 누를 때 한 번에 보냄 (팝업 차단 없음)
  var pending = {};
  try { pending = JSON.parse(localStorage.getItem('girin_pending_' + KEY) || '{}') || {}; } catch (e) { pending = {}; }
  function savePending() { try { localStorage.setItem('girin_pending_' + KEY, JSON.stringify(pending)); return true; } catch (e) { return false; } }
  function pendingCount() { return Object.keys(pending).length; }
  // 쇼핑몰에 이미 등록된 상품 → 다시 수집 못 하게 막음 (수집함에만 있는 상품은 다시 수집 가능)
  var registered = {};
  try { (JSON.parse(localStorage.getItem('girin_reg_' + KEY) || '[]') || []).forEach(function (n) { registered[n] = 1; }); } catch (e) {}

  // ---------- 화면 ----------
  var css = document.createElement('style');
  css.textContent = [
    '#gcl{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:300px;background:#fff;border-radius:16px;box-shadow:0 10px 36px rgba(0,0,0,.28);font:13px/1.45 "Malgun Gothic",-apple-system,sans-serif;color:#222;overflow:hidden}',
    '#gcl .h{display:flex;align-items:center;justify-content:space-between;background:#2b2b2b;color:#fff;padding:10px 12px;font-weight:700}',
    '#gcl .h .x{cursor:pointer;padding:0 7px;opacity:.85}',
    '#gcl .b{padding:12px;display:flex;flex-direction:column;gap:8px}',
    '#gcl .to{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:#666}',
    '#gcl .cnt{background:#F06A7D;color:#fff;border-radius:999px;padding:1px 9px;font-weight:700;font-size:12px}',
    '#gcl .lbl{font-size:11px;color:#999;font-weight:700;margin-bottom:4px}',
    '#gcl button{width:100%;height:38px;border-radius:10px;border:1px solid #ddd;background:#fff;color:#222;font:700 13px "Malgun Gothic",-apple-system,sans-serif;cursor:pointer}',
    '#gcl button.p{background:#F06A7D;border-color:#F06A7D;color:#fff}',
    '#gcl button.d{background:#2b2b2b;border-color:#2b2b2b;color:#fff}',
    '#gcl button:disabled{opacity:.4;cursor:default}',
    '#gcl .row{display:grid;grid-template-columns:1fr 1fr;gap:6px}',
    '#gcl .sep{height:1px;background:#eee;margin:2px 0}',
    '#gcl .st{font-size:12px;color:#555;min-height:16px;white-space:pre-line}',
    '#gcl .bar{height:5px;background:#eee;border-radius:3px;overflow:hidden}#gcl .bar i{display:block;height:100%;width:0;background:#F06A7D;transition:width .2s}',
    '#gcl-frame{position:fixed;left:0;top:0;width:100%;height:100%;border:0;z-index:2147483640;background:#fff}',
    '#gcl.mini .b{display:none}',
    '#gcl-modal{position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483647;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px}',
    '#gcl-modal .c{background:#fff;border-radius:18px;width:100%;max-width:340px;padding:22px 18px 16px;text-align:center;font:14px/1.5 "Malgun Gothic",-apple-system,sans-serif;color:#222;box-shadow:0 12px 40px rgba(0,0,0,.3)}',
    '#gcl-modal .i{font-size:30px}',
    '#gcl-modal .t{font-size:17px;font-weight:800;margin:4px 0}',
    '#gcl-modal .s{font-size:13px;color:#777;margin-bottom:14px;white-space:pre-line}',
    '#gcl-modal button{display:block;width:100%;height:46px;margin-top:8px;border-radius:12px;border:1px solid #ddd;background:#fff;color:#333;font:700 15px "Malgun Gothic",-apple-system,sans-serif;cursor:pointer}',
    '#gcl-modal button.p{background:#F06A7D;border-color:#F06A7D;color:#fff}',
    '@media (max-width:600px){#gcl{left:8px;right:8px!important;bottom:8px;width:auto;font-size:14px}#gcl button{height:44px;font-size:14px}#gcl .b{max-height:55vh;overflow:auto}#gcl-modal{align-items:flex-end;padding:0}#gcl-modal .c{max-width:none;border-radius:20px 20px 0 0;padding-bottom:26px}}'
  ].join('\n');
  document.head.appendChild(css);
  var CARD_CSS = [
    '.gcl-chk{position:absolute;left:6px;top:6px;z-index:50;width:30px;height:30px;border-radius:8px;border:2px solid #fff;background:rgba(0,0,0,.35);box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;font:900 18px sans-serif}',
    '.gcl-chk.on{background:#F06A7D}',
    '.gcl-host{position:relative!important}',
    '.gcl-host.gcl-on{outline:3px solid #F06A7D;outline-offset:-3px}',
    '.gcl-chk.done{background:#2e7d32;cursor:default;width:auto;padding:0 8px;font:700 12px "Malgun Gothic"}',
    '.gcl-host.gcl-done img{opacity:.45}',
    '.gcl-chk.sold{background:#777;width:auto;padding:0 8px;font:700 12px "Malgun Gothic"}'
  ].join('\n');

  var box = document.createElement('div');
  box.id = 'gcl';
  if (document.querySelector('[id^="gcl"][data-shop]')) box.style.right = '330px'; // 다른 가게 수집기와 겹치지 않게
  box.setAttribute('data-shop', KEY);
  box.innerHTML =
    '<div class="h"><span>🛒 ' + SHOP_NAME + ' 상품 수집기</span><span><span class="x" data-a="mini">－</span><span class="x" data-a="close">✕</span></span></div>' +
    '<div class="b">' +
    '<div class="to"><span>보낼 곳: <b>' + SHOP_NAME + '</b> 수집함</span><span class="cnt">담은 0개</span></div>' +
    '<div data-sec="list"><div class="lbl">상품 고르기 (사진 왼쪽 위 ✓)</div><div class="row"><button data-a="pickall">전체 선택</button><button data-a="clear">선택 해제</button></div></div>' +
    '<button class="p" data-a="send-picked">✅ 선택한 0개 수집</button>' +
    '<button class="p" data-a="send-detail" style="display:none">📦 이 상품 수집</button>' +
    '<button data-a="send-cate">📚 이 분류 여러 페이지 수집</button>' +
    '<div class="sep"></div>' +
    '<button class="d" data-a="go">📤 ' + SHOP_NAME + ' 수집함으로 이동</button>' +
    '<div class="bar"><i></i></div><div class="st"></div>' +
    '</div>';
  document.body.appendChild(box);
  var $ = function (a) { return box.querySelector('[data-a="' + a + '"]'); };
  var st = box.querySelector('.st'), bar = box.querySelector('.bar i');
  function status(t, p) { st.textContent = t; if (p != null) bar.style.width = Math.round(p * 100) + '%'; }

  // 기린 화면은 수집기 안의 창(frame)에서 열림 → 분류·페이지·상세로 이동해도 패널이 그대로 남음
  var frame = document.getElementById('gcl-frame'); // 다른 가게 수집기가 이미 띄운 창이 있으면 같이 씀
  if (!frame) { frame = document.createElement('iframe'); frame.id = 'gcl-frame'; frame.src = location.href; document.body.appendChild(frame); }
  document.documentElement.style.overflow = 'hidden';
  var FD = null; // 창 안 기린 화면
  function D() { return FD || document; }
  function here() { try { return frame.contentWindow.location; } catch (e) { return location; } }
  var detailNo = null;
  function noFromLoc(l) { return (String(l.search).match(/product_no=(\d+)/) || String(l.pathname).match(/\/product\/[^/]+\/(\d+)\//) || [])[1] || null; }
  var frameObs = null;
  frame.addEventListener('load', function () {
    try { FD = frame.contentDocument; } catch (e) { FD = null; }
    if (!FD || !FD.body) return;
    var s = FD.createElement('style'); s.textContent = CARD_CSS; FD.head.appendChild(s);
    // 새 창이 아니라 이 창 안에서 열리게 (패널이 사라지지 않도록)
    FD.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[target="_top"], a[target="_parent"]');
      if (a) a.setAttribute('target', '_self');
    }, true);
    try { history.replaceState(null, '', here().href); document.title = FD.title; } catch (e) {}
    detailNo = noFromLoc(here());
    refreshDetail();
    var hasCards = cards().length > 0;
    box.querySelector('[data-sec="list"]').style.display = hasCards ? '' : 'none';
    $('send-picked').style.display = hasCards ? '' : 'none';
    $('send-cate').style.display = /cate_no=\d+/.test(here().search) ? '' : 'none';
    if (frameObs) frameObs.disconnect();
    var pend = 0;
    frameObs = new MutationObserver(function (muts) {
      if (pend) return;
      if (!muts.some(function (m) { return !(m.target.classList && m.target.classList.contains('gcl-host')); })) return;
      pend = setTimeout(function () { pend = 0; decorate(); }, 300);
    });
    frameObs.observe(FD.body, { childList: true, subtree: true });
    decorate();
    status(detailNo ? (registered[detailNo] ? '이미 등록한 상품입니다.' : '') : (hasCards ? '사진 왼쪽 위 ✓ 로 고르세요. 다른 페이지로 가도 고른 상품은 유지됩니다.' : '분류 목록이나 상품 화면으로 이동하세요.'));
  });

  // ---------- 목록 카드에 체크박스 ----------
  function cards(root) {
    var r = root || D();
    var pc = r.querySelectorAll('ul.prdList > li[id^="anchorBoxId_"]');
    if (pc.length) return Array.prototype.slice.call(pc);
    // 모바일 화면(m.gi-rin.com): 상품 목록 칸 안의 li
    return Array.prototype.slice.call(r.querySelectorAll('.xans-product-listnormal li.xans-record-, .xans-product-listmain li.xans-record-, .xans-product-listnew li.xans-record-'))
      .filter(function (li) { return li.querySelector('img') && noOf(li); });
  }
  function noOf(li) {
    var m = (li.id || '').match(/anchorBoxId_(\d+)/);
    if (m) return m[1];
    var a = li.querySelector('a[href*="product_no="], a[href*="/product/"]');
    var h = a ? a.getAttribute('href') || '' : '';
    return (h.match(/product_no=(\d+)/) || h.match(/\/product\/[^/]+\/(\d+)/) || [])[1];
  }
  // 기린이 품절 상품에 보여주는 품절 아이콘·버튼 (숨김 처리된 것은 제외)
  function visibleSoldout(root) {
    return Array.prototype.some.call(root.querySelectorAll('img[src*="soldout"], img[alt="품절"]'), function (img) {
      for (var p = img; p && p !== root.parentNode; p = p.parentNode) {
        if (p.classList && p.classList.contains('displaynone')) return false;
        if (p.style && p.style.display === 'none') return false;
      }
      return true;
    });
  }
  var soldCard = {};
  function refreshCount() {
    var n = Object.keys(picked).length, t = '✅ 선택한 ' + n + '개 수집', b = $('send-picked');
    if (b.textContent !== t) b.textContent = t;
    b.disabled = !n || busy;
    var m = pendingCount(), c = box.querySelector('.cnt'), g = $('go');
    c.textContent = '담은 ' + m + '개';
    g.textContent = '📤 수집함으로 이동' + (m ? ' (' + m + '개 보내기)' : '');
    g.disabled = busy;
  }
  function refreshDetail() {
    var d = $('send-detail');
    d.style.display = detailNo ? '' : 'none';
    if (!detailNo) return;
    d.textContent = registered[detailNo] ? '이미 등록한 상품입니다' : pending[detailNo] ? '이미 담은 상품입니다' : '📦 이 상품 수집';
    d.disabled = !!(registered[detailNo] || pending[detailNo]) || busy;
  }
  function decorate() {
    cards().forEach(function (li) {
      if (li.querySelector('.gcl-chk')) return;
      var no = noOf(li); if (!no) return;
      var host = li.querySelector('.thumbnail, .prdImg, .box') || li;
      host.classList.add('gcl-host');
      var c = D().createElement('div');
      c.className = 'gcl-chk'; c.textContent = '✓';
      c.onclick = function (e) {
        e.preventDefault(); e.stopPropagation();
        if (registered[no] || pending[no]) return;
        if (picked[no]) delete picked[no]; else picked[no] = true;
        paint(); refreshCount();
      };
      host.appendChild(c);
    });
    paint(); refreshCount();
  }
  function paint() {
    cards().forEach(function (li) {
      var no = noOf(li), held = !!pending[no] && !registered[no], done = !!registered[no] || held;
      if (soldCard[no] == null) soldCard[no] = visibleSoldout(li);
      if (done) delete picked[no];
      var on = !!picked[no];
      var c = li.querySelector('.gcl-chk');
      if (c) {
        c.classList.toggle('on', on); c.classList.toggle('done', done); c.classList.toggle('sold', !done && !on && soldCard[no]);
        var t = done ? (held ? '담음' : '등록됨') : (on ? '✓' : (soldCard[no] ? '품절' : '✓'));
        if (c.textContent !== t) c.textContent = t;
      }
      var h = li.querySelector('.gcl-host'); if (h) { h.classList.toggle('gcl-on', on); h.classList.toggle('gcl-done', done); }
    });
  }

  // ---------- 상세 페이지 읽기 ----------
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  function abs(u) {
    if (!u) return '';
    u = u.trim();
    if (u.indexOf('//') === 0) return 'https:' + u;
    if (u.indexOf('/') === 0) return location.origin + u;
    return u;
  }
  function won(n) { return Number(n).toLocaleString('ko-KR'); }
  function num(t) { var d = String(t || '').replace(/[^\d]/g, ''); return d ? parseInt(d, 10) : 0; }

  // "S~M" 같은 범위를 펼치기 (기존 HM매크로 규칙과 같음)
  var PRESETS = [
    ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'], ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'], ['JS', 'JM', 'JL', 'JXL'],
    ['S', 'M', 'L', 'XL', 'JS', 'JM', 'JL'], ['1세(80호)', '2세(90호)', '3세(100호)', '4세(110호)', '5세(120호)', '6세(130호)', '7세(140호)', '8세(150호)'],
    ['S(3개월)', 'M(6개월)', 'L(9개월)', 'XL(12개월)', 'XXL(18개월)'], ['1(XS)', '2(S)', '3(M)', '4(L)', '5(XL)', '6(XXL)'],
    ['3호', '5호', '7호', '9호', '11호', '13호', '15호', '17호', '19호'],
    ['120', '130', '140', '150', '160', '170', '180', '190', '200'], ['50', '60', '70', '80', '90', '100', '110', '120', '130', '140', '150']
  ];
  function expandSizes(line) {
    var t = line.replace(/[*\s]/g, '');
    var p = t.split(/[~\-](?![^()]*\))/);
    if (p.length === 2) {
      for (var i = 0; i < PRESETS.length; i++) {
        var n = PRESETS[i].map(function (x) { return x.replace(/\s/g, '').toUpperCase(); });
        var a = n.indexOf(p[0].toUpperCase()), b = n.indexOf(p[1].toUpperCase());
        if (a >= 0 && b > a) return PRESETS[i].slice(a, b + 1);
      }
    }
    return t.split(/[,/]/).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  function parseDetail(html, no) {
    var d = new DOMParser().parseFromString(html, 'text/html');
    var get = function (re) { var m = html.match(re); return m ? m[1] : ''; };
    // 이름·브랜드·문구 속 색상/사이즈: "나비KC 버드캡모자<그린/네이비>*S~M*"
    var rawName = get(/var\s+product_name\s*=\s*'((?:[^'\\]|\\.)*)'/).replace(/\\'/g, "'").replace(/<br\s*\/?>/gi, '\n');
    if (!rawName) { var h3 = d.querySelector('.infoArea h3'); rawName = h3 ? h3.innerText || h3.textContent : ''; }
    var lines = rawName.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    var first = (lines[0] || '').replace(/\(해외배송 가능상품\)/, '').trim();
    var brand = '', name = first;
    var sp = first.split(' ');
    if (sp.length > 1 && /KC$/i.test(sp[0])) { brand = sp[0].replace(/KC$/i, ''); name = sp.slice(1).join(' '); }
    name = name.replace(/<[^>]*>|\*[^*]*\*/g, '').trim();
    var textColors = [], textSizes = [];
    lines.slice(1).concat([first]).forEach(function (l) {
      var c = l.match(/<([^>]+)>/); if (c && !textColors.length) textColors = c[1].split(/[/,]/).map(function (x) { return x.trim(); }).filter(Boolean);
      var s = l.match(/\*([^*]+)\*/); if (s && !textSizes.length) textSizes = expandSizes(s[1]);
    });

    // 가격: 소비자가(손님 가격) · 판매가(우리 원가)
    var consumer = 0, cost = num(get(/var\s+product_price\s*=\s*'([^']*)'/));
    Array.prototype.forEach.call(d.querySelectorAll('.infoArea table tr, .xans-product-detaildesign tr'), function (tr) {
      var th = tr.querySelector('th'), td = tr.querySelector('td');
      if (!th || !td) return;
      var k = th.textContent.replace(/\s/g, '');
      if (k.indexOf('소비자가') >= 0) consumer = num(td.textContent);
      else if (k.indexOf('판매가') >= 0 && !cost) cost = num(td.textContent);
    });

    // 옵션: 선택칸 순서 + option_stock_data(조합별 가격·품절)
    var dims = Array.prototype.map.call(d.querySelectorAll('select[option_title], select[name^="option"]'), function (s) {
      return {
        title: s.getAttribute('option_title') || '',
        values: Array.prototype.map.call(s.options, function (o) { return { v: o.value, t: o.textContent.trim() }; })
          .filter(function (o) { return o.v && o.v !== '*' && o.v !== '**' && !/선택|---|필수/.test(o.t); })
      };
    }).filter(function (x) { return x.values.length; });
    var stock = {};
    try {
      var raw = get(/option_stock_data\s*=\s*'((?:[^'\\]|\\.)*)'/);
      if (raw) stock = JSON.parse(JSON.parse('"' + raw.replace(/"/g, '\\"') + '"'));
    } catch (e) { try { stock = JSON.parse(raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\')); } catch (e2) { stock = {}; } }
    var combos = Object.keys(stock).map(function (k) {
      var s = stock[k];
      return {
        vals: s.option_value_orginal || String(s.option_value || '').split('-'),
        extra: (Number(s.option_price) || cost) - cost,
        soldout: s.is_selling === 'F' || s.is_display === 'F' || (s.use_soldout === 'T' && s.use_stock && Number(s.stock_number) <= 0)
      };
    });
    // 값마다 추가금(가장 싼 조합 기준)·품절(모든 조합 품절일 때만)
    var dimOut = dims.map(function (dim, i) {
      return dim.values.map(function (o) {
        var mine = combos.filter(function (c) { return (c.vals[i] || '') === o.v; });
        var extra = 0, sold = false;
        if (mine.length) {
          extra = Math.min.apply(null, mine.map(function (c) { return c.extra; }));
          sold = mine.every(function (c) { return c.soldout; });
        }
        return { v: o.t.replace(/\s*\([+-]?[\d,]+원?\)\s*$/, '').trim(), extra: extra, sold: sold };
      });
    });
    // 두 옵션일 때: 사이즈 몫 = 조합 추가금 - 색상 몫
    if (dimOut.length === 2) {
      var a = dimOut[0], b = dimOut[1];
      b.forEach(function (bo, j) {
        var vals = combos.filter(function (c) { return c.vals[1] === dims[1].values[j].v; })
          .map(function (c) { var ai = dims[0].values.findIndex(function (x) { return x.v === c.vals[0]; }); return c.extra - (ai >= 0 ? a[ai].extra : 0); });
        if (vals.length) bo.extra = Math.max(0, Math.min.apply(null, vals));
      });
      // 색상 몫은 사이즈 추가금을 뺀 나머지
      a.forEach(function (ao, i) {
        var vals = combos.filter(function (c) { return c.vals[0] === dims[0].values[i].v; })
          .map(function (c) { var bi = dims[1].values.findIndex(function (x) { return x.v === c.vals[1]; }); return c.extra - (bi >= 0 ? b[bi].extra : 0); });
        if (vals.length) ao.extra = Math.max(0, Math.min.apply(null, vals));
      });
    }
    var fmt = function (o) { return o.v + (o.extra > 0 ? '(+' + o.extra + '원)' : '') + (o.sold ? '(품절)' : ''); };
    var colors = [], sizes = [];
    dims.forEach(function (dim, i) {
      var list = dimOut[i].map(fmt);
      if (/색|컬러|color/i.test(dim.title)) colors = colors.concat(list);
      else if (/사이즈|크기|size/i.test(dim.title)) sizes = sizes.concat(list);
      else if (!colors.length && i === 0 && dims.length > 1) colors = list;
      else sizes = sizes.concat(list);
    });
    if (!colors.length) colors = textColors;
    if (!sizes.length) sizes = textSizes;

    // 사진: 대표(600x600) + 상세 (버튼·아이콘 이미지는 제외)
    var big = d.querySelector('.BigImage, .bigImage');
    var main = abs((big && (big.getAttribute('src') || '')) || get(/var\s+product_image_tiny\s*=\s*'([^']*)'/));
    var detail = [];
    Array.prototype.forEach.call(d.querySelectorAll('#prdDetail img, .cont img'), function (img) {
      var u = abs(img.getAttribute('ec-data-src') || img.getAttribute('src') || '');
      if (!/^https?:/.test(u)) return;
      if (/\/(mono_design|_skin|common|button|btn_|icon|banner|delivery|review|notice|guide)/i.test(u)) return;
      if (detail.indexOf(u) < 0 && u !== main) detail.push(u);
    });
    // 품절 아이콘은 상품 정보 칸에서만 확인 (관련 상품 목록의 품절 아이콘에 속지 않게)
    var info = d.querySelector('.detailArea .infoArea') || d.querySelector('.infoArea') || d.querySelector('.detailArea');
    var mobileSold = !info && Array.prototype.some.call(d.querySelectorAll('.xans-product-detail img[src*="soldout"], .xans-product-detail img[alt="품절"]'), function (img) {
      return !img.closest('.displaynone, .xans-product-relation, .xans-product-listnormal, .xans-product-listmain');
    });
    var allSold = (combos.length > 0 && combos.every(function (c) { return c.soldout; })) || (info ? visibleSoldout(info) : mobileSold);

    return {
      source: 'girin', source_id: 'girin:' + no, source_url: location.origin + '/product/detail.html?product_no=' + no,
      brand: brand || '자체제작', name: name || first || ('기린 ' + no), raw_name: rawName.replace(/\n/g, ' '),
      consumer_price: consumer, cost_price: cost,
      colors: colors.join(', '), sizes: sizes.join(', '),
      main_image: main, sub_images: detail, soldout: allSold, collected_at: new Date().toISOString()
    };
  }

  function fetchDetail(no) {
    return fetch('/product/detail.html?product_no=' + no, { credentials: 'include' }).then(function (r) { return r.text(); })
      .then(function (html) { return parseDetail(html, no); });
  }

  // ---------- 분류 전체: 모든 페이지 목록 모으기 ----------
  // 페이지·분류 전체 수집은 품절 상품 제외 (하나씩 고르면 품절도 수집 가능)
  var lastSoldSkipped = 0;
  function listNos(doc) {
    var all = cards(doc), out = [];
    all.forEach(function (li) { var n = noOf(li); if (!n) return; if (visibleSoldout(li)) { soldCard[n] = true; lastSoldSkipped++; return; } out.push(n); });
    return out;
  }
  // 이 분류의 마지막 페이지 번호 (페이지 번호 줄에서 읽음)
  function lastPage() {
    var mx = 1;
    Array.prototype.forEach.call(D().querySelectorAll('a[href*="page="]'), function (a) { var m = (a.getAttribute('href') || '').match(/[?&]page=(\d+)/); if (m && +m[1] > mx) mx = +m[1]; });
    return mx;
  }
  var MAX_PAGES = 50; // 한 번에 최대 50페이지(약 1,000개) — 수집함이 넘치지 않도록
  async function allCategoryNos(from, count) {
    var cate = (here().search.match(/cate_no=(\d+)/) || [])[1];
    if (!cate) throw new Error('분류 목록 화면에서 눌러 주세요.');
    var nos = [], page = from, seen = {};
    lastSoldSkipped = 0;
    while (page < from + count) {
      status('목록 읽는 중… ' + page + '페이지 (' + (page - from + 1) + '/' + count + ', ' + nos.length + '개)');
      var html = await fetch('/product/list.html?cate_no=' + cate + '&page=' + page, { credentials: 'include' }).then(function (r) { return r.text(); });
      var pdoc = new DOMParser().parseFromString(html, 'text/html');
      // 상품 카드가 아예 없을 때만 끝 (품절만 있는 페이지도 다음 페이지는 계속 읽음)
      var all = cards(pdoc).map(noOf).filter(function (n) { return n && !seen[n]; });
      if (!all.length) break;
      all.forEach(function (n) { seen[n] = 1; });
      listNos(pdoc).forEach(function (n) { nos.push(n); });
      page++; await sleep(DELAY);
    }
    return nos;
  }

  // ---------- 안내창 (장바구니처럼: 수집함으로 이동 / 계속 수집) ----------
  function modal(icon, title, sub, buttons) {
    var old = document.getElementById('gcl-modal'); if (old) old.remove();
    var m = document.createElement('div'); m.id = 'gcl-modal';
    m.innerHTML = '<div class="c"><div class="i">' + icon + '</div><div class="t"></div><div class="s"></div></div>';
    m.querySelector('.t').textContent = title; m.querySelector('.s').textContent = sub || '';
    buttons.forEach(function (bt) {
      var el = document.createElement('button'); el.textContent = bt.label; if (bt.primary) el.className = 'p';
      el.onclick = function () { m.remove(); if (bt.fn) bt.fn(); };
      m.querySelector('.c').appendChild(el);
    });
    m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
    document.body.appendChild(m);
  }
  function askGo(title, sub) {
    modal('🛒', title, sub, [
      { label: SHOP_NAME + ' 수집함으로 이동', primary: true, fn: sendPending },
      { label: '계속 수집하기' }
    ]);
  }

  // ---------- 쇼핑몰 관리자 창으로 보내기 (이 수집기를 내려준 쇼핑몰만) ----------
  var target = null, ready = false, nonce = '', acked = 0, boxFull = false, rejected = 0;
  window.addEventListener('message', function (e) {
    if (e.origin !== SHOP_URL || !e.data) return;
    // 새로 연 관리자 화면(확인 번호가 같은 화면)의 대답만 믿음 — 새로고침 직전의 예전 화면은 무시
    if (e.data.type === 'hm-collector-ready' && e.data.nonce === nonce) {
      ready = true;
      if (Array.isArray(e.data.ids)) {
        known = {}; e.data.ids.forEach(function (id) { var n = String(id).replace(/^girin:/, ''); if (/^\d+$/.test(n)) known[n] = 1; });
        registered = {}; (e.data.reg || []).forEach(function (id) { registered[String(id).replace(/^girin:/, '')] = 1; });
        try { localStorage.setItem('girin_reg_' + KEY, JSON.stringify(Object.keys(registered))); } catch (er) {}
        saveKnown(); paint(); refreshCount(); refreshDetail();
      }
    }
    if (e.data.type === 'hm-collector-ack' && e.data.nonce === nonce) {
      acked += e.data.received || 0;
      if (e.data.full) boxFull = true;
      rejected += e.data.rejected || 0;
      if (Array.isArray(e.data.ids)) { e.data.ids.forEach(function (id) { known[String(id).replace(/^girin:/, '')] = 1; }); saveKnown(); paint(); }
    }
  });
  // 쇼핑몰 창은 [수집함으로 이동]을 누른 바로 그때만 엶 → 브라우저 팝업 차단에 안 걸림
  async function openTarget() {
    ready = false; acked = 0; boxFull = false; rejected = 0;
    nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
    target = window.open(SHOP_URL + '/?collect=1&cn=' + nonce, 'hm-collector-' + KEY);
    if (!target) throw new Error('쇼핑몰 창을 열지 못했습니다. 다시 한 번 눌러 주세요.');
    for (var i = 0; i < 120 && !ready; i++) {
      try { target.postMessage({ type: 'hm-collector-ping', nonce: nonce }, SHOP_URL); } catch (e) {}
      await sleep(500);
    }
    if (!ready) throw new Error(SHOP_NAME + ' 관리자 창이 응답하지 않습니다. 그 창에서 관리자 로그인 후 다시 [수집함으로 이동]을 눌러 주세요. (담은 상품은 그대로 있어요)');
  }

  function setBusy(v) {
    busy = v;
    Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) { b.disabled = v; });
    if (!v) { refreshCount(); refreshDetail(); }
  }

  // 담은 상품을 쇼핑몰 수집함으로 보냄
  async function sendPending() {
    if (busy) return;
    var ids = Object.keys(pending);
    setBusy(true);
    try {
      status(SHOP_NAME + ' 수집함 여는 중…', 0);
      await openTarget();
      if (!ids.length) { status(SHOP_NAME + ' 수집함을 열었습니다.', 1); return; }
      // 이미 등록했거나 이미 수집함에 있는 상품은 빼고 보냄
      var reg = ids.filter(function (n) { return registered[n]; });
      var inbox = ids.filter(function (n) { return known[n] && !registered[n]; });
      var send = ids.filter(function (n) { return !known[n]; });
      var sent = 0;
      for (var i = 0; i < send.length; i += 20) {
        var chunk = send.slice(i, i + 20).map(function (n) { return pending[n]; });
        sent += chunk.length;
        target.postMessage({ type: 'hm-collector-items', nonce: nonce, items: chunk }, SHOP_URL);
        status('보내는 중… ' + Math.min(i + 20, send.length) + ' / ' + send.length, Math.min(i + 20, send.length) / send.length);
      }
      for (var w = 0; w < 20 && acked < sent && !boxFull; w++) await sleep(500);
      if (boxFull) throw new Error(SHOP_NAME + ' 수집함이 가득 찼습니다. 수집함의 상품을 먼저 등록하거나 지운 뒤 다시 보내 주세요. (담은 상품은 그대로 있어요)');
      if (acked < sent) throw new Error('보낸 ' + sent + '개 중 ' + acked + '개만 도착했습니다. 쇼핑몰 창을 닫지 말고 다시 [수집함으로 이동]을 눌러 주세요.');
      ids.forEach(function (n) { delete pending[n]; }); savePending(); paint();
      status('✅ ' + (sent - rejected) + '개를 ' + SHOP_NAME + ' 수집함에 보냈습니다.' +
        (reg.length ? '\n↪ 이미 등록한 상품 ' + reg.length + '개는 뺐어요.' : '') +
        (inbox.length ? '\n↪ 이미 수집함에 있는 ' + inbox.length + '개는 뺐어요.' : '') +
        (rejected ? '\n⚠️ 대표 사진·이름이 없어 ' + rejected + '개는 빠졌어요.' : ''), 1);
    } catch (e) {
      status('⚠️ ' + e.message, 0);
    } finally { setBusy(false); }
  }

  // 상품을 읽어서 담기 (쇼핑몰 창은 열지 않음)
  async function collect(nos) {
    if (busy || !nos.length) return;
    var reg = nos.filter(function (n) { return registered[n]; });
    var held = nos.filter(function (n) { return !registered[n] && pending[n]; });
    nos = nos.filter(function (n) { return !registered[n] && !pending[n]; });
    if (!nos.length) {
      picked = {}; paint(); refreshCount();
      return askGo(reg.length ? '이미 등록한 상품입니다' : '이미 담은 상품입니다',
        (reg.length ? '이미 ' + SHOP_NAME + '에 등록한 상품 ' + reg.length + '개' : '') + (held.length ? (reg.length ? '\n' : '') + '이미 담아 둔 상품 ' + held.length + '개' : '') + '\n담은 상품 ' + pendingCount() + '개');
    }
    setBusy(true);
    var got = 0, fails = [];
    try {
      for (var i = 0; i < nos.length; i++) {
        status('상품 읽는 중… ' + (i + 1) + ' / ' + nos.length, i / nos.length);
        try { var it = await fetchDetail(nos[i]); pending[nos[i]] = it; got++; } catch (e) { fails.push(nos[i]); }
        if (i % 10 === 9) savePending();
        await sleep(DELAY);
      }
      if (!savePending()) throw new Error('담을 공간이 가득 찼습니다. [수집함으로 이동]으로 먼저 보내 주세요.');
      picked = {}; paint();
      status('', 1);
      askGo(got + '개를 수집했어요',
        '담은 상품 모두 ' + pendingCount() + '개' +
        (reg.length ? '\n이미 등록한 상품 ' + reg.length + '개는 뺐어요' : '') +
        (held.length ? '\n이미 담은 상품 ' + held.length + '개는 뺐어요' : '') +
        (fails.length ? '\n⚠️ 읽지 못한 상품 ' + fails.length + '개' : ''));
    } catch (e) {
      status('⚠️ ' + e.message, 0);
    } finally { setBusy(false); }
  }

  box.addEventListener('click', function (e) {
    var a = e.target.getAttribute && e.target.getAttribute('data-a');
    if (!a) return;
    if (a === 'mini') { var m = box.classList.toggle('mini'); $('mini').textContent = m ? '＋' : '－'; return; }
    if (a === 'close') { if (confirm('수집기를 끌까요? (담은 상품은 그대로 남아요)')) location.href = here().href; return; }
    if (a === 'pickall') { lastSoldSkipped = 0; listNos(D()).forEach(function (n) { if (!registered[n] && !pending[n]) picked[n] = true; }); paint(); refreshCount(); status(lastSoldSkipped ? '품절 ' + lastSoldSkipped + '개는 빼고 골랐습니다. (필요하면 하나씩 ✓)' : ''); }
    if (a === 'clear') { picked = {}; paint(); refreshCount(); status(''); }
    if (a === 'send-picked') collect(Object.keys(picked));
    if (a === 'send-detail' && detailNo) collect([detailNo]);
    if (a === 'go') sendPending();
    if (a === 'send-cate') {
      var cur = +((here().search.match(/[?&]page=(\d+)/) || [])[1] || 1), lp = lastPage(), last = Math.max(lp, cur);
      // 모바일 화면은 페이지 번호 대신 [더보기]라 끝을 모름 → 빈 페이지가 나올 때까지 읽음
      var noPaging = lp <= 1 && cur === 1;
      var left = noPaging ? MAX_PAGES : last - cur + 1;
      var per = Math.max(cards().length, 10);
      var ans = prompt((noPaging ? '' : '이 분류는 모두 ' + last + '페이지입니다 (한 페이지 약 ' + per + '개).\n') + '지금 보는 ' + cur + '페이지부터 몇 페이지를 수집할까요?' + (noPaging ? ' (한 페이지 약 ' + per + '개)' : '') + '\n(한 번에 최대 ' + MAX_PAGES + '페이지)', String(Math.min(left, 5)));
      if (ans === null) return;
      var cnt = Math.min(parseInt(ans, 10) || 0, left, MAX_PAGES);
      if (cnt < 1) return status('⚠️ 페이지 수를 숫자로 적어 주세요.');
      setBusy(true);
      allCategoryNos(cur, cnt).then(function (nos) {
        setBusy(false);
        if (!nos.length) return status(lastSoldSkipped ? cur + '~' + (cur + cnt - 1) + '페이지 상품 ' + lastSoldSkipped + '개가 모두 품절이라 수집할 상품이 없습니다.' : '⚠️ 이 분류에서 상품을 찾지 못했습니다.');
        var fresh = nos.filter(function (n) { return !registered[n] && !pending[n]; });
        if (!fresh.length) return collect(nos);
        if (confirm(cur + '~' + (cur + cnt - 1) + '페이지 새 상품 ' + fresh.length + '개를 수집할까요?' + (nos.length > fresh.length ? ' (이미 등록·담은 ' + (nos.length - fresh.length) + '개 제외)' : '') + (lastSoldSkipped ? ' (품절 ' + lastSoldSkipped + '개 제외)' : '') + ' (약 ' + Math.ceil(fresh.length * (DELAY + 400) / 60000) + '분)')) collect(nos);
        else status('취소했습니다.');
      }).catch(function (e2) { setBusy(false); status('⚠️ ' + e2.message); });
    }
  });

  var api = window['__girinCollector_' + KEY] = {
    toggle: function () { box.style.display = box.style.display === 'none' ? '' : 'none'; },
    parseDetail: parseDetail, fetchDetail: fetchDetail
  };
  window.__girinCollector = api; // 시험용
  refreshCount();
  status('기린 화면 불러오는 중…');
})();
