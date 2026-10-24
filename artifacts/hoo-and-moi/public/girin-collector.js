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

  // ---------- 화면 ----------
  var css = document.createElement('style');
  css.textContent = [
    '#gcl{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:300px;background:#fff;border:2px solid #333;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.25);font:13px/1.45 "Malgun Gothic",sans-serif;color:#222}',
    '#gcl .h{display:flex;align-items:center;justify-content:space-between;background:#333;color:#fff;padding:9px 12px;border-radius:11px 11px 0 0;font-weight:700}',
    '#gcl .b{padding:10px 12px;display:flex;flex-direction:column;gap:7px}',
    '#gcl button{height:34px;border-radius:8px;border:1px solid #ccc;background:#fff;font:700 13px "Malgun Gothic";cursor:pointer}',
    '#gcl button.p{background:#F06A7D;border-color:#F06A7D;color:#fff}',
    '#gcl button:disabled{opacity:.45;cursor:default}',
    '#gcl select{height:32px;border-radius:8px;border:1px solid #ccc;font:13px "Malgun Gothic";padding:0 6px}',
    '#gcl .row{display:grid;grid-template-columns:1fr 1fr;gap:6px}',
    '#gcl .st{font-size:12px;color:#555;min-height:18px;white-space:pre-line}',
    '#gcl .bar{height:6px;background:#eee;border-radius:3px;overflow:hidden}#gcl .bar i{display:block;height:100%;width:0;background:#F06A7D;transition:width .2s}',
    '#gcl-frame{position:fixed;left:0;top:0;width:100%;height:100%;border:0;z-index:2147483640;background:#fff}'
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
    '<div class="h"><span>🛒 ' + SHOP_NAME + ' 상품 수집기</span><span style="cursor:pointer" data-a="close">✕</span></div>' +
    '<div class="b">' +
    '<div style="font-size:12px;color:#555">보내는 곳: <b>' + SHOP_NAME + '</b> 관리자 › 📥 수집함</div>' +
    '<button data-a="sync">🔄 이미 등록된 상품 확인</button>' +
    '<div class="row"><button data-a="pickall">이 페이지 전체 선택</button><button data-a="clear">선택 해제</button></div>' +
    '<button class="p" data-a="send-picked">✅ 선택한 0개 수집</button>' +
    '<button data-a="send-page">이 페이지 전체 수집</button>' +
    '<button data-a="send-cate">이 분류 여러 페이지 수집</button>' +
    '<button data-a="send-detail" style="display:none">이 상품 수집</button>' +
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
    $('send-detail').style.display = detailNo ? '' : 'none';
    $('send-detail').textContent = detailNo ? (known[detailNo] ? '이 상품은 이미 등록됨' : '📦 이 상품 수집') : '이 상품 수집';
    $('send-detail').disabled = !!(detailNo && known[detailNo]);
    var hasCards = cards().length > 0;
    ['pickall', 'clear', 'send-page'].forEach(function (k) { $(k).style.display = hasCards ? '' : 'none'; });
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
    status(detailNo ? (known[detailNo] ? '이 상품은 이미 ' + SHOP_NAME + '에 있습니다.' : '[📦 이 상품 수집]을 누르면 수집함으로 보냅니다.') : (hasCards ? '사진 왼쪽 위 ✓ 로 고르세요. 다른 페이지로 가도 고른 상품은 유지됩니다.' : '분류 목록이나 상품 상세 화면으로 이동하세요.'));
  });

  // ---------- 목록 카드에 체크박스 ----------
  function cards(root) {
    return Array.prototype.slice.call((root || D()).querySelectorAll('ul.prdList > li[id^="anchorBoxId_"]'));
  }
  function noOf(li) { return (li.id.match(/anchorBoxId_(\d+)/) || [])[1]; }
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
        if (known[no]) return;
        if (picked[no]) delete picked[no]; else picked[no] = true;
        paint(); refreshCount();
      };
      host.appendChild(c);
    });
    paint(); refreshCount();
  }
  function paint() {
    cards().forEach(function (li) {
      var no = noOf(li), done = !!known[no];
      if (soldCard[no] == null) soldCard[no] = visibleSoldout(li);
      if (done) delete picked[no];
      var on = !!picked[no];
      var c = li.querySelector('.gcl-chk');
      if (c) {
        c.classList.toggle('on', on); c.classList.toggle('done', done); c.classList.toggle('sold', !done && !on && soldCard[no]);
        var t = done ? '등록됨' : (on ? '✓' : (soldCard[no] ? '품절' : '✓'));
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
    var rawName = get(/var\s+product_name\s*=\s*'([^']*)'/).replace(/<br\s*\/?>/gi, '\n');
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
      var raw = get(/option_stock_data\s*=\s*'([^']*)'/);
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
    var big = d.querySelector('.BigImage');
    var main = abs((big && (big.getAttribute('src') || '')) || get(/var\s+product_image_tiny\s*=\s*'([^']*)'/));
    var detail = [];
    Array.prototype.forEach.call(d.querySelectorAll('#prdDetail img, .cont img'), function (img) {
      var u = abs(img.getAttribute('ec-data-src') || img.getAttribute('src') || '');
      if (!/^https?:/.test(u)) return;
      if (/\/(mono_design|_skin|common|button|btn_|icon|banner|delivery|review|notice|guide)/i.test(u)) return;
      if (detail.indexOf(u) < 0 && u !== main) detail.push(u);
    });
    var info = d.querySelector('.detailArea') || d.body;
    var allSold = (combos.length > 0 && combos.every(function (c) { return c.soldout; })) || visibleSoldout(info);

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

  // ---------- 쇼핑몰 관리자 창으로 보내기 (이 수집기를 내려준 쇼핑몰만) ----------
  var target = null, ready = false, nonce = '', acked = 0;
  var shop = { name: SHOP_NAME, url: SHOP_URL };
  window.addEventListener('message', function (e) {
    if (e.origin !== SHOP_URL || !e.data) return;
    // 새로 연 관리자 화면(확인 번호가 같은 화면)의 대답만 믿음 — 새로고침 직전의 예전 화면은 무시
    if (e.data.type === 'hm-collector-ready' && e.data.nonce === nonce) {
      ready = true;
      if (Array.isArray(e.data.ids)) { known = {}; e.data.ids.forEach(function (id) { var n = String(id).replace(/^girin:/, ''); if (/^\d+$/.test(n)) known[n] = 1; }); saveKnown(); paint(); refreshCount();
        // 쇼핑몰에서 지운 상품은 다시 수집할 수 있게 버튼을 되살림
        if (detailNo) { $('send-detail').textContent = known[detailNo] ? '이 상품은 이미 등록됨' : '📦 이 상품 수집'; $('send-detail').disabled = !!known[detailNo]; } }
    }
    if (e.data.type === 'hm-collector-ack' && e.data.nonce === nonce) {
      acked += e.data.received || 0;
      if (Array.isArray(e.data.ids)) { e.data.ids.forEach(function (id) { known[String(id).replace(/^girin:/, '')] = 1; }); saveKnown(); paint(); }
    }
  });
  // 쇼핑몰 관리자 창은 버튼을 누른 순간 바로 열어야 브라우저가 막지 않음
  async function openTarget() {
    ready = false; acked = 0;
    nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
    target = window.open(SHOP_URL + '/?collect=1&cn=' + nonce, 'hm-collector-' + KEY);
    if (!target) throw new Error('팝업이 막혔습니다. 주소창 오른쪽의 팝업 차단 아이콘에서 gi-rin.com 팝업을 허용해 주세요.');
    for (var i = 0; i < 120 && !ready; i++) {
      try { target.postMessage({ type: 'hm-collector-ping', nonce: nonce }, SHOP_URL); } catch (e) {}
      await sleep(500);
    }
    if (!ready) throw new Error(SHOP_NAME + ' 관리자 창이 응답하지 않습니다. 그 창에서 관리자 로그인 후 다시 눌러 주세요.');
    return shop;
  }

  async function collect(nos, label, opened) {
    if (busy || !nos.length) return;
    busy = true; refreshCount();
    Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) { b.disabled = true; });
    var items = [], fails = [], skipped = 0, sent = 0;
    try {
      await (opened || openTarget());
      // 연결하면서 받은 "이미 등록·수집된 상품"은 빼고 읽기
      var before = nos.length;
      nos = nos.filter(function (n) { return !known[n]; });
      skipped = before - nos.length;
      if (!nos.length) { status('이미 모두 등록(또는 수집함에 있는) 상품입니다. 건너뛴 상품 ' + skipped + '개', 1); return; }
      for (var i = 0; i < nos.length; i++) {
        status(label + ' ' + (i + 1) + ' / ' + nos.length + ' 읽는 중…', i / nos.length);
        try { items.push(await fetchDetail(nos[i])); } catch (e) { fails.push(nos[i]); }
        if (items.length >= 20 || i === nos.length - 1) {
          if (items.length) { sent += items.length; target.postMessage({ type: 'hm-collector-items', nonce: nonce, items: items }, shop.url); }
          items = [];
        }
        await sleep(DELAY);
      }
      // 쇼핑몰이 받았다고 확인한 수 기다리기 (최대 10초)
      for (var w = 0; w < 20 && acked < sent; w++) await sleep(500);
      if (acked < sent) throw new Error('보낸 ' + sent + '개 중 ' + acked + '개만 수집함에 도착했습니다. 쇼핑몰 창을 닫지 말고 다시 눌러 주세요.');
      status('✅ ' + acked + '개가 ' + SHOP_NAME + ' 수집함에 도착했습니다.' + (skipped ? '\n↪ 이미 등록·수집된 ' + skipped + '개는 건너뜀' : '') + (fails.length ? '\n⚠️ 실패 ' + fails.length + '개: ' + fails.slice(0, 5).join(', ') : '') + '\n쇼핑몰 창 › 관리자 › 📥 수집함에서 확인 후 등록하세요.', 1);
      picked = {}; paint();
      if (detailNo) { $('send-detail').textContent = '이 상품은 이미 등록됨'; }
    } catch (e) {
      status('⚠️ ' + e.message, 0);
    } finally {
      busy = false;
      Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) { b.disabled = false; });
      refreshCount();
    }
  }

  box.addEventListener('click', function (e) {
    var a = e.target.getAttribute && e.target.getAttribute('data-a');
    if (!a) return;
    if (a === 'close') { if (confirm('수집기를 끌까요? (지금 보던 기린 화면으로 돌아갑니다)')) location.href = here().href; return; }
    if (a === 'pickall') { lastSoldSkipped = 0; listNos(D()).forEach(function (n) { if (!known[n]) picked[n] = true; }); paint(); refreshCount(); if (lastSoldSkipped) status('품절 ' + lastSoldSkipped + '개는 빼고 골랐습니다. (필요하면 하나씩 ✓)'); }
    if (a === 'sync') { openTarget().then(function () { status('🔄 ' + SHOP_NAME + '에 이미 있는 기린 상품 ' + Object.keys(known).length + '개를 "등록됨"으로 표시했습니다.'); }).catch(function (e3) { status('⚠️ ' + e3.message); }); }
    if (a === 'clear') { picked = {}; paint(); refreshCount(); }
    if (a === 'send-picked') collect(Object.keys(picked), '선택');
    if (a === 'send-page') { lastSoldSkipped = 0; var pn = listNos(D()); collect(pn, '이 페이지' + (lastSoldSkipped ? '(품절 ' + lastSoldSkipped + '개 제외)' : '')); }
    if (a === 'send-detail' && detailNo) collect([detailNo], '이 상품');
    if (a === 'send-cate') {
      var cur = +((here().search.match(/[?&]page=(\d+)/) || [])[1] || 1), last = Math.max(lastPage(), cur);
      var left = last - cur + 1;
      var ans = prompt('이 분류는 모두 ' + last + '페이지입니다 (한 페이지 약 21개).\n지금 보는 ' + cur + '페이지부터 몇 페이지를 수집할까요?\n(한 번에 최대 ' + MAX_PAGES + '페이지)', String(Math.min(left, 5)));
      if (ans === null) return;
      var cnt = Math.min(parseInt(ans, 10) || 0, left, MAX_PAGES);
      if (cnt < 1) return status('⚠️ 페이지 수를 숫자로 적어 주세요.');
      var opened = openTarget();
      opened.catch(function () {});
      allCategoryNos(cur, cnt).then(function (nos) {
        if (!nos.length) return status(lastSoldSkipped ? cur + '~' + (cur + cnt - 1) + '페이지 상품 ' + lastSoldSkipped + '개가 모두 품절이라 수집할 상품이 없습니다.' : '⚠️ 이 분류에서 상품을 찾지 못했습니다.');
        // 페이지를 읽는 동안 쇼핑몰에서 받아 둔 "이미 등록됨" 목록으로 미리 빼고 물어봄
        var fresh = nos.filter(function (n) { return !known[n]; });
        if (!fresh.length) return status('이미 모두 등록(또는 수집함에 있는) 상품입니다. 건너뛴 상품 ' + nos.length + '개');
        if (confirm(cur + '~' + (cur + cnt - 1) + '페이지 새 상품 ' + fresh.length + '개를 수집할까요?' + (nos.length > fresh.length ? ' (이미 있는 ' + (nos.length - fresh.length) + '개 제외)' : '') + (lastSoldSkipped ? ' (품절 ' + lastSoldSkipped + '개 제외)' : '') + ' (약 ' + Math.ceil(fresh.length * (DELAY + 400) / 60000) + '분)')) collect(nos, '분류 ' + cur + '~' + (cur + cnt - 1) + '페이지', opened);
        else status('취소했습니다.');
      }).catch(function (e2) { status('⚠️ ' + e2.message); });
    }
  });

  var api = window['__girinCollector_' + KEY] = {
    toggle: function () { box.style.display = box.style.display === 'none' ? '' : 'none'; },
    parseDetail: parseDetail, fetchDetail: fetchDetail
  };
  window.__girinCollector = api; // 시험용
  status('기린 화면 불러오는 중…' + (Object.keys(known).length ? '' : '\n처음이면 [🔄 이미 등록된 상품 확인]을 먼저 눌러 주세요.'));
})();
