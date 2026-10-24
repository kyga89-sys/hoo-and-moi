/* 🛒 기린컴퍼니 상품 수집기 — 후앤모아·모아루니 공용
 * 기린컴퍼니(gi-rin.com) 화면 위에 수집 패널을 띄워, 선택/페이지 전체/분류 전체/상세 상품을 모아
 * 고른 쇼핑몰의 관리자 화면(📥 수집함)으로 보냅니다. 사진은 기린 서버 주소를 그대로 씁니다(우리 저장소 사용 안 함).
 * 사용: 즐겨찾기 버튼(관리자 > 수집함 > 수집기 설치)을 기린컴퍼니 페이지에서 누르기
 */
(function () {
  if (window.__girinCollector) { window.__girinCollector.toggle(); return; }

  var SHOPS = [
    { key: 'hoo', name: '후앤모아', url: 'https://hoo-and-moi.web.app' },
    { key: 'moaruni', name: '모아루니', url: 'https://moaruni-shop.web.app' }
  ];
  var DELAY = 350; // 상세 페이지를 하나씩 천천히 읽기 (기린 서버 부담 줄이기)
  var picked = {}; // product_no → true
  var shopKey = localStorage.getItem('girin_collector_shop') || 'hoo';
  var busy = false;

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
    '.gcl-chk{position:absolute;left:6px;top:6px;z-index:50;width:30px;height:30px;border-radius:8px;border:2px solid #fff;background:rgba(0,0,0,.35);box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;font:900 18px sans-serif}',
    '.gcl-chk.on{background:#F06A7D}',
    '.gcl-host{position:relative!important}',
    '.gcl-host.gcl-on{outline:3px solid #F06A7D;outline-offset:-3px}'
  ].join('\n');
  document.head.appendChild(css);

  var box = document.createElement('div');
  box.id = 'gcl';
  box.innerHTML =
    '<div class="h"><span>🛒 상품 수집기</span><span style="cursor:pointer" data-a="close">✕</span></div>' +
    '<div class="b">' +
    '<label style="display:flex;align-items:center;gap:6px">보낼 쇼핑몰 <select data-a="shop"></select></label>' +
    '<div class="row"><button data-a="pickall">이 페이지 전체 선택</button><button data-a="clear">선택 해제</button></div>' +
    '<button class="p" data-a="send-picked">✅ 선택한 0개 수집</button>' +
    '<button data-a="send-page">이 페이지 전체 수집</button>' +
    '<button data-a="send-cate">이 분류 전체 수집 (모든 페이지)</button>' +
    '<button data-a="send-detail" style="display:none">이 상품 수집</button>' +
    '<div class="bar"><i></i></div><div class="st"></div>' +
    '</div>';
  document.body.appendChild(box);
  var $ = function (a) { return box.querySelector('[data-a="' + a + '"]'); };
  var sel = $('shop');
  SHOPS.forEach(function (s) { var o = document.createElement('option'); o.value = s.key; o.textContent = s.name; sel.appendChild(o); });
  sel.value = shopKey;
  sel.onchange = function () { shopKey = sel.value; localStorage.setItem('girin_collector_shop', shopKey); };
  var st = box.querySelector('.st'), bar = box.querySelector('.bar i');
  function status(t, p) { st.textContent = t; if (p != null) bar.style.width = Math.round(p * 100) + '%'; }

  var detailNo = (location.search.match(/product_no=(\d+)/) || location.pathname.match(/\/product\/[^/]+\/(\d+)\//) || [])[1];
  if (detailNo) $('send-detail').style.display = '';

  // ---------- 목록 카드에 체크박스 ----------
  function cards(root) {
    return Array.prototype.slice.call((root || document).querySelectorAll('ul.prdList > li[id^="anchorBoxId_"]'));
  }
  function noOf(li) { return (li.id.match(/anchorBoxId_(\d+)/) || [])[1]; }
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
      var c = document.createElement('div');
      c.className = 'gcl-chk'; c.textContent = '✓';
      c.onclick = function (e) {
        e.preventDefault(); e.stopPropagation();
        if (picked[no]) delete picked[no]; else picked[no] = true;
        paint(); refreshCount();
      };
      host.appendChild(c);
    });
    paint(); refreshCount();
  }
  function paint() {
    cards().forEach(function (li) {
      var on = !!picked[noOf(li)];
      var c = li.querySelector('.gcl-chk'); if (c) c.classList.toggle('on', on);
      var h = li.querySelector('.gcl-host'); if (h) h.classList.toggle('gcl-on', on);
    });
  }
  decorate();
  // 상품 목록이 새로 그려질 때만 체크박스 다시 달기 (수집기 자신의 변화는 무시, 0.3초 모아서 한 번)
  var pend = 0;
  new MutationObserver(function (muts) {
    if (pend) return;
    if (!muts.some(function (m) { return !box.contains(m.target) && !(m.target.classList && m.target.classList.contains('gcl-host')); })) return;
    pend = setTimeout(function () { pend = 0; decorate(); }, 300);
  }).observe(document.body, { childList: true, subtree: true });

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
    var fmt = function (o) { return o.v + (o.extra > 0 ? '(+' + won(o.extra) + '원)' : '') + (o.sold ? '(품절)' : ''); };
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
    var allSold = combos.length > 0 && combos.every(function (c) { return c.soldout; });

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
  function listNos(doc) { return cards(doc).map(noOf).filter(Boolean); }
  async function allCategoryNos() {
    var cate = (location.search.match(/cate_no=(\d+)/) || [])[1];
    if (!cate) throw new Error('분류 목록 화면에서 눌러 주세요.');
    var nos = [], page = 1, seen = {};
    while (page < 200) {
      status('목록 읽는 중… ' + page + '페이지 (' + nos.length + '개)');
      var html = await fetch('/product/list.html?cate_no=' + cate + '&page=' + page, { credentials: 'include' }).then(function (r) { return r.text(); });
      var got = listNos(new DOMParser().parseFromString(html, 'text/html')).filter(function (n) { return !seen[n]; });
      if (!got.length) break;
      got.forEach(function (n) { seen[n] = 1; nos.push(n); });
      page++; await sleep(DELAY);
    }
    return nos;
  }

  // ---------- 쇼핑몰 관리자 창으로 보내기 ----------
  var target = null, ready = false, acked = 0;
  window.addEventListener('message', function (e) {
    var shop = SHOPS.filter(function (s) { return s.key === shopKey; })[0];
    if (!shop || e.origin !== shop.url) return;
    if (e.data && e.data.type === 'hm-collector-ready') ready = true;
    if (e.data && e.data.type === 'hm-collector-ack') acked += e.data.count || 0;
  });
  async function openTarget() {
    var shop = SHOPS.filter(function (s) { return s.key === shopKey; })[0];
    ready = false;
    target = window.open(shop.url + '/?collect=1', 'hm-collector-' + shop.key);
    for (var i = 0; i < 120 && !ready; i++) {
      try { target.postMessage({ type: 'hm-collector-ping' }, shop.url); } catch (e) {}
      await sleep(500);
    }
    if (!ready) throw new Error(shop.name + ' 관리자 창이 응답하지 않습니다. 그 창에서 관리자 로그인 후 다시 눌러 주세요.');
    return shop;
  }

  async function collect(nos, label) {
    if (busy || !nos.length) return;
    busy = true; refreshCount();
    Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) { b.disabled = true; });
    var shop, items = [], fails = [];
    try {
      shop = await openTarget();
      for (var i = 0; i < nos.length; i++) {
        status(label + ' ' + (i + 1) + ' / ' + nos.length + ' 읽는 중…', i / nos.length);
        try { items.push(await fetchDetail(nos[i])); } catch (e) { fails.push(nos[i]); }
        if (items.length >= 20 || i === nos.length - 1) {
          if (items.length) target.postMessage({ type: 'hm-collector-items', items: items }, shop.url);
          items = [];
        }
        await sleep(DELAY);
      }
      status('✅ ' + (nos.length - fails.length) + '개를 ' + shop.name + ' 수집함으로 보냈습니다.' + (fails.length ? '\n⚠️ 실패 ' + fails.length + '개: ' + fails.slice(0, 5).join(', ') : '') + '\n쇼핑몰 창 › 관리자 › 📥 수집함에서 확인 후 등록하세요.', 1);
      picked = {}; paint();
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
    if (a === 'close') return api.toggle();
    if (a === 'pickall') { cards().forEach(function (li) { var n = noOf(li); if (n) picked[n] = true; }); paint(); refreshCount(); }
    if (a === 'clear') { picked = {}; paint(); refreshCount(); }
    if (a === 'send-picked') collect(Object.keys(picked), '선택');
    if (a === 'send-page') collect(listNos(document), '이 페이지');
    if (a === 'send-detail' && detailNo) collect([detailNo], '이 상품');
    if (a === 'send-cate') {
      allCategoryNos().then(function (nos) {
        if (!nos.length) return status('⚠️ 이 분류에서 상품을 찾지 못했습니다.');
        if (confirm('이 분류의 상품 ' + nos.length + '개를 모두 수집할까요? (약 ' + Math.ceil(nos.length * DELAY / 60000 + nos.length * 0.4 / 60) + '분)')) collect(nos, '분류 전체');
        else status('취소했습니다.');
      }).catch(function (e2) { status('⚠️ ' + e2.message); });
    }
  });

  var api = window.__girinCollector = {
    toggle: function () { var on = box.style.display !== 'none'; box.style.display = on ? 'none' : ''; Array.prototype.forEach.call(document.querySelectorAll('.gcl-chk'), function (c) { c.style.display = on ? 'none' : ''; }); },
    parseDetail: parseDetail, fetchDetail: fetchDetail
  };
  status(detailNo ? '이 상품을 수집하거나, 목록 화면에서 상품을 골라 수집하세요.' : '사진 왼쪽 위 ✓ 를 눌러 고르거나, 페이지/분류 전체를 수집하세요.');
})();
