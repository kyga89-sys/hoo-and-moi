import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ShoppingBag, Home, CheckCircle, ShieldCheck, ImagePlus, Trash2, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileText, LayoutGrid, Grid2x2, Grid3x3, Lock, Plus, Minus, ChevronDown, ChevronUp, Edit, Share, List, X, Download, Scissors, TrendingUp, ImageIcon, AlertCircle, Eye, EyeOff, Megaphone, Copy, Send, SquarePlus, Ellipsis, EllipsisVertical, ArrowDown, Menu } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// 🔒 손님 화면에서 읽을 수 있는 컬럼 (supabase/security/02_lock_down.sql 의 grant 목록과 같아야 함)
const PUBLIC_PRODUCT_COLUMNS = 'id, name, price, category, main_image, description, is_active, created_at, sizes, sub_images, brand, colors';
const BASE_STORE_SETTINGS_COLUMNS = 'id, bank_name, account_number, depositor_name, shop_name, shop_name_kr, kakao_url, shipping_fee';
// supabase/updates/01_batch1_settings.sql 로 추가된 칸
const BATCH1_STORE_SETTINGS_COLUMNS = `${BASE_STORE_SETTINGS_COLUMNS}, community_url, biz_owner, biz_number, ecommerce_number, biz_email`;
// supabase/updates/02_home_layout.sql 로 추가된 칸 (홈 탭·브랜드 순서)
const LAYOUT_STORE_SETTINGS_COLUMNS = `${BATCH1_STORE_SETTINGS_COLUMNS}, home_layout`;
// supabase/updates/03_soldout_listprice.sql 로 추가된 칸 (정가 배율 %)
const STORE_SETTINGS_COLUMNS = `${LAYOUT_STORE_SETTINGS_COLUMNS}, list_price_rate`;

// 정가(삭선) 계산: 상품에 정가가 있으면 그 값, 비어 있으면 판매가 × (1 + 배율%) 을 보기 좋게 올림
//   1만원 미만은 100원 단위, 이상은 1,000원 단위. 정가 0 또는 배율 0 이면 표시 안 함
const getListPrice = (p: any, rate: number) => {
  const price = Number(p?.price) || 0;
  if (price <= 0) return 0;
  if (p?.list_price === 0) return 0;
  if (p?.list_price != null) return p.list_price > price ? p.list_price : 0;
  if (!rate || rate <= 0) return 0;
  const raw = price * (1 + rate / 100);
  const unit = raw < 10000 ? 100 : 1000;
  return Math.ceil(raw / unit) * unit;
};
const getDiscountRate = (price: number, listPrice: number) => listPrice > price ? Math.round((listPrice - price) / listPrice * 100) : 0;
const isOptionSoldOut = (opt: string) => /품절/.test(opt || '');

// 📲 앱 설치 안내용: 어떤 휴대폰·브라우저로 열었는지
const getInstallEnv = () => {
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
  const isKakao = /KAKAOTALK/i.test(ua);
  const isInApp = isKakao || /Instagram|FBAN|FBAV|NAVER\(inapp|Line\/|DaumApps|everytimeApp/i.test(ua);
  const isIOSChrome = isIOS && /CriOS/i.test(ua);
  const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
  const isSamsung = /SamsungBrowser/i.test(ua);
  return { isIOS, isKakao, isInApp, isIOSChrome, isIPad, isSamsung };
};

// 홈 노출 순서: 순서 미지정(새 상품)이 맨 앞 → 지정한 순서대로 → 같으면 최신순(불러온 순서 유지)
const sortByDisplayOrder = (list: any[]) => list
  .map((p, i) => ({ p, i }))
  .sort((a, b) => {
    const da = a.p.display_order, db = b.p.display_order;
    if (da == null && db == null) return a.i - b.i;
    if (da == null) return -1;
    if (db == null) return 1;
    return da - db || a.i - b.i;
  })
  .map(x => x.p);

// 저장된 순서 목록을 기준으로 정렬 (목록에 없는 것은 뒤로, 기존 기준 유지)
const orderBySaved = <T,>(items: T[], keyOf: (t: T) => string, saved: string[] | undefined) => {
  if (!saved || saved.length === 0) return items;
  const rank = new Map(saved.map((k, i) => [k, i]));
  return items.map((t, i) => ({ t, i })).sort((a, b) => {
    const ra = rank.has(keyOf(a.t)) ? rank.get(keyOf(a.t))! : 1e6 + a.i;
    const rb = rank.has(keyOf(b.t)) ? rank.get(keyOf(b.t))! : 1e6 + b.i;
    return ra - rb;
  }).map(x => x.t);
};

// ↕️ 손가락(마우스)으로 끌어서 순서 바꾸는 목록. 손잡이(≡)를 누른 채 위아래로 움직이면 자리가 바뀜
function SortableList<T>({ items, keyOf, onChange, render, maxHeight }: {
  items: T[]; keyOf: (t: T) => string; onChange: (next: T[]) => void;
  render: (item: T, index: number, handle: React.ReactNode) => React.ReactNode; maxHeight?: string;
}) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const boxRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    if (!dragKey) return;
    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      const list = itemsRef.current;
      const from = list.findIndex(t => keyOf(t) === dragKey);
      if (from < 0) return;
      // 새 위치 = 끌고 있는 항목을 뺀 나머지 중, 손가락보다 가운데가 위에 있는 항목 수
      const rest = list.filter((_, i) => i !== from);
      let to = 0;
      rest.forEach(t => {
        const el = rowRefs.current[keyOf(t)];
        if (el) { const r = el.getBoundingClientRect(); if (e.clientY > r.top + r.height / 2) to++; }
      });
      if (to !== from) {
        rest.splice(to, 0, list[from]);
        onChange(rest);
      }
      // 끝에 가까우면 자동 스크롤
      const box = boxRef.current;
      if (box && maxHeight) {
        const br = box.getBoundingClientRect();
        if (e.clientY < br.top + 40) box.scrollTop -= 12;
        else if (e.clientY > br.bottom - 40) box.scrollTop += 12;
      } else {
        if (e.clientY < 90) window.scrollBy(0, -12);
        else if (e.clientY > window.innerHeight - 110) window.scrollBy(0, 12);
      }
    };
    const onUp = () => setDragKey(null);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); };
  }, [dragKey]);

  return (
    <div ref={boxRef} style={{ maxHeight, overflowY: maxHeight ? 'auto' : undefined, display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {items.map((item, index) => {
        const k = keyOf(item);
        const handle = (
          <span onPointerDown={e => { e.preventDefault(); setDragKey(k); }} aria-label="끌어서 순서 바꾸기"
            style={{ flexShrink: 0, width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', touchAction: 'none', color: '#999', fontSize: '18px', userSelect: 'none' }}>≡</span>
        );
        return (
          <div key={k} ref={el => { rowRefs.current[k] = el; }} style={{ opacity: dragKey === k ? 0.6 : 1, transform: dragKey === k ? 'scale(1.02)' : 'none', transition: 'transform 0.1s', boxShadow: dragKey === k ? '0 6px 16px rgba(0,0,0,0.15)' : 'none', borderRadius: '10px' }}>
            {render(item, index, handle)}
          </div>
        );
      })}
    </div>
  );
}

const DEFAULT_COMMUNITY_URL = 'https://open.kakao.com/o/g48GLFNi';
const DEFAULT_LIST_PRICE_RATE = 30; // 정가 배율 기본값 (도매몰 수집 기본 30%)
const GRID_STORAGE_KEY = 'hm_grid_cols';
const ORDERS_SEEN_KEY = 'hm_admin_orders_seen';
const KAKAO_STATE_KEY = 'hm_kakao_state';

// 클립보드 복사 (구형 브라우저/인앱 브라우저 대비 textarea 방식 fallback)
const copyText = async (text: string) => {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
};

// 썸네일용 옵션 요약: "크림, 블랙, 카키, 핑크" -> "크림, 블랙, 카키 외 1"
const summarizeOptions = (str: string, max: number) => {
  const list = (str || '').split(',').map(s => s.trim()).filter(Boolean);
  return list.length > max ? `${list.slice(0, max).join(', ')} 외 ${list.length - max}` : list.join(', ');
};

// 카카오톡 말풍선 아이콘
const KakaoIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#191919" d="M12 3.5c-5.25 0-9.5 3.33-9.5 7.44 0 2.66 1.78 4.99 4.46 6.31l-.9 3.32c-.08.3.26.54.52.37l3.94-2.6c.48.05.97.08 1.48.08 5.25 0 9.5-3.33 9.5-7.48S17.25 3.5 12 3.5z" />
  </svg>
);

const THEME = {
  primary: '#F06A7D',
  primaryLight: '#FFF0F2',
  bg: '#FAF8F5',
  text: '#333333',
  subText: '#888888',
  border: '#EEEEEE',
  brown: '#6B5B53' 
};

const BASE_CATEGORIES = {
  '아우터': ['코트', '가디건', '자켓', '점퍼', '집업'],
  '탑': [], '원피스': [], '바지': ['청바지', '반바지', '슈트', '팬츠'], '스커트': [], '상하 세트': [],
  '홈웨어': ['실내복', '속옷'],
  '베이비': ['아우터', '탑', '슈트', '스커트', '원피스', '상하복', '실내복', '팬츠', '악세사리/잡화'],
  '슈즈': ['운동화/슬립온', '구두/플랫', '샌들/슬리퍼', '어그/부츠/워커', '장화'],
  '악세사리': ['헤어', '양말', '가방', '모자', '목도리&스카프', '기타']
};

export default function App() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const cartRef = useRef<any[]>([]);
  cartRef.current = cart;
  const [currentView, setCurrentView] = useState('home'); 

  // --- 수파베이스 연동 설정 ---
  const [shopSettings, setShopSettings] = useState({
    shop_name: 'Hoo & Moi', shop_name_kr: '후앤모아', kakao_url: 'https://open.kakao.com/o/sy8ZbjNi', shipping_fee: 3500,
    community_url: DEFAULT_COMMUNITY_URL, biz_owner: '', biz_number: '', ecommerce_number: '', biz_email: '',
    list_price_rate: DEFAULT_LIST_PRICE_RATE
  });
  const [hasRateColumn, setHasRateColumn] = useState(false);
  const [bankInfo, setBankInfo] = useState({ id: '', bank_name: '', account_number: '', depositor_name: '' });
  const [editBankInfo, setEditBankInfo] = useState({ id: '', bank_name: '', account_number: '', depositor_name: '' });

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [showCartModal, setShowCartModal] = useState(false);

  // --- 탭 필터 및 홈 페이징 상태 ---
  const [activeBrand, setActiveBrand] = useState('전체');
  const [activeLargeCat, setActiveLargeCat] = useState('전체');
  const [activeSmallCat, setActiveSmallCat] = useState('전체');
  const [brandTabOpen, setBrandTabOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 20;

  // --- 썸네일 배열 (2열 / 3열), 고른 배열은 브라우저에 기억 ---
  const [gridCols, setGridCols] = useState<2 | 3>(() => {
    try { return localStorage.getItem(GRID_STORAGE_KEY) === '2' ? 2 : 3; } catch (e) { return 3; }
  });
  const homePerPage = gridCols === 3 ? 30 : 20;
  const toggleGridCols = () => {
    const next = gridCols === 2 ? 3 : 2;
    setGridCols(next); setCurrentPage(1);
    try { localStorage.setItem(GRID_STORAGE_KEY, String(next)); } catch (e) {}
  };
  const productListRef = useRef<HTMLDivElement>(null);
  const goHomePage = (page: number) => {
    setCurrentPage(page);
    if (productListRef.current) window.scrollTo({ top: productListRef.current.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
  };

  // --- 주문서 전송 안내창 ---
  const [showOrderSentModal, setShowOrderSentModal] = useState(false);

  // --- 공지사항, 배너, 메인 문구 ---
  const [notice, setNotice] = useState<any>(null);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeInput, setNoticeInput] = useState('');
  const [noticeFile, setNoticeFile] = useState<File | null>(null);
  const [isNoticeUploading, setIsNoticeUploading] = useState(false);

  const [mainBannerUrl, setMainBannerUrl] = useState('');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [isBannerUploading, setIsBannerUploading] = useState(false);

  const [introMain, setIntroMain] = useState("매일매일 입고 싶은 옷,\n고민 없이 후앤모아 🎈");
  const [introSub, setIntroSub] = useState("편안함에 감성을 더한\n우리 아이 맞춤 옷장🎀");
  const [introMainInput, setIntroMainInput] = useState("");
  const [introSubInput, setIntroSubInput] = useState("");
  const [isIntroUploading, setIsIntroUploading] = useState(false);

  // --- 주문 정보 ---
  const [orderName, setOrderName] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [orderAddress, setOrderAddress] = useState('');
  const [orderDetailAddress, setOrderDetailAddress] = useState('');
  const [orderMemo, setOrderMemo] = useState('');
  const [currentOrder, setCurrentOrder] = useState<any>(null);

  const [lookupName, setLookupName] = useState('');
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupOrderNumber, setLookupOrderNumber] = useState(''); 
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [editingCustomerOrderId, setEditingCustomerOrderId] = useState<string | null>(null);
  const [editOrderInputs, setEditOrderInputs] = useState({ name: '', phone: '', address: '', memo: '' });

  // --- 관리자 정보 ---
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  // 설정 > 관리자 계정: 비밀번호 변경
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [isChangingPw, setIsChangingPw] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  // 설정 > 카카오톡 주문 알림 (키·토큰은 서버에만 저장, 화면에는 상태만)
  const [kakaoStatus, setKakaoStatus] = useState<any>(null);
  const [kakaoStatusError, setKakaoStatusError] = useState('');
  const [kakaoKeyInput, setKakaoKeyInput] = useState('');
  const [kakaoSecretInput, setKakaoSecretInput] = useState('');
  const [kakaoBusy, setKakaoBusy] = useState(false);
  // 새 주문 표시: 지난번 관리자 화면을 본 시각 이후 들어온 주문
  const [ordersSeenAt, setOrdersSeenAt] = useState(0);
  const [adminTab, setAdminTab] = useState('orders');
  const [adminOrders, setAdminOrders] = useState<any[]>([]);
  const [adminFilter, setAdminFilter] = useState('전체'); 
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [adminMemoInputs, setAdminMemoInputs] = useState<Record<string, string>>({});
  const [expandedOrderItems, setExpandedOrderItems] = useState<Record<string, boolean>>({}); // 관리자 주문 상세 아코디언 상태

  // 관리자 상품 수정 탭 전용 필터 및 페이징
  const [adminEditSearch, setAdminEditSearch] = useState('');
  const [adminEditBrand, setAdminEditBrand] = useState('전체');
  const [adminEditCategory, setAdminEditCategory] = useState('전체');
  const [adminEditStatus, setAdminEditStatus] = useState('전체'); // 전체 / 판매중 / 품절
  const [adminEditPage, setAdminEditPage] = useState(1);

  // --- 상품 등록/수정 상태 ---
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodCostPrice, setProdCostPrice] = useState('');
  // 정가: '' = 자동(설정 배율), '0' = 표시 안 함, 숫자 = 직접 지정
  const [prodListPrice, setProdListPrice] = useState('');
  const [prodSoldout, setProdSoldout] = useState(false);
  const [prodDesc, setProdDesc] = useState(''); 
  const [prodSizes, setProdSizes] = useState(''); 
  const [prodColors, setProdColors] = useState(''); 
  const [prodCategory, setProdCategory] = useState(''); 
  const [prodBrand, setProdBrand] = useState('');

  const [prodFiles, setProdFiles] = useState<FileList | null>(null); 
  const [subProdFiles, setSubProdFiles] = useState<FileList | null>(null); 
  const [inputSubImageUrls, setInputSubImageUrls] = useState(''); 
  const [existingMainImageUrl, setExistingMainImageUrl] = useState(''); 
  const [isUploading, setIsUploading] = useState(false);
  const [importText, setImportText] = useState('');

  // --- 카테고리/브랜드 관리 상태 ---
  const [newBrand, setNewBrand] = useState('');
  const [brandSearch, setBrandSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [settingsOpen, setSettingsOpen] = useState<Record<string, boolean>>({ shop: true });

  // --- 홈 화면 배치 (분류 탭·브랜드 순서는 store_settings.home_layout, 상품 순서는 products.display_order) ---
  const [homeLayout, setHomeLayout] = useState<{ category_order?: string[]; brand_order?: string[] }>({});
  const [layoutCats, setLayoutCats] = useState<string[] | null>(null);
  const [layoutBrands, setLayoutBrands] = useState<string[] | null>(null);
  const [layoutProducts, setLayoutProducts] = useState<any[] | null>(null);
  const [layoutProductLimit, setLayoutProductLimit] = useState(60);
  const [layoutBrandPick, setLayoutBrandPick] = useState('');
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [adminCatExpanded, setAdminCatExpanded] = useState<Record<string, boolean>>({});
  const [newMainCat, setNewMainCat] = useState('');
  const [newSubCats, setNewSubCats] = useState<Record<string, string>>({});

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installGuide, setInstallGuide] = useState<null | 'ios' | 'android' | 'inapp'>(null);
  // 이미 홈 화면 앱으로 열었으면 "앱 다운" 버튼 숨김
  const [isAppMode, setIsAppMode] = useState(() => {
    try { return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true; } catch (e) { return false; }
  });

  // 🔙 뒤로가기: 화면 이동마다 브라우저 기록을 남겨서 휴대폰 뒤로가기·상단 < 버튼이
  //    직전 화면으로 돌아가고, 홈으로 돌아오면 보던 위치(스크롤)를 그대로 복원
  const homeScrollRef = useRef(0);
  const navDepthRef = useRef(0);
  const popNavRef = useRef(false);
  const prevViewRef = useRef('home');
  const currentViewRef = useRef(currentView);
  currentViewRef.current = currentView;
  const productsRef = useRef<any[]>([]);
  productsRef.current = products;

  useEffect(() => {
    const onScroll = () => { if (currentViewRef.current === 'home') homeScrollRef.current = window.scrollY; };
    const onPop = (e: PopStateEvent) => {
      const state = e.state || {};
      let view: string = state.hmView || 'home';
      navDepthRef.current = typeof state.hmDepth === 'number' ? state.hmDepth : 0;
      if (view === 'detail') {
        const target = productsRef.current.find((p: any) => String(p.id) === String(state.productId));
        if (target) { setSelectedProduct(target); setSelectedSize(''); setSelectedColor(''); setQuantity(1); }
        else view = 'home';
      }
      // 주문이 끝난 뒤 뒤로가기로 주문서 화면에 돌아가지 않도록
      if ((view === 'orderForm' || view === 'quotationPreview') && cartRef.current.length === 0) view = 'home';
      popNavRef.current = true;
      setCurrentView(view);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('popstate', onPop);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('popstate', onPop); };
  }, []);

  useLayoutEffect(() => {
    const prev = prevViewRef.current;
    if (prev !== currentView) {
      if (!popNavRef.current && currentView !== 'home') {
        navDepthRef.current += 1;
        const url = currentView === 'detail' && selectedProduct ? `${window.location.pathname}?productId=${selectedProduct.id}` : window.location.pathname;
        window.history.pushState({ hmView: currentView, hmDepth: navDepthRef.current, productId: selectedProduct?.id }, '', url);
      }
      if (currentView === 'home') window.scrollTo(0, homeScrollRef.current);
      else window.scrollTo(0, 0);
    }
    popNavRef.current = false;
    prevViewRef.current = currentView;
  }, [currentView]);

  const handleGoHome = () => {
    if (currentView === 'home') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (navDepthRef.current > 0) { window.history.go(-navDepthRef.current); return; }
    window.history.replaceState(null, '', window.location.pathname);
    setCurrentView('home');
  };
  const handleBack = () => {
    if (navDepthRef.current > 0) window.history.back();
    else handleGoHome();
  };

  useEffect(() => { setCurrentPage(1); homeScrollRef.current = 0; }, [activeBrand, activeLargeCat, activeSmallCat, searchQuery]);
  useEffect(() => { setAdminEditPage(1); }, [adminEditSearch, adminEditBrand, adminEditCategory, adminEditStatus]);

  useEffect(() => {
    fetchProducts(); fetchCategories(); fetchBrands(); fetchNoticesAndBanner(); fetchStoreSettings();
    const handleBeforeInstallPrompt = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    const handleInstalled = () => { setDeferredPrompt(null); setInstallGuide(null); setIsAppMode(true); };
    window.addEventListener('appinstalled', handleInstalled);
    // 안드로이드 "앱 설치" 버튼이 뜨려면 서비스 워커가 있어야 함 (public/sw.js, 화면은 저장하지 않음)
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    // 카카오톡에서 "앱 다운"을 눌러 외부 브라우저로 넘어온 경우 → 설치 안내를 바로 띄움
    if (new URLSearchParams(window.location.search).get('install') === '1') {
      setTimeout(() => setInstallGuide(getInstallEnv().isIOS ? 'ios' : 'android'), 800);
    }

    if (!document.getElementById('daum-postcode-script')) {
      const script = document.createElement('script');
      script.id = 'daum-postcode-script';
      script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
      script.async = true;
      document.head.appendChild(script);
    }
    return () => { window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt); window.removeEventListener('appinstalled', handleInstalled); };
  }, []);

  // 📲 앱 다운: 안드로이드 Chrome = 버튼 한 번에 설치 창 / 아이폰 = 그림 안내 / 카카오톡 = 외부 브라우저로 열기
  const handleInstallClick = async () => {
    const env = getInstallEnv();
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
      return;
    }
    if (env.isKakao) {
      // 카카오톡 안에서는 홈 화면 추가가 안 됨 → Safari / Chrome 으로 열고 설치 안내 띄우기
      window.location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(`${window.location.origin}/?install=1`);
      return;
    }
    if (env.isInApp) return setInstallGuide('inapp');
    setInstallGuide(env.isIOS ? 'ios' : 'android');
  };

  const handleSearchAddress = () => {
    if ((window as any).daum && (window as any).daum.Postcode) {
      new (window as any).daum.Postcode({
        oncomplete: function(data: any) {
          let fullAddress = data.address;
          let extraAddress = '';
          if (data.addressType === 'R') {
            if (data.bname !== '') extraAddress += data.bname;
            if (data.buildingName !== '') extraAddress += (extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName);
            fullAddress += (extraAddress !== '' ? ` (${extraAddress})` : '');
          }
          setOrderAddress(fullAddress);
        }
      }).open();
    } else {
      alert("주소 검색 로딩 중입니다. 잠시 후 다시 시도해주세요.");
    }
  };

  const fetchStoreSettings = async () => {
    try {
      // 새 칸 SQL 실행 전이라면 있는 칸만으로 불러오기 (최신 → 1차 → 기본 순서로 시도)
      let data: any[] | null = null;
      for (const cols of [STORE_SETTINGS_COLUMNS, LAYOUT_STORE_SETTINGS_COLUMNS, BATCH1_STORE_SETTINGS_COLUMNS, BASE_STORE_SETTINGS_COLUMNS]) {
        const res = await supabase.from('store_settings').select(cols).order('id', { ascending: true }).limit(1);
        if (!res.error) { data = res.data; break; }
      }
      if (data && data.length > 0) {
        setBankInfo(data[0]); setEditBankInfo(data[0]);
        setShopSettings({
          shop_name: data[0].shop_name || 'Hoo & Moi', shop_name_kr: data[0].shop_name_kr || '후앤모아',
          kakao_url: data[0].kakao_url || 'https://open.kakao.com/o/sy8ZbjNi',
          shipping_fee: data[0].shipping_fee !== undefined ? data[0].shipping_fee : 3500,
          community_url: data[0].community_url || DEFAULT_COMMUNITY_URL,
          biz_owner: data[0].biz_owner || '', biz_number: data[0].biz_number || '',
          ecommerce_number: data[0].ecommerce_number || '', biz_email: data[0].biz_email || '',
          list_price_rate: typeof data[0].list_price_rate === 'number' ? data[0].list_price_rate : DEFAULT_LIST_PRICE_RATE
        });
        setHasRateColumn('list_price_rate' in data[0]);
        setHomeLayout(data[0].home_layout && typeof data[0].home_layout === 'object' ? data[0].home_layout : {});
      }
    } catch (err) {}
  };

  const saveStoreSettings = async () => {
    try {
      const updateData = {
        bank_name: editBankInfo.bank_name, account_number: editBankInfo.account_number, depositor_name: editBankInfo.depositor_name,
        shop_name: shopSettings.shop_name, shop_name_kr: shopSettings.shop_name_kr,
        kakao_url: shopSettings.kakao_url, shipping_fee: shopSettings.shipping_fee,
        community_url: shopSettings.community_url, biz_owner: shopSettings.biz_owner, biz_number: shopSettings.biz_number,
        ecommerce_number: shopSettings.ecommerce_number, biz_email: shopSettings.biz_email,
        ...(hasRateColumn ? { list_price_rate: Math.max(0, Math.min(100, shopSettings.list_price_rate || 0)) } : {})
      };

      let response;
      if (!editBankInfo.id) {
        response = await supabase.from('store_settings').insert([updateData]);
      } else {
        response = await supabase.from('store_settings').update(updateData).eq('id', editBankInfo.id);
      }

      if (response.error) throw response.error;

      alert("쇼핑몰 설정이 저장되었습니다."); 
      fetchStoreSettings();
    } catch (err:any) { 
      alert("저장 실패 (수파베이스 문제): " + err.message); 
    }
  };

  const fetchNoticesAndBanner = async () => {
    const { data } = await supabase.from('notices').select('*').in('id', [1, 2, 3]);
    if (data) {
      const popup = data.find((d:any) => d.id === 1);
      const banner = data.find((d:any) => d.id === 2);
      const intro = data.find((d:any) => d.id === 3);

      if (popup) { setNotice(popup); setNoticeInput(popup.content || ''); if (popup.is_active) setShowNoticeModal(true); }
      if (banner && banner.image_url) setMainBannerUrl(banner.image_url);
      if (intro && intro.content) {
        const parts = intro.content.split('||');
        setIntroMain(parts[0] || "매일매일 입고 싶은 옷,\n고민 없이 후앤모아 🎈"); setIntroMainInput(parts[0] || '');
        setIntroSub(parts[1] || "편안함에 감성을 더한\n우리 아이 맞춤 옷장🎀"); setIntroSubInput(parts[1] || '');
      } else {
        setIntroMainInput("매일매일 입고 싶은 옷,\n고민 없이 후앤모아 🎈"); setIntroSubInput("편안함에 감성을 더한\n우리 아이 맞춤 옷장🎀");
      }
    }
  };

  // 🔒 매입원가(cost_price)는 관리자 로그인 상태에서만 불러옴
  const fetchProducts = async (withCost = isAdmin) => {
    // 🚨 타입 에러 해결: any[]로 타입 명시
    let allProducts: any[] = [];
    let from = 0;
    const step = 1000;
    let fetchMore = true;
    // 새 칸 SQL 실행 전이면 있는 칸만으로 불러오기 (최신 → 노출순서 → 기본 순서로 시도)
    const colCandidates = [`${PUBLIC_PRODUCT_COLUMNS}, display_order, is_soldout, list_price`, `${PUBLIC_PRODUCT_COLUMNS}, display_order`, PUBLIC_PRODUCT_COLUMNS];
    let colIdx = 0;

    while (fetchMore) {
      let { data, error } = await supabase
        .from("products")
        .select(withCost ? "*" : colCandidates[colIdx])
        .order("created_at", { ascending: false })
        .range(from, from + step - 1);
      while (error && !withCost && colIdx < colCandidates.length - 1) {
        colIdx += 1;
        ({ data, error } = await supabase.from("products").select(colCandidates[colIdx]).order("created_at", { ascending: false }).range(from, from + step - 1));
      }

      if (data && data.length > 0) {
        allProducts = [...allProducts, ...data];
        from += step;
        if (data.length < step) {
          fetchMore = false; 
        }
      } else {
        fetchMore = false;
      }
    }

    if (allProducts.length > 0) {
      setProducts(sortByDisplayOrder(allProducts));
      const pId = new URLSearchParams(window.location.search).get("productId");
      if (pId) {
        const targetProduct = allProducts.find((p: any) => p.id.toString() === pId);
        if (targetProduct) {
          setSelectedProduct(targetProduct);
          setSelectedSize("");
          setSelectedColor("");
          setQuantity(1);
          setCurrentView("detail");
        }
      }
    }
  };

  const fetchCategories = async () => { const { data } = await supabase.from('categories').select('*').order('id', { ascending: true }); if (data) setCategories(data); };
  const fetchBrands = async () => { const { data } = await supabase.from('brands').select('*').order('id', { ascending: true }); if (data) setBrands(data); };

  const getCombinedCategories = () => {
    const tree: Record<string, string[]> = JSON.parse(JSON.stringify(BASE_CATEGORIES));
    (categories || []).forEach(c => {
      const parts = c.name.split('>'); const main = parts[0].trim();
      if (!tree[main]) tree[main] = [];
      if (parts.length > 1) {
        const sub = parts.slice(1).map((p:string) => p.trim()).join(' > ');
        if (!tree[main].includes(sub)) tree[main].push(sub);
      }
    });
    return tree;
  };
  const categoryTree = getCombinedCategories();

  // 🏷️ 홈 탭: 상품이 있는 분류만, 정해진 순서대로 (기타는 맨 뒤)
  const MAIN_CAT_ORDER = ['아우터', '탑', '바지', '하의', '원피스', '스커트', '상하 세트', '홈웨어', '베이비', '한복', '수영복', '슈즈', '악세사리'];
  const catRank = (name: string) => name === '기타' ? 999 : (MAIN_CAT_ORDER.indexOf(name) === -1 ? 500 : MAIN_CAT_ORDER.indexOf(name));
  const mainCatCounts: Record<string, number> = {};
  const subCatCounts: Record<string, number> = {};
  const brandCounts: Record<string, number> = {};
  products.forEach(p => {
    const [main, ...rest] = (p.category || '').split('>').map((s: string) => s.trim());
    if (main) mainCatCounts[main] = (mainCatCounts[main] || 0) + 1;
    if (main && rest.length) { const key = `${main} > ${rest.join(' > ')}`; subCatCounts[key] = (subCatCounts[key] || 0) + 1; }
    if (p.brand) brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
  });
  // 설정 > 홈 화면 배치에서 저장한 순서가 있으면 그 순서, 없으면 기본 순서
  const homeMainCats = orderBySaved(Object.keys(mainCatCounts).sort((a, b) => catRank(a) - catRank(b) || a.localeCompare(b, 'ko')), c => c, homeLayout.category_order);
  const homeSubCats = activeLargeCat === '전체' ? [] : Object.keys(subCatCounts)
    .filter(k => k.startsWith(`${activeLargeCat} > `)).map(k => k.slice(activeLargeCat.length + 3)).sort((a, b) => a.localeCompare(b, 'ko'));
  const homeBrands = orderBySaved(Object.entries(brandCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko')), b => b.name, homeLayout.brand_order);

  const showBrandRow = brandTabOpen || activeBrand !== '전체';
  const isBrandTab = showBrandRow;
  const isAllTab = !showBrandRow && activeLargeCat === '전체';
  const selectAllTab = () => { setBrandTabOpen(false); setActiveBrand('전체'); setActiveLargeCat('전체'); setActiveSmallCat('전체'); };
  const selectBrandTab = () => { setBrandTabOpen(true); setActiveLargeCat('전체'); setActiveSmallCat('전체'); };
  const selectMainCat = (main: string) => { setBrandTabOpen(false); setActiveBrand('전체'); setActiveLargeCat(main); setActiveSmallCat('전체'); };

  // 탭 버튼 모양 통일: main = 1단(채움), sub = 2단(테두리)
  const chipStyle = (active: boolean, level: 'main' | 'sub'): React.CSSProperties => level === 'main' ? {
    flexShrink: 0, height: '34px', padding: '0 14px', borderRadius: '17px', fontSize: '13.5px', whiteSpace: 'nowrap', cursor: 'pointer',
    fontWeight: active ? 'bold' : 500, border: `1px solid ${active ? THEME.primary : THEME.border}`,
    backgroundColor: active ? THEME.primary : '#fff', color: active ? '#fff' : THEME.text
  } : {
    flexShrink: 0, height: '30px', padding: '0 12px', borderRadius: '15px', fontSize: '12.5px', whiteSpace: 'nowrap', cursor: 'pointer',
    fontWeight: active ? 'bold' : 'normal', border: `1px solid ${active ? THEME.primary : THEME.border}`,
    backgroundColor: active ? THEME.primaryLight : '#fff', color: active ? THEME.primary : THEME.subText
  };

  const getBrandCount = (brandName: string) => products.filter(p => p.brand === brandName).length;
  const getLargeCatCount = (catName: string) => products.filter(p => p.category && p.category.startsWith(catName)).length;
  const getSmallCatCount = (catName: string, subName: string) => products.filter(p => p.category === `${catName} > ${subName}`).length;

  const handleSmartPaste = async () => {
    if(!importText) return alert("복사한 글자를 붙여넣어주세요.");
    let textToParse = importText; let parsedRetail = 0; let parsedWholesale = 0; let brandStr = ''; let nameStr = ''; let colorStr = ''; let sizeStr = '';

    const retailMatch = textToParse.match(/소비자가\s*([\d,]+)원?/);
    if(retailMatch) { parsedRetail = parseInt(retailMatch[1].replace(/,/g, '')); textToParse = textToParse.replace(retailMatch[0], ''); }
    const wholesaleMatch = textToParse.match(/판매가\s*([\d,]+)원?/);
    if(wholesaleMatch) { parsedWholesale = parseInt(wholesaleMatch[1].replace(/,/g, '')); textToParse = textToParse.replace(wholesaleMatch[0], ''); }

    const colorMatch = textToParse.match(/[<\[(]([가-힣a-zA-Z0-9\s/,-]+)[>\])]/);
    if(colorMatch) { colorStr = colorMatch[1].split(/[/,]/).map(s=>s.trim()).filter(Boolean).join(', '); textToParse = textToParse.replace(colorMatch[0], ''); }

    const sizeMatch = textToParse.match(/\*?([a-zA-Z0-9가-힣()]+)\s*[~-]\s*([a-zA-Z0-9가-힣()]+)\*?/i);
    if(sizeMatch) { 
        let rawRange = sizeMatch[0]; let startSize = sizeMatch[1].trim(); let endSize = sizeMatch[2].trim();
        textToParse = textToParse.replace(rawRange, ''); 

        const SIZE_PRESETS = [
          ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'], ['JS', 'JM', 'JL', 'JXL'],
          ['1(XS)', '2(S)', '3(M)', '4(L)', '5(XL)', '6(XXL)'],
          ['XS(3호)', 'S(5호)', 'M(7호)', 'L(9호)', 'XL(11호)', 'XXL(13호)'],
          ['S(3개월)', 'M(6개월)', 'L(9개월)', 'XL(12개월)', 'XXL(18개월)'],
          ['S(1~3M)', 'M(3~6M)', 'L(6~12M)', 'XL(12~18M)'], ['3M', '6M', '9M', '12M', '18M', '24M'],
          ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
          ['3', '5', '7', '9', '11', '13', '15', '17', '19'],
          ['50', '60', '70', '80', '90', '100', '110', '120', '130', '140', '150']
        ];

        let found = false;
        for (const preset of SIZE_PRESETS) {
          const normPreset = preset.map(s => s.replace(/\s+/g, '').toUpperCase());
          const normStart = startSize.replace(/\s+/g, '').toUpperCase();
          const normEnd = endSize.replace(/\s+/g, '').toUpperCase();
          const startIndex = normPreset.indexOf(normStart);
          const endIndex = normPreset.indexOf(normEnd);
          if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) { sizeStr = preset.slice(startIndex, endIndex + 1).join(', '); found = true; break; }
        }

        if(!found) {
          const pureStart = startSize.replace(/[^a-zA-Z]/g, '').toUpperCase();
          const pureEnd = endSize.replace(/[^a-zA-Z]/g, '').toUpperCase();
          if(pureStart && pureEnd) {
              const purePreset = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
              const sIdx = purePreset.indexOf(pureStart); const eIdx = purePreset.indexOf(pureEnd);
              if(sIdx !== -1 && eIdx !== -1 && sIdx < eIdx) { sizeStr = purePreset.slice(sIdx, eIdx + 1).join(', '); found = true; }
          }
        }

        if (!found) {
           let sNum = parseInt(startSize.replace(/[^0-9]/g, '')); let eNum = parseInt(endSize.replace(/[^0-9]/g, '')); let suffix = startSize.replace(/[0-9]/g, '');
           if (!isNaN(sNum) && !isNaN(eNum) && sNum < eNum && (eNum - sNum) <= 30) {
              let step = 1;
              if (sNum >= 50 && eNum >= 60 && (eNum - sNum) % 10 === 0) step = 10;
              else if (sNum % 2 !== 0 && eNum % 2 !== 0 && sNum >= 3 && sNum <= 19) step = 2; 
              else if (suffix.toUpperCase() === 'M') { if ((eNum - sNum) % 6 === 0) step = 6; else if ((eNum - sNum) % 3 === 0) step = 3; }
              // 🚨 타입 에러 해결: string[]로 타입 명시
              let gen: string[] = []; 
              for(let i = sNum; i <= eNum; i += step) { gen.push(i.toString() + suffix); }
              sizeStr = gen.join(', ');
           } else { sizeStr = `${startSize} ~ ${endSize}`; } 
        }
    }

    const lines = textToParse.split('\n').map(l => l.trim()).filter(l => l);
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i]; if(line.includes('상품상세') || line === '추천' || line.includes('할인')) continue;
        const parts = line.split(' ').filter(Boolean);
        if(parts.length > 0) {
            let firstWord = parts[0];
            if(firstWord.toUpperCase().endsWith('KC')) { brandStr = firstWord.slice(0, -2); nameStr = parts.slice(1).join(' ').replace(/소비자가|판매가/g, '').trim(); }
            else if(firstWord.match(/^[A-Za-z가-힣0-9]+$/) && parts.length > 1) { brandStr = firstWord; nameStr = parts.slice(1).join(' ').replace(/소비자가|판매가/g, '').trim(); }
            else { nameStr = line.replace(/소비자가|판매가/g, '').trim(); }
            break; 
        }
    }

    if(parsedRetail > 0) setProdPrice(parsedRetail.toString());
    if(parsedWholesale > 0) setProdCostPrice(parsedWholesale.toString());
    if(colorStr) setProdColors(colorStr);
    if(sizeStr) setProdSizes(sizeStr);

    if(brandStr) { 
        setProdBrand(brandStr); 
        const isBrandExist = brands.some(b => b.name === brandStr);
        if (!isBrandExist) { supabase.from('brands').insert([{ name: brandStr }]).select().then(({data}) => { if (data) setBrands(prev => [...prev, data[0]]); }); }
    }

    if(nameStr) {
      const cleanName = nameStr.replace(/[*<>\[\]]/g, '').trim();
      setProdName(cleanName);
      const keywords = {
        '원피스': '원피스 > 원피스', '스커트': '스커트 > 치마', '치마': '스커트 > 치마', '조끼': '탑 > 조끼', '베스트': '탑 > 베스트',
        '바지': '하의 > 바지', '팬츠': '하의 > 바지', '청바지': '하의 > 청바지', '레깅스': '하의 > 레깅스',
        '티셔츠': '탑 > 티셔츠', '맨투맨': '탑 > 맨투맨', '니트': '탑 > 니트', '블라우스': '탑 > 블라우스', 
        '가디건': '아우터 > 가디건', '자켓': '아우터 > 자켓', '점퍼': '아우터 > 점퍼', '코트': '아우터 > 코트',
        '상하': '상하 세트', '세트': '상하 세트', '실내복': '홈웨어', '슈트': '베이비 > 바디슈트', '롬퍼': '베이비 > 롬퍼'
      };
      let matchedCategory = '';
      for (const [key, value] of Object.entries(keywords)) { if (cleanName.includes(key)) { matchedCategory = value; break; } }
      if (matchedCategory) { 
        setProdCategory(matchedCategory); 
        const isCatExist = categories.some(c => c.name === matchedCategory);
        if (!isCatExist) { supabase.from('categories').insert([{ name: matchedCategory }]).select().then(({data})=>{ if(data) setCategories(prev => [...prev, data[0]]); }); }
      }
    }
    alert("✅ 텍스트 분석 완료! 브랜드, 카테고리, 사이즈/색상이 자동세팅 되었습니다."); setImportText(''); 
  };

  const handleSaveNotice = async (status: boolean) => {
    setIsNoticeUploading(true);
    try {
      let imageUrl = notice?.image_url || null;
      if (noticeFile) {
        const fileName = `notice_${Date.now()}.${noticeFile.name.split('.').pop()}`;
        await supabase.storage.from('products').upload(fileName, noticeFile);
        const { data } = supabase.storage.from('products').getPublicUrl(fileName);
        imageUrl = data.publicUrl;
      }
      await supabase.from('notices').upsert([{ id: 1, content: noticeInput, image_url: imageUrl, is_active: status }]);
      alert(`공지사항이 ${status ? '활성화' : '숨김'} 처리되었습니다.`); fetchNoticesAndBanner();
    } catch (error: any) { alert("공지 저장 실패: " + error.message); } finally { setIsNoticeUploading(false); }
  };

  const handleSaveMainBanner = async () => {
    if (!bannerFile) return alert("배너 이미지를 첨부해주세요.");
    setIsBannerUploading(true);
    try {
      const fileName = `banner_${Date.now()}.${bannerFile.name.split('.').pop()}`;
      await supabase.storage.from('products').upload(fileName, bannerFile);
      const { data } = supabase.storage.from('products').getPublicUrl(fileName);
      await supabase.from('notices').upsert([{ id: 2, image_url: data.publicUrl, is_active: true }]);
      alert("메인 배너가 적용되었습니다!"); setBannerFile(null); fetchNoticesAndBanner();
    } catch (error: any) { alert("배너 저장 실패: " + error.message); } finally { setIsBannerUploading(false); }
  };

  const handleSaveIntro = async () => {
    setIsIntroUploading(true);
    try {
      const content = `${introMainInput}||${introSubInput}`;
      await supabase.from('notices').upsert([{ id: 3, content: content, is_active: true }]);
      alert("메인 문구가 변경되었습니다!"); fetchNoticesAndBanner();
    } catch(e:any) { alert("문구 저장 실패: " + e.message); } finally { setIsIntroUploading(false); }
  };

  const addCategory = async (main: string, sub: string) => { 
    if(!main) return alert("대분류를 입력해주세요.");
    const fullName = sub ? `${main} > ${sub}` : main;
    await supabase.from('categories').insert([{ name: fullName }]); 
    if(sub) setNewSubCats({...newSubCats, [main]: ''});
    setNewMainCat(''); fetchCategories(); 
  };
  const deleteCategory = async (id: number) => { if (window.confirm("정말 삭제하시겠습니까?")) { await supabase.from('categories').delete().eq('id', id); fetchCategories(); } };
  const addBrand = async () => { if(newBrand) { await supabase.from('brands').insert([{ name: newBrand }]); setNewBrand(''); fetchBrands(); } };
  const deleteBrand = async (id: number) => { if (window.confirm("삭제하시겠습니까?")) { await supabase.from('brands').delete().eq('id', id); fetchBrands(); } };

  const handleSaveProduct = async () => {
    if (!prodName || !prodPrice) return alert("상품명, 판매 가격은 필수입니다!");
    if (!editingProductId && !existingMainImageUrl && (!prodFiles || prodFiles.length === 0)) return alert("대표 사진 첨부는 필수입니다!");

    setIsUploading(true);
    try {
      let main_image = existingMainImageUrl || undefined; let sub_images_array: string[] = [];
      if (inputSubImageUrls) sub_images_array.push(...inputSubImageUrls.split(/,|\n/).map(s => s.trim()).filter(Boolean));
      if (prodFiles && prodFiles.length > 0) {
        for (let i = 0; i < prodFiles.length; i++) {
          const file = prodFiles[i]; const fileName = `main_${Date.now()}_${i}.${file.name.split('.').pop()}`;
          await supabase.storage.from('products').upload(fileName, file); const { data } = supabase.storage.from('products').getPublicUrl(fileName);
          if (i === 0) main_image = data.publicUrl; else sub_images_array.push(data.publicUrl); 
        }
      }
      if (subProdFiles && subProdFiles.length > 0) {
        for (let i = 0; i < subProdFiles.length; i++) {
          const file = subProdFiles[i]; const fileName = `sub_${Date.now()}_${i}.${file.name.split('.').pop()}`;
          await supabase.storage.from('products').upload(fileName, file); const { data } = supabase.storage.from('products').getPublicUrl(fileName);
          sub_images_array.push(data.publicUrl);
        }
      }
      const productData: any = { name: prodName, price: parseInt(prodPrice), cost_price: parseInt(prodCostPrice) || 0, category: prodCategory, brand: prodBrand, description: prodDesc, sizes: prodSizes, colors: prodColors };
      // 품절·정가 칸은 SQL(03_soldout_listprice.sql) 실행 후에만 저장
      if (hasProductExtraColumns) {
        productData.is_soldout = prodSoldout;
        productData.list_price = prodListPrice.trim() === '' ? null : (parseInt(prodListPrice) || 0);
      }
      if (main_image) productData.main_image = main_image; 
      if (sub_images_array.length > 0) productData.sub_images = sub_images_array.join(',');
      if (editingProductId && sub_images_array.length === 0 && inputSubImageUrls === '') productData.sub_images = null;

      if (editingProductId) { await supabase.from('products').update(productData).eq('id', editingProductId); alert("수정 완료!"); } 
      else { await supabase.from('products').insert([productData]); alert("등록 완료!"); }

      resetProductForm(); await fetchProducts(); setAdminTab('productEdit');
    } catch (err: any) { alert("오류 발생: " + err.message); } finally { setIsUploading(false); }
  };
  const resetProductForm = () => { setEditingProductId(null); setProdName(''); setProdPrice(''); setProdCostPrice(''); setProdListPrice(''); setProdSoldout(false); setProdDesc(''); setProdSizes(''); setProdColors(''); setProdCategory(''); setProdBrand(''); setProdFiles(null); setSubProdFiles(null); setInputSubImageUrls(''); setExistingMainImageUrl(''); setImportText(''); };
  const openEditProduct = (p: any) => { setEditingProductId(p.id); setProdName(p.name); setProdPrice(p.price.toString()); setProdCostPrice(p.cost_price ? p.cost_price.toString() : ''); setProdListPrice(p.list_price == null ? '' : String(p.list_price)); setProdSoldout(!!p.is_soldout); setProdDesc(p.description || ''); setProdSizes(p.sizes || ''); setProdColors(p.colors || ''); setProdCategory(p.category || ''); setProdBrand(p.brand || ''); setExistingMainImageUrl(p.main_image || ''); setInputSubImageUrls(p.sub_images || ''); setAdminTab('productAdd'); };
  // 품절 칸(SQL 03) 이 있는지: 관리자 화면은 전체 칸(*)을 불러오므로 첫 상품에 칸이 있으면 사용 가능
  const hasProductExtraColumns = products.length > 0 && 'is_soldout' in products[0];
  // 상품 관리 목록에서 품절 ↔ 판매중 바로 바꾸기
  const toggleSoldout = async (p: any) => {
    if (!hasProductExtraColumns) return alert("품절 기능을 쓰려면 supabase/updates/03_soldout_listprice.sql 을 먼저 실행해주세요.");
    const next = !p.is_soldout;
    const { error } = await supabase.from('products').update({ is_soldout: next }).eq('id', p.id);
    if (error) return alert("변경 실패: " + error.message);
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_soldout: next } : x));
  };
  const deleteProduct = async (id: string) => { if (window.confirm("상품을 삭제하시겠습니까?")) { await supabase.from('products').delete().eq('id', id); fetchProducts(); } };

  const getExtraPrice = (optStr: string) => {
    if (!optStr) return 0;
    const match = optStr.match(/\(\s*\+([\d,]+)\s*원?\s*\)/);
    if (match && match[1]) {
      return parseInt(match[1].replace(/,/g, ""), 10) || 0;
    }
    return 0;
  };

  const addToCart = () => {
    if (selectedProduct.is_soldout) return alert("품절된 상품입니다.");
    if (isOptionSoldOut(selectedSize) || isOptionSoldOut(selectedColor)) return alert("선택한 옵션은 품절입니다. 다른 옵션을 골라주세요.");
    if (selectedProduct.sizes && !selectedSize)
      return alert("사이즈를 선택해주세요!");
    if (selectedProduct.colors && !selectedColor)
      return alert("색상을 선택해주세요!");

    const sizeExtra = getExtraPrice(selectedSize);
    const colorExtra = getExtraPrice(selectedColor);
    const finalPrice = (selectedProduct.price || 0) + sizeExtra + colorExtra;

    setCart([
      ...cart,
      {
        ...selectedProduct,
        price: finalPrice, 
        base_price: selectedProduct.price,
        extra_price: sizeExtra + colorExtra,
        selectedSize,
        selectedColor,
        quantity,
        cartId: Date.now(),
        cost_price: selectedProduct.cost_price || 0,
      },
    ]);
    setShowCartModal(true);
  };
  const removeFromCart = (cartId: number) => { setCart(cart.filter(item => item.cartId !== cartId)); };

  const totalShippingFee = cart.length > 0 ? shopSettings.shipping_fee : 0;
  const totalItemAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalOrderAmount = totalItemAmount + totalShippingFee;

  // 🔒 주문은 서버 함수(create_order)에서 상품 가격·옵션 추가금·배송비를 다시 계산해서 저장
  const submitOrder = async () => {
    if (isSubmittingOrder) return;
    setIsSubmittingOrder(true);
    try {
      const fullOrderAddress = `${orderAddress} ${orderDetailAddress}`.trim();
      const { data: newOrder, error } = await supabase.rpc('create_order', {
        p_customer_name: orderName, p_phone: orderPhone, p_address: fullOrderAddress, p_memo: orderMemo,
        p_items: cart.map(item => ({ product_id: item.id, size: item.selectedSize, color: item.selectedColor, quantity: item.quantity }))
      });
      if (error) throw error;
      setCurrentOrder(newOrder); setCart([]); setCurrentView('orderComplete');
    } catch (err: any) {
      alert("주문 접수에 실패했습니다.\n" + (err?.message || '잠시 후 다시 시도해주세요.'));
    } finally { setIsSubmittingOrder(false); }
  };

  const searchMyOrder = async () => {
    if(!lookupPhone) return alert("보안을 위해 주문 시 입력한 '연락처'를 반드시 입력해주세요.");
    if(!lookupOrderNumber && !lookupName) return alert("연락처와 함께 '주문번호' 또는 '주문자 이름'을 입력해주세요.");

    try {
      const { data, error } = await supabase.rpc('lookup_orders', { p_phone: lookupPhone, p_order_number: lookupOrderNumber || null, p_name: lookupName || null });
      if (error) throw error;
      if (data && data.length > 0) setMyOrders(data);
      else alert("입력하신 정보와 일치하는 주문 내역이 없습니다. 연락처나 이름을 다시 확인해주세요.");
    } catch (err: any) { alert("조회에 실패했습니다. 잠시 후 다시 시도해주세요."); }
  };

  const openCustomerEdit = (order: any) => { setEditingCustomerOrderId(order.id); setEditOrderInputs({ name: order.customer_name, phone: order.phone, address: order.address, memo: order.memo || '' }); };
  const saveCustomerEdit = async (id: string) => {
    const { data: updated, error } = await supabase.rpc('update_my_order', { p_order_id: id, p_phone: lookupPhone, p_customer_name: editOrderInputs.name, p_new_phone: editOrderInputs.phone, p_address: editOrderInputs.address, p_memo: editOrderInputs.memo });
    if (error) return alert("수정 실패: " + error.message);
    if (!updated) return alert("입금대기 상태의 주문만 수정할 수 있습니다.");
    alert("수정되었습니다."); setEditingCustomerOrderId(null);
    setLookupPhone(editOrderInputs.phone);
    const { data } = await supabase.rpc('lookup_orders', { p_phone: editOrderInputs.phone, p_order_number: lookupOrderNumber || null, p_name: lookupOrderNumber ? null : editOrderInputs.name });
    if (data) setMyOrders(data);
  };

  const fetchAdminOrders = async () => { const { data } = await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }); if (data) setAdminOrders(data); };

  // 🔒 관리자 로그인: Supabase 계정 + admin_users 목록에 등록된 이메일만 통과
  const enterAdmin = async () => {
    const { data: ok } = await supabase.rpc('is_admin');
    if (!ok) { await supabase.auth.signOut(); setIsAdmin(false); return false; }
    setIsAdmin(true);
    markOrdersSeen(true);
    const { data: u } = await supabase.auth.getUser();
    if (u.user?.email) setAdminEmail(u.user.email);
    await Promise.all([fetchAdminOrders(), fetchProducts(true)]);
    setCurrentView('admin');
    return true;
  };
  const handleAdminLogin = async () => {
    if (!adminEmail || !adminPassword) return alert("이메일과 비밀번호를 입력해주세요.");
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: adminEmail.trim(), password: adminPassword });
      if (error) {
        const code = (error as any).code || '';
        if (code === 'invalid_credentials') return alert("로그인 실패: 비밀번호가 맞지 않거나 등록되지 않은 이메일입니다.\n\n👁 버튼으로 입력한 비밀번호를 확인해보세요. (브라우저가 예전 비밀번호를 자동으로 넣었을 수 있어요)");
        if (code === 'email_not_confirmed') return alert("로그인 실패: 아직 메일 인증이 안 된 계정입니다.\nSupabase > Authentication > Users 에서 인증 상태를 확인해주세요.");
        if (error.status === 429) return alert("로그인 시도가 너무 많습니다. 몇 분 뒤 다시 시도해주세요.");
        return alert("로그인 실패: " + error.message);
      }
      setAdminPassword(''); setShowAdminPassword(false);
      if (!(await enterAdmin())) alert("로그인은 됐지만 관리자로 등록되지 않은 계정입니다.\nadmin_users 목록에 이메일을 등록해주세요.");
    } finally { setIsLoggingIn(false); }
  };
  const openAdmin = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session && (await enterAdmin())) return;
    setCurrentView('adminLogin');
  };
  // 🔑 로그인한 관리자 본인의 비밀번호 변경 (Supabase 대시보드에 들어가지 않아도 됨)
  const handleChangePassword = async () => {
    if (newPw.length < 8) return alert("새 비밀번호는 8자 이상으로 입력해주세요.");
    if (newPw !== newPw2) return alert("새 비밀번호와 확인이 서로 다릅니다.");
    setIsChangingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) {
        if ((error as any).code === 'same_password') return alert("지금 쓰는 비밀번호와 같습니다. 다른 비밀번호로 정해주세요.");
        if ((error as any).code === 'weak_password') return alert("비밀번호가 너무 쉽습니다. 영문과 숫자를 섞어 더 길게 정해주세요.");
        if ((error as any).code === 'reauthentication_needed') return alert("보안을 위해 로그아웃 후 다시 로그인한 뒤 바로 변경해주세요.");
        return alert("변경 실패: " + error.message);
      }
      setNewPw(''); setNewPw2(''); setShowNewPw(false);
      alert("비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 쓰세요.");
    } finally { setIsChangingPw(false); }
  };
  // 🆕 새 주문 표시: 관리자 화면에 들어올 때 "지난번에 본 시각"을 기억해두고 그 뒤 주문에 NEW 표시
  //    (fromStorage = 관리자 화면에 처음 들어올 때, 아니면 [주문] 탭을 다시 눌러 확인했을 때)
  const markOrdersSeen = (fromStorage = false) => {
    let prev = Date.now();
    try {
      if (fromStorage) prev = Number(localStorage.getItem(ORDERS_SEEN_KEY)) || Date.now();
      localStorage.setItem(ORDERS_SEEN_KEY, String(Date.now()));
    } catch (e) {}
    setOrdersSeenAt(prev);
  };
  const isNewOrder = (o: any) => ordersSeenAt > 0 && new Date(o.created_at).getTime() > ordersSeenAt;
  const newOrderCount = adminOrders.filter(isNewOrder).length;

  // 관리자 화면을 열어두면 1분마다 주문 새로고침 (다른 앱 보다 돌아와도 바로 새로고침)
  useEffect(() => {
    if (currentView !== 'admin') return;
    const timer = setInterval(fetchAdminOrders, 60000);
    const onVisible = () => { if (document.visibilityState === 'visible') fetchAdminOrders(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [currentView]);

  // 💬 카카오톡 주문 알림 (supabase/updates/04_kakao_notify.sql)
  const kakaoRedirectUri = `${window.location.origin}/`;
  const kakaoSqlHint = "\n\n(처음이라면 supabase/updates/04_kakao_notify.sql 을 먼저 실행해주세요)";
  const applyKakaoStatus = (s: any) => { setKakaoStatus(s); setKakaoKeyInput(s?.rest_api_key || ''); setKakaoSecretInput(''); setKakaoStatusError(''); };
  const fetchKakaoStatus = async () => {
    const { data, error } = await supabase.rpc('kakao_admin_status');
    if (error) { setKakaoStatus(null); setKakaoStatusError(/kakao_admin_status|function/i.test(error.message) ? '카카오 알림 SQL(04_kakao_notify.sql)이 아직 실행되지 않았습니다.' : error.message); return; }
    applyKakaoStatus(data);
  };
  const runKakao = async (fn: string, args: Record<string, any> | undefined, okMsg: string) => {
    setKakaoBusy(true);
    try {
      const { data, error } = await supabase.rpc(fn, args);
      if (error) { alert(error.message + (/function/i.test(error.message) ? kakaoSqlHint : '')); return false; }
      applyKakaoStatus(data);
      if (okMsg) alert(okMsg);
      return true;
    } finally { setKakaoBusy(false); }
  };
  const saveKakaoConfig = (enabled?: boolean) => {
    const key = kakaoKeyInput.trim();
    if (!key) return alert("REST API 키를 입력해주세요.");
    const keyChanged = kakaoStatus?.rest_api_key && kakaoStatus.rest_api_key !== key;
    if (keyChanged && kakaoStatus?.connected && !window.confirm("REST API 키가 바뀌면 지금 연결은 끊깁니다. 저장 후 [카카오 연결하기]를 다시 눌러주세요.\n계속할까요?")) return;
    return runKakao('kakao_admin_save', {
      p_rest_api_key: key,
      p_client_secret: kakaoSecretInput.trim() ? kakaoSecretInput.trim() : null,
      p_enabled: enabled ?? (kakaoStatus?.enabled ?? true)
    }, enabled === undefined ? "저장했습니다." : (enabled ? "주문 알림을 켰습니다." : "주문 알림을 껐습니다. (연결은 유지)"));
  };
  const clearKakaoSecret = () => {
    if (!window.confirm("저장된 Client Secret 을 지울까요? (카카오 앱에서 Client Secret 을 '사용 안 함'으로 바꾼 경우에만)")) return;
    runKakao('kakao_admin_save', { p_rest_api_key: kakaoStatus?.rest_api_key || kakaoKeyInput.trim(), p_client_secret: '', p_enabled: kakaoStatus?.enabled ?? true }, "Client Secret 을 지웠습니다.");
  };
  // 카카오 로그인 화면으로 이동 → 동의 후 이 쇼핑몰 주소로 돌아오면(아래 useEffect) 서버가 연결 마무리
  const startKakaoConnect = (otherAccount = false) => {
    if (!kakaoStatus?.rest_api_key) return alert("REST API 키를 먼저 저장해주세요.");
    if (otherAccount && getInstallEnv().isKakao) return alert("카카오톡 안에서는 다른 계정으로 바꿀 수 없습니다. Chrome·Safari 로 관리자 화면을 열어주세요.");
    const state = `hm-kakao-${Math.random().toString(36).slice(2, 10)}`;
    try { sessionStorage.setItem(KAKAO_STATE_KEY, state); } catch (e) {}
    const q = new URLSearchParams({ client_id: kakaoStatus.rest_api_key, redirect_uri: kakaoRedirectUri, response_type: 'code', scope: 'talk_message', state });
    if (otherAccount) q.set('prompt', 'login');
    window.location.href = `https://kauth.kakao.com/oauth/authorize?${q.toString()}`;
  };
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const state = params.get('state') || '';
    if (!state.startsWith('hm-kakao-')) return;
    const code = params.get('code'); const err = params.get('error');
    window.history.replaceState(null, '', window.location.pathname);
    let saved = '';
    try { saved = sessionStorage.getItem(KAKAO_STATE_KEY) || ''; sessionStorage.removeItem(KAKAO_STATE_KEY); } catch (e) {}
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session || !(await enterAdmin())) return alert("카카오 연결을 마치려면 관리자로 로그인한 상태여야 합니다. 로그인 후 다시 [카카오 연결하기]를 눌러주세요.");
      setAdminTab('settings'); setSettingsOpen(s => ({ ...s, kakao: true }));
      if (err) { await fetchKakaoStatus(); return alert(err === 'access_denied' ? "카카오 동의를 취소했습니다. 다시 [카카오 연결하기]를 눌러주세요." : `카카오 연결 실패: ${params.get('error_description') || err}`); }
      if (!code || state !== saved) { await fetchKakaoStatus(); return alert("연결 요청이 만료됐습니다. 다시 [카카오 연결하기]를 눌러주세요."); }
      const ok = await runKakao('kakao_admin_connect', { p_code: code, p_redirect_uri: kakaoRedirectUri }, "카카오 연결 완료! 카카오톡 '나와의 채팅'에 확인 메시지가 왔는지 봐주세요.");
      if (!ok) await fetchKakaoStatus();
    })();
  }, []);
  useEffect(() => { if (currentView === 'admin' && adminTab === 'settings' && !kakaoStatus && !kakaoStatusError) fetchKakaoStatus(); }, [currentView, adminTab]);

  const handleAdminLogout = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false); setAdminOrders([]);
    await fetchProducts(false);
    handleGoHome();
  };
  const updateOrderStatus = async (id: string, status: string) => { if (window.confirm(`[${status}](으)로 변경하시겠습니까?`)) { await supabase.from('orders').update({ status }).eq('id', id); fetchAdminOrders(); } };
  const saveOrderInfo = async (id: string, currentTracking: string, currentMemo: string) => {
    const tracking = trackingInputs[id] !== undefined ? trackingInputs[id] : currentTracking;
    const memo = adminMemoInputs[id] !== undefined ? adminMemoInputs[id] : currentMemo;
    await supabase.from('orders').update({ tracking_number: tracking, admin_memo: memo }).eq('id', id);
    alert("저장되었습니다."); setEditingOrderId(null); fetchAdminOrders();
  };
  const deleteOrder = async (id: string) => { if (window.confirm("주문을 삭제하시겠습니까?")) { await supabase.from('orders').delete().eq('id', id); fetchAdminOrders(); } };

  const calculateStats = () => {
    const validOrders = adminOrders.filter(o => ['결제완료', '배송지연', '발송완료'].includes(o.status));
    let totalOrderAmount = 0; let totalProductSales = 0; let totalCost = 0;  
    validOrders.forEach(order => {
      totalOrderAmount += order.total_amount;
      if(order.order_items) { order.order_items.forEach((item: any) => { totalProductSales += item.price * item.quantity; totalCost += (item.cost_price || 0) * item.quantity; }); }
    });
    return { totalOrderAmount, totalProductSales, totalCost, netProfit: totalProductSales - totalCost, orderCount: validOrders.length };
  };
  const stats = calculateStats();

  const handleShareProduct = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?productId=${selectedProduct.id}`;
    if (navigator.share) { try { await navigator.share({ title: selectedProduct.name, text: `${selectedProduct.name} - 후앤모아에서 확인해보세요!`, url: shareUrl }); } catch (err) {} } 
    else { navigator.clipboard.writeText(shareUrl); alert("상품 링크가 복사되었습니다!"); }
  };

  const isNewProduct = (dateString: string) => dateString && (new Date().getTime() - new Date(dateString).getTime()) <= 14 * 24 * 60 * 60 * 1000;
  const getStatusStyle = (status: string) => {
    if (status === '입금대기') return { bg: '#f1f1f1', text: '#666' };
    if (status === '결제완료') return { bg: '#e3f2fd', text: '#1976d2' };
    if (status === '배송지연') return { bg: '#fff3e0', text: '#e65100' };
    if (status === '발송완료') return { bg: '#e8f5e9', text: '#2e7d32' };
    if (status === '주문취소' || status === '환불처리') return { bg: '#ffebee', text: '#c62828' };
    return { bg: THEME.primary, text: 'white' };
  };
  const openProductDetail = (p: any) => {
    setSelectedProduct(p); setSelectedSize(''); setSelectedColor(''); setQuantity(1); setCurrentView('detail');
  };

  const displayProductsRaw = products.filter(p => {
    const matchBrand = activeBrand === '전체' || p.brand === activeBrand;
    let matchCategory = true;
    if (activeLargeCat !== '전체') {
      if (activeSmallCat !== '전체') { matchCategory = p.category === `${activeLargeCat} > ${activeSmallCat}`; } 
      else { matchCategory = p.category && p.category.startsWith(activeLargeCat); }
    }
    const normalize = (str: string) => (str || '').replace(/\s+/g, '').toLowerCase();
    const normalizedQuery = normalize(searchQuery);
    const matchSearch = !normalizedQuery || normalize(p.name).includes(normalizedQuery) || normalize(p.brand).includes(normalizedQuery);
    return matchBrand && matchCategory && matchSearch;
  });
  // 품절 상품은 목록 맨 뒤로 (나머지 순서는 그대로)
  const displayProducts = [...displayProductsRaw.filter(p => !p.is_soldout), ...displayProductsRaw.filter(p => p.is_soldout)];

  const totalPages = Math.max(1, Math.ceil(displayProducts.length / homePerPage));
  const currentProducts = displayProducts.slice((currentPage - 1) * homePerPage, currentPage * homePerPage);

  const adminDisplayProducts = products.filter(p => {
    const matchBrand = adminEditBrand === '전체' || p.brand === adminEditBrand;
    const matchCategory = adminEditCategory === '전체' || (p.category && p.category.startsWith(adminEditCategory));
    const normalize = (str: string) => (str || '').replace(/\s+/g, '').toLowerCase();
    const matchSearch = !adminEditSearch || normalize(p.name).includes(normalize(adminEditSearch)) || normalize(p.brand).includes(normalize(adminEditSearch));
    const matchStatus = adminEditStatus === '전체' || (adminEditStatus === '품절' ? !!p.is_soldout : !p.is_soldout);
    return matchBrand && matchCategory && matchSearch && matchStatus;
  });
  const adminTotalPages = Math.max(1, Math.ceil(adminDisplayProducts.length / productsPerPage));
  const adminCurrentProducts = adminDisplayProducts.slice((adminEditPage - 1) * productsPerPage, adminEditPage * productsPerPage);

  const filteredAdminOrders = adminOrders.filter(o => adminFilter === '전체' ? true : adminFilter === '취소/환불' ? (o.status === '주문취소' || o.status === '환불처리') : o.status === adminFilter);

  const renderOrderItem = (item: any, idx: number) => {
    let brandName = '';
    let itemName = item.product_name;
    if (itemName.startsWith('[')) {
      const closeIdx = itemName.indexOf(']');
      if (closeIdx !== -1) {
        brandName = itemName.substring(1, closeIdx);
        itemName = itemName.substring(closeIdx + 1).trim();
      }
    }
    return (
      <div key={idx} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: `1px solid ${THEME.bg}` }}>
        {brandName && <p style={{ fontSize: '12px', fontWeight: 'bold', color: THEME.primary, margin: '0 0 4px 0' }}>{brandName}</p>}
        <p style={{ fontSize: '14px', margin: '0 0 6px 0', color: THEME.text, fontWeight: '500' }}>{itemName}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: THEME.subText }}>
          <span>단가: {item.price.toLocaleString()}원 x {item.quantity}개</span>
          <span style={{ fontWeight: 'bold', color: THEME.text }}>{(item.price * item.quantity).toLocaleString()}원</span>
        </div>
      </div>
    );
  };

  // 📨 주문서 전송하기: 주문정보 복사 → 안내창 → (안내창 버튼으로) 1:1 채팅 열기
  const buildOrderSheet = (order: any) => [
    `[${shopSettings.shop_name_kr} 입금확인요청]`,
    `주문번호: ${order.order_number}`,
    `성함: ${order.customer_name}`,
    `연락처: ${order.phone}`,
    `입금액: ${order.total_amount.toLocaleString()}원`,
    `입금계좌: ${bankInfo.bank_name} ${bankInfo.account_number} (예금주 ${bankInfo.depositor_name})`
  ].join('\n');
  // 안내창 순서: ① 입금(계좌 복사) → ② 입금 후 주문서 복사 + 1:1 채팅
  const handleSendOrderSheet = () => { copyText(buildOrderSheet(currentOrder)); setShowOrderSentModal(true); };
  const handleCopyAccount = async () => {
    const ok = await copyText(`${bankInfo.bank_name} ${bankInfo.account_number}`);
    alert(ok ? "계좌번호가 복사되었습니다.\n입금 후 ② 주문서 전송을 꼭 해주세요!" : "복사에 실패했습니다. 계좌번호를 직접 입력해주세요.");
  };
  const handleCopyOrderSheet = async () => {
    const ok = await copyText(buildOrderSheet(currentOrder));
    alert(ok ? "주문서가 복사되었습니다.\n1:1 채팅방에 붙여넣어 보내주세요." : "복사에 실패했습니다. 주문서 내용을 꾹 눌러 직접 복사해주세요.");
  };
  // 계좌를 먼저 복사했어도 채팅방을 열 때 주문서로 다시 복사 (팝업 차단을 피하려고 기다리지 않고 바로 열기)
  const handleOpenChatWithSheet = () => {
    copyText(buildOrderSheet(currentOrder));
    window.open(shopSettings.kakao_url, '_blank');
  };
  // 🧰 관리자 화면 공통 모양 (카드·입력칸·버튼 크기/간격 통일)
  const A = {
    card: { backgroundColor: '#fff', borderRadius: '16px', border: `1px solid ${THEME.border}`, padding: '18px', marginBottom: '14px' } as React.CSSProperties,
    cardTitle: { fontSize: '16px', fontWeight: 'bold', color: THEME.text, margin: 0 } as React.CSSProperties,
    help: { fontSize: '12px', color: THEME.subText, margin: '4px 0 0 0', lineHeight: 1.5 } as React.CSSProperties,
    label: { display: 'block', fontSize: '12.5px', fontWeight: 'bold', color: THEME.text, margin: '0 0 6px 0' } as React.CSSProperties,
    input: { width: '100%', height: '44px', padding: '0 12px', borderRadius: '10px', border: `1px solid ${THEME.border}`, backgroundColor: '#fff', fontSize: '14px', color: THEME.text } as React.CSSProperties,
    textarea: { width: '100%', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${THEME.border}`, backgroundColor: '#fff', fontSize: '14px', lineHeight: 1.6, resize: 'vertical' as const, color: THEME.text } as React.CSSProperties,
    row2: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' } as React.CSSProperties,
    field: { marginBottom: '14px' } as React.CSSProperties,
    btn: (kind: 'primary' | 'dark' | 'outline' | 'danger' = 'primary', full = true): React.CSSProperties => ({
      width: full ? '100%' : 'auto', height: '46px', padding: '0 16px', borderRadius: '12px', fontSize: '14.5px', fontWeight: 'bold', cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', whiteSpace: 'nowrap',
      border: kind === 'outline' ? `1px solid ${THEME.border}` : kind === 'danger' ? '1px solid #e5b4b4' : 'none',
      backgroundColor: kind === 'primary' ? THEME.primary : kind === 'dark' ? THEME.text : '#fff',
      color: kind === 'primary' || kind === 'dark' ? '#fff' : kind === 'danger' ? '#c62828' : THEME.text
    }),
    smallBtn: (kind: 'dark' | 'outline' | 'danger' = 'outline'): React.CSSProperties => ({
      height: '34px', padding: '0 12px', borderRadius: '9px', fontSize: '12.5px', fontWeight: 'bold', cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', whiteSpace: 'nowrap',
      border: kind === 'dark' ? 'none' : `1px solid ${kind === 'danger' ? '#e5b4b4' : THEME.border}`,
      backgroundColor: kind === 'dark' ? THEME.text : '#fff', color: kind === 'dark' ? '#fff' : kind === 'danger' ? '#c62828' : THEME.text
    })
  };
  // ↕️ 홈 화면 배치 저장
  const layoutSqlHint = "\n\n(처음이라면 supabase/updates/02_home_layout.sql 을 먼저 실행해주세요)";
  const saveTabLayout = async () => {
    if (!bankInfo.id) return alert("쇼핑몰 설정을 먼저 저장해주세요.");
    setIsSavingLayout(true);
    try {
      const next = { ...homeLayout, category_order: layoutCats ?? homeMainCats, brand_order: layoutBrands ?? homeBrands.map(b => b.name) };
      const { error } = await supabase.from('store_settings').update({ home_layout: next }).eq('id', bankInfo.id);
      if (error) throw error;
      setHomeLayout(next); setLayoutCats(null); setLayoutBrands(null);
      alert("분류 탭 · 브랜드 순서를 저장했습니다. 홈 화면에 바로 반영됩니다.");
    } catch (e: any) { alert("저장 실패: " + e.message + layoutSqlHint); } finally { setIsSavingLayout(false); }
  };
  const saveProductLayout = async () => {
    if (!layoutProducts) return;
    setIsSavingLayout(true);
    try {
      const { error } = await supabase.rpc('set_product_order', { p_ids: layoutProducts.map((p: any) => p.id) });
      if (error) throw error;
      setLayoutProducts(null); await fetchProducts(true);
      alert("상품 순서를 저장했습니다. 홈 화면에 바로 반영됩니다.");
    } catch (e: any) { alert("저장 실패: " + e.message + layoutSqlHint); } finally { setIsSavingLayout(false); }
  };
  const resetProductLayout = async () => {
    if (!window.confirm("상품 순서를 모두 지우고 최신 등록순으로 되돌릴까요?")) return;
    setIsSavingLayout(true);
    try {
      const { error } = await supabase.rpc('set_product_order', { p_ids: null });
      if (error) throw error;
      setLayoutProducts(null); await fetchProducts(true);
      alert("최신 등록순으로 초기화했습니다.");
    } catch (e: any) { alert("초기화 실패: " + e.message + layoutSqlHint); } finally { setIsSavingLayout(false); }
  };

  // 설정 탭 접기/펼치기 머리
  const settingsHeader = (key: string, title: string, desc: string) => (
    <button onClick={() => setSettingsOpen(s => ({ ...s, [key]: !s[key] }))} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={A.cardTitle}>{title}</p>
        <p style={A.help}>{desc}</p>
      </div>
      {settingsOpen[key] ? <ChevronUp size={20} color={THEME.subText} /> : <ChevronDown size={20} color={THEME.subText} />}
    </button>
  );

  const optionBtnStyle = (active: boolean, soldout: boolean, padX: string): React.CSSProperties => ({
    padding: `10px ${padX}`, borderRadius: '25px', fontSize: '14px', transition: '0.2s', cursor: soldout ? 'not-allowed' : 'pointer',
    border: active ? `2px solid ${THEME.primary}` : `1px solid ${THEME.border}`,
    backgroundColor: soldout ? '#f3f3f3' : active ? THEME.primaryLight : '#fff',
    color: soldout ? '#bbb' : active ? THEME.primary : THEME.text,
    fontWeight: active ? 'bold' : 'normal', textDecoration: soldout ? 'line-through' : 'none'
  });
  const stepBadgeStyle: React.CSSProperties = { flexShrink: 0, width: '24px', height: '24px', borderRadius: '50%', backgroundColor: THEME.primary, color: '#fff', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const smallActionStyle: React.CSSProperties = { flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px', height: '30px', padding: '0 12px', borderRadius: '15px', border: `1px solid ${THEME.border}`, backgroundColor: '#fff', fontSize: '12px', fontWeight: 'bold', color: THEME.text, cursor: 'pointer', whiteSpace: 'nowrap' };

  // 📄 페이지 번호: « 10페이지 이전 / ‹ 1페이지 이전 / 1~10 / › 1페이지 다음 / » 10페이지 다음
  const renderPagination = (page: number, total: number, onChange: (p: number) => void, accent: string) => {
    if (total <= 1) return null;
    const blockStart = Math.floor((page - 1) / 10) * 10 + 1;
    const blockEnd = Math.min(total, blockStart + 9);
    const pages = Array.from({ length: blockEnd - blockStart + 1 }, (_, i) => blockStart + i);
    const arrowBtn = (icon: React.ReactNode, target: number, disabled: boolean, label: string) => (
      <button aria-label={label} onClick={() => !disabled && onChange(target)} disabled={disabled}
        style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: `1px solid ${THEME.border}`, backgroundColor: '#fff', color: disabled ? '#ccc' : THEME.text, cursor: disabled ? 'default' : 'pointer', flexShrink: 0, padding: 0 }}>{icon}</button>
    );
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2px', maxWidth: '420px', margin: '0 auto' }}>
        {arrowBtn(<ChevronsLeft size={15} />, Math.max(1, page - 10), page === 1, '10페이지 이전')}
        {arrowBtn(<ChevronLeft size={15} />, page - 1, page === 1, '이전 페이지')}
        {pages.map(n => (
          <button key={n} onClick={() => onChange(n)} style={{ flex: '0 1 30px', minWidth: 0, height: '28px', padding: 0, borderRadius: '14px', border: 'none', backgroundColor: n === page ? accent : 'transparent', color: n === page ? '#fff' : THEME.text, fontWeight: n === page ? 'bold' : 'normal', fontSize: '13px', cursor: 'pointer' }}>{n}</button>
        ))}
        {arrowBtn(<ChevronRight size={15} />, page + 1, page === total, '다음 페이지')}
        {arrowBtn(<ChevronsRight size={15} />, Math.min(total, page + 10), page === total, '10페이지 다음')}
      </div>
    );
  };

  // 🏢 하단 사업자 정보 (전자상거래법 표시사항 + 결제 계좌)
  const renderBusinessFooter = () => {
    const bizDigits = (shopSettings.biz_number || '').replace(/[^0-9]/g, '');
    const row = (label: string, value: React.ReactNode) => value ? (
      <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}><span style={{ color: '#aaa', minWidth: '96px', flexShrink: 0 }}>{label}</span><span style={{ color: '#666', wordBreak: 'break-all' }}>{value}</span></div>
    ) : null;
    return (
      <footer style={{ backgroundColor: '#F4F2EF', padding: '28px 20px 40px', fontSize: '12px', lineHeight: '1.6', borderTop: `1px solid ${THEME.border}` }}>
        <p style={{ fontSize: '13px', fontWeight: 'bold', color: THEME.text, margin: '0 0 10px 0' }}>쇼핑몰 기본정보</p>
        {row('상호명', shopSettings.shop_name_kr)}
        {row('대표자', shopSettings.biz_owner)}
        {row('사업자등록번호', shopSettings.biz_number && (
          <>{shopSettings.biz_number}{bizDigits.length === 10 && <a href={`https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${bizDigits}`} target="_blank" rel="noreferrer" style={{ marginLeft: '8px', color: THEME.text, textDecoration: 'underline' }}>사업자정보 확인</a>}</>
        ))}
        {row('통신판매업 신고', shopSettings.ecommerce_number)}
        {row('이메일', shopSettings.biz_email && <a href={`mailto:${shopSettings.biz_email}`} style={{ color: '#666' }}>{shopSettings.biz_email}</a>)}
        {shopSettings.kakao_url && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ color: '#aaa', minWidth: '96px', flexShrink: 0 }}>문의하기</span>
            <a href={shopSettings.kakao_url} target="_blank" rel="noreferrer" aria-label="카카오톡 1:1 문의" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#FEE500', color: '#191919', padding: '5px 12px', borderRadius: '16px', fontWeight: 'bold', textDecoration: 'none' }}><KakaoIcon size={16} /> 카카오톡 문의</a>
          </div>
        )}
        {(bankInfo.bank_name || bankInfo.account_number) && (
          <>
            <p style={{ fontSize: '13px', fontWeight: 'bold', color: THEME.text, margin: '18px 0 10px 0' }}>결제정보</p>
            {row('무통장 입금', `${bankInfo.bank_name} ${bankInfo.account_number}`)}
            {row('예금주', bankInfo.depositor_name)}
          </>
        )}
        <p style={{ color: '#bbb', margin: '18px 0 0 0' }}>© {shopSettings.shop_name}. All rights reserved.</p>
      </footer>
    );
  };

  return (
    <div style={{ backgroundColor: THEME.bg, minHeight: '100vh', fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif", paddingBottom: '110px', color: THEME.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&display=swap');
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
        * { font-family: 'Pretendard', sans-serif; letter-spacing: -0.3px; }
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes hm-bounce { 0%, 100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, 10px); } }
        .serif-text { font-family: 'Noto Serif KR', serif !important; }
        input, textarea, button, select { outline: none; }
        input:focus, textarea:focus { border-color: ${THEME.primary} !important; }
      `}</style>

      {/* 📲 앱 설치 안내창 */}
      {installGuide && (() => {
        const env = getInstallEnv();
        const step = (n: number, body: React.ReactNode) => (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '14px' }}>
            <span style={{ flexShrink: 0, width: '26px', height: '26px', borderRadius: '50%', backgroundColor: THEME.primary, color: '#fff', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
            <div style={{ flex: 1, fontSize: '14.5px', lineHeight: 1.55, color: THEME.text, paddingTop: '2px' }}>{body}</div>
          </div>
        );
        const chip = (icon: React.ReactNode, label: string) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', margin: '0 2px', borderRadius: '6px', backgroundColor: '#eef3ff', color: '#1a5fd0', fontWeight: 'bold', fontSize: '13px', verticalAlign: 'middle' }}>{icon}{label}</span>
        );
        // 아이폰 Safari 는 공유 버튼이 화면 맨 아래 가운데 → 그쪽을 가리키는 화살표
        const showBottomArrow = installGuide === 'ios' && !env.isIOSChrome && !env.isIPad;
        return (
          <div onClick={() => setInstallGuide(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: showBottomArrow ? 'flex-start' : 'center', justifyContent: 'center', padding: showBottomArrow ? '70px 16px 16px' : '16px' }}>
            <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#fff', borderRadius: '22px', width: '100%', maxWidth: '380px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 20px 14px', backgroundColor: THEME.primaryLight }}>
                <img src="/icon-192.png" alt="" style={{ width: '52px', height: '52px', borderRadius: '12px', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '17px', fontWeight: 'bold', margin: '0 0 2px 0', color: THEME.text }}>{shopSettings.shop_name_kr} 앱 설치</p>
                  <p style={{ fontSize: '12.5px', margin: 0, color: THEME.subText }}>홈 화면에 아이콘이 생겨 앱처럼 바로 열려요</p>
                </div>
              </div>
              <div style={{ padding: '18px 20px 8px' }}>
                {installGuide === 'ios' && (env.isIOSChrome ? (<>
                  {step(1, <>주소창 오른쪽의 {chip(<Share size={13} />, '공유')} 버튼을 눌러요</>)}
                  {step(2, <>{chip(<SquarePlus size={13} />, '홈 화면에 추가')}를 눌러요<br /><span style={{ fontSize: '12.5px', color: THEME.subText }}>안 보이면 메뉴를 아래로 내려보세요</span></>)}
                  {step(3, <>오른쪽 위 <strong>추가</strong>를 누르면 끝!</>)}
                </>) : (<>
                  {step(1, <>{env.isIPad ? '화면 오른쪽 위' : '화면 맨 아래 가운데'}의 {chip(<Share size={13} />, '공유')} 버튼을 눌러요<br /><span style={{ fontSize: '12.5px', color: THEME.subText }}>버튼이 안 보이면 화면을 살짝 아래로 내리거나, {chip(<Ellipsis size={13} />, '')}를 먼저 눌러요</span></>)}
                  {step(2, <>메뉴를 아래로 내려 {chip(<SquarePlus size={13} />, '홈 화면에 추가')}를 눌러요</>)}
                  {step(3, <>오른쪽 위 <strong>추가</strong>를 누르면 끝! 🎉</>)}
                </>))}
                {installGuide === 'android' && (deferredPrompt ? (
                  <>
                    <p style={{ fontSize: '14.5px', margin: '0 0 14px 0', lineHeight: 1.55 }}>아래 버튼을 누르고 <strong>설치</strong>를 누르면 끝이에요.</p>
                    <button onClick={() => { setInstallGuide(null); handleInstallClick(); }} style={{ width: '100%', height: '50px', border: 'none', borderRadius: '25px', backgroundColor: THEME.primary, color: '#fff', fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', cursor: 'pointer' }}>지금 설치하기</button>
                  </>
                ) : env.isSamsung ? (<>
                  {step(1, <>화면 아래 {chip(<Menu size={13} />, '메뉴')}를 눌러요</>)}
                  {step(2, <>{chip(<SquarePlus size={13} />, '현재 페이지 추가')} → <strong>홈 화면</strong>을 눌러요</>)}
                </>) : (<>
                  {step(1, <>오른쪽 위 {chip(<EllipsisVertical size={13} />, '메뉴')}를 눌러요</>)}
                  {step(2, <>{chip(<Download size={13} />, '앱 설치')} 또는 {chip(<SquarePlus size={13} />, '홈 화면에 추가')}를 눌러요</>)}
                  <p style={{ fontSize: '12.5px', color: THEME.subText, margin: '0 0 12px 0' }}>이미 설치했다면 홈 화면에서 {shopSettings.shop_name_kr} 아이콘을 찾아보세요.</p>
                </>))}
                {installGuide === 'inapp' && (<>
                  <p style={{ fontSize: '14.5px', margin: '0 0 14px 0', lineHeight: 1.55 }}>지금 앱(인스타그램·네이버 등) 안에서 열려 있어서 바로 설치가 안 돼요.</p>
                  {step(1, <>오른쪽 위(또는 아래) {chip(<Ellipsis size={13} />, '메뉴')}를 눌러요</>)}
                  {step(2, <><strong>{env.isIOS ? 'Safari로 열기' : '다른 브라우저로 열기'}</strong>를 누른 뒤 다시 <strong>앱 다운</strong>을 눌러요</>)}
                  <button onClick={async () => { const ok = await copyText(window.location.origin); alert(ok ? '주소를 복사했어요. Safari·Chrome 주소창에 붙여넣어 주세요.' : window.location.origin); }} style={{ width: '100%', height: '44px', border: `1px solid ${THEME.border}`, borderRadius: '22px', backgroundColor: '#fff', fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', cursor: 'pointer' }}>쇼핑몰 주소 복사하기</button>
                </>)}
                <button onClick={() => setInstallGuide(null)} style={{ width: '100%', height: '44px', border: 'none', backgroundColor: 'transparent', color: THEME.subText, fontSize: '14px', cursor: 'pointer' }}>닫기</button>
              </div>
            </div>
            {showBottomArrow && (
              <div style={{ position: 'fixed', left: '50%', bottom: '14px', transform: 'translateX(-50%)', animation: 'hm-bounce 1.1s ease-in-out infinite', display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#fff', pointerEvents: 'none' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '2px', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>여기 공유 버튼</span>
                <ArrowDown size={34} strokeWidth={3} />
              </div>
            )}
          </div>
        );
      })()}

      {showNoticeModal && notice && currentView !== 'admin' && currentView !== 'adminLogin' && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(2px)' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '20px', width: '85%', maxWidth: '400px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            {notice.image_url && <img src={notice.image_url} style={{ width: '100%', maxHeight: '250px', objectFit: 'cover' }} />}
            <div style={{ padding: '25px 20px', textAlign: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: THEME.brown, marginBottom: '15px' }}>📢 {shopSettings.shop_name_kr} 공지사항</h3>
              <p style={{ fontSize: '14px', color: THEME.text, lineHeight: '1.6', whiteSpace: 'pre-line', marginBottom: '25px', textAlign: 'left' }}>{notice.content}</p>
              <button onClick={() => setShowNoticeModal(false)} style={{ width: '100%', padding: '14px', backgroundColor: THEME.primary, color: 'white', borderRadius: '30px', fontWeight: 'bold', fontSize: '15px', border: 'none' }}>확인했습니다</button>
            </div>
          </div>
        </div>
      )}

      {/* 머리글: 좌우 칸 너비를 같게(84px) 해서 상호가 정확히 가운데 */}
      <header style={{ display: 'grid', gridTemplateColumns: '84px 1fr 84px', alignItems: 'center', height: '60px', padding: '0 16px', backgroundColor: '#fff', position: 'sticky', top: 0, zIndex: 100, borderBottom: `1px solid ${THEME.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
           {currentView !== 'home' ? (
             <button onClick={handleBack} aria-label="뒤로가기" style={{ background: 'none', border: 'none', padding: '4px', marginLeft: '-6px', cursor: 'pointer', display: 'flex', color: THEME.text }}><ChevronLeft size={26} /></button>
           ) : !isAppMode ? (
             <button onClick={handleInstallClick} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', backgroundColor: THEME.primaryLight, padding: '6px 10px', borderRadius: '15px', border: 'none' }}>
               <Download size={13} color={THEME.primary} />
               <span style={{fontSize: '12px', color: THEME.primary, fontWeight: 'bold', whiteSpace: 'nowrap'}}>앱 다운</span>
             </button>
           ) : null}
        </div>
        <h1 className="serif-text" style={{ color: THEME.brown, fontSize: '23px', fontWeight: '700', margin: 0, textAlign: 'center', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} onClick={handleGoHome}>{shopSettings.shop_name}</h1>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px' }}>
          {currentView === 'home' && (
            <button onClick={toggleGridCols} aria-label={gridCols === 2 ? '3열로 보기' : '2열로 보기'} title={gridCols === 2 ? '3열로 보기' : '2열로 보기'} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', color: THEME.text }}>
              {gridCols === 2 ? <Grid2x2 size={22} /> : <Grid3x3 size={22} />}
            </button>
          )}
          <button onClick={() => setCurrentView('cart')} aria-label="장바구니" style={{ position: 'relative', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', color: THEME.text }}>
            <ShoppingBag size={23} />
            {cart.length > 0 && <span style={{ position: 'absolute', top: '-6px', right: '-8px', backgroundColor: THEME.primary, color: 'white', borderRadius: '10px', minWidth: '18px', height: '18px', lineHeight: '18px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>{cart.length}</span>}
          </button>
        </div>
      </header>

      {/* --- 🏠 홈 화면 --- */}
      {currentView === 'home' && (
        <div>
          <div style={{ padding: '30px 20px 0 20px', textAlign: 'center' }}>
            <p className="serif-text" style={{ color: THEME.brown, fontSize: '17px', marginBottom: '20px', lineHeight: '1.5', whiteSpace: 'pre-line' }}>{introMain}</p>
            <p className="serif-text" style={{ color: THEME.brown, fontSize: '14px', marginBottom: '30px', whiteSpace: 'pre-line' }}>{introSub}</p>
          </div>

          <div style={{ padding: '0 20px 20px 20px' }}>
            <div style={{ width: '100%', borderRadius: '20px', overflow: 'hidden', marginBottom: '20px', backgroundColor: '#fff', boxShadow: '0 4px 15px rgba(0,0,0,0.04)' }}>
               {mainBannerUrl ? (
                 <img src={mainBannerUrl} alt="배너" style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
               ) : ( <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#f9f9f9', color: THEME.subText, fontSize: '13px' }}>관리자 탭에서 메인 배너를 등록해주세요.</div> )}
            </div>

            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <input placeholder="상품명, 브랜드 검색" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', height: '46px', padding: '0 40px 0 42px', borderRadius: '23px', border: `1px solid ${THEME.border}`, backgroundColor: '#fff', fontSize: '14px' }} />
              <Search size={18} color={THEME.subText} style={{ position: 'absolute', left: '16px', top: '14px' }} />
              {searchQuery && <button onClick={() => setSearchQuery('')} aria-label="검색어 지우기" style={{ position: 'absolute', right: '12px', top: '11px', background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: THEME.subText, display: 'flex' }}><X size={18} /></button>}
            </div>

            {/* 1단 탭: 전체 | 브랜드 | 대분류 (상품이 있는 분류만) */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -20px', padding: '0 20px 10px' }}>
              <button onClick={selectAllTab} style={chipStyle(isAllTab, 'main')}>전체</button>
              <button onClick={selectBrandTab} style={chipStyle(isBrandTab, 'main')}>브랜드</button>
              {homeMainCats.map(main => (
                <button key={main} onClick={() => selectMainCat(main)} style={chipStyle(activeLargeCat === main, 'main')}>{main}</button>
              ))}
            </div>
            {/* 2단: 브랜드 목록 또는 중분류 */}
            {showBrandRow ? (
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -20px', padding: '2px 20px 10px' }}>
                <button onClick={() => setActiveBrand('전체')} style={chipStyle(activeBrand === '전체', 'sub')}>모든 브랜드</button>
                {homeBrands.map(b => (
                  <button key={b.name} onClick={() => setActiveBrand(b.name)} style={chipStyle(activeBrand === b.name, 'sub')}>{b.name} <span style={{ opacity: 0.6 }}>{b.count}</span></button>
                ))}
              </div>
            ) : activeLargeCat !== '전체' && homeSubCats.length > 0 ? (
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -20px', padding: '2px 20px 10px' }}>
                <button onClick={() => setActiveSmallCat('전체')} style={chipStyle(activeSmallCat === '전체', 'sub')}>{activeLargeCat} 전체</button>
                {homeSubCats.map(sub => (
                  <button key={sub} onClick={() => setActiveSmallCat(sub)} style={chipStyle(activeSmallCat === sub, 'sub')}>{sub}</button>
                ))}
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0 12px', fontSize: '13px', color: THEME.subText }}>
              <span>총 <strong style={{ color: THEME.text }}>{displayProducts.length.toLocaleString()}</strong>개</span>
              <span>{currentPage} / {totalPages} 페이지</span>
            </div>

            {currentProducts.length > 0 ? (
              <>
                <div ref={productListRef} style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`, columnGap: gridCols === 3 ? '8px' : '12px', rowGap: gridCols === 3 ? '18px' : '24px' }}>
                  {currentProducts.map((p) => {
                    const small = gridCols === 3;
                    const line = (fontSize: string, color: string, extra: React.CSSProperties = {}) => ({ fontSize, color, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, ...extra });
                    const soldout = !!p.is_soldout;
                    const listPrice = getListPrice(p, shopSettings.list_price_rate);
                    const discount = getDiscountRate(p.price, listPrice);
                    return (
                      <div key={p.id} onClick={() => openProductDetail(p)} style={{ cursor: 'pointer', minWidth: 0, display: 'flex', flexDirection: 'column', opacity: soldout ? 0.75 : 1 }}>
                        <div style={{ position: 'relative', marginBottom: small ? '6px' : '10px' }}>
                          <img src={p.main_image} loading="lazy" style={{ width: '100%', borderRadius: small ? '8px' : '12px', aspectRatio: '4/5', objectFit: 'cover', backgroundColor: '#eee', display: 'block', filter: soldout ? 'grayscale(0.6)' : 'none' }} />
                          {!soldout && isNewProduct(p.created_at) && <span style={{ position: 'absolute', top: small ? '5px' : '8px', left: small ? '5px' : '8px', backgroundColor: THEME.primary, color: 'white', padding: small ? '2px 6px' : '3px 8px', borderRadius: '5px', fontSize: small ? '9px' : '10px', fontWeight: 'bold' }}>NEW</span>}
                          {soldout && (
                            <div style={{ position: 'absolute', inset: 0, borderRadius: small ? '8px' : '12px', backgroundColor: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ backgroundColor: 'rgba(40,40,40,0.82)', color: '#fff', padding: small ? '4px 8px' : '6px 12px', borderRadius: '6px', fontSize: small ? '11px' : '13px', fontWeight: 'bold', letterSpacing: '1px' }}>SOLD OUT</span>
                            </div>
                          )}
                        </div>
                        <p style={line(small ? '11px' : '12px', THEME.primary, { fontWeight: 'bold', marginBottom: '2px' })}>{p.brand || '자체제작'}</p>
                        {/* 상품명 2줄 고정 → 한 줄에 있는 카드들의 높이가 같아짐 */}
                        <h3 style={{ fontSize: small ? '12px' : '14px', margin: '0 0 4px 0', fontWeight: 500, color: THEME.text, lineHeight: 1.35, height: small ? '32px' : '38px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, wordBreak: 'keep-all' }}>{p.name}</h3>
                        <p style={line(small ? '10.5px' : '12px', THEME.subText, { marginBottom: '1px' })}>{p.sizes ? summarizeOptions(p.sizes, small ? 4 : 6) : ' '}</p>
                        <p style={line(small ? '10.5px' : '12px', THEME.subText, { marginBottom: small ? '4px' : '6px' })}>{p.colors ? summarizeOptions(p.colors, small ? 2 : 3) : ' '}</p>
                        {/* 정가 줄은 항상 같은 높이 → 정가 없는 상품도 카드 높이가 맞음 */}
                        <p style={line(small ? '10.5px' : '12px', '#aaa', { textDecoration: discount ? 'line-through' : 'none', height: small ? '14px' : '16px' })}>{discount ? `${listPrice.toLocaleString()}원` : ' '}</p>
                        <p style={{ fontSize: small ? '14px' : '16px', fontWeight: 'bold', color: THEME.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {discount > 0 && <span style={{ color: '#e53935', marginRight: small ? '3px' : '5px' }}>{discount}%</span>}
                          {p.price.toLocaleString()}원
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: '40px', paddingBottom: '20px' }}>
                  {renderPagination(currentPage, totalPages, goHomePage, THEME.primary)}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 0', color: THEME.subText, fontSize: '15px' }}>등록된 상품이 없습니다.</div>
            )}
          </div>
        </div>
      )}

      {/* --- 📁 카테고리 --- */}
      {currentView === 'category' && (
        <div style={{ padding: '20px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '20px', fontWeight: 'bold' }}>전체 카테고리</h2>

          <div style={{ backgroundColor: '#fff', borderRadius: '15px', padding: '10px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: '15px', color: THEME.primary, padding: '10px', borderBottom: `1px solid ${THEME.border}`, fontWeight: 'bold' }}>브랜드관</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', padding: '10px 5px' }}>
              <div onClick={() => { setActiveBrand('전체'); handleGoHome(); }} style={{ width: '50%', padding: '12px 10px', fontSize: '15px', cursor: 'pointer', fontWeight: activeBrand === '전체' ? 'bold' : 'normal', color: activeBrand === '전체' ? THEME.primary : THEME.text }}>전체 브랜드 ({products.length})</div>
              {brands.map(b => (
                <div key={b.id} onClick={() => { setActiveBrand(b.name); handleGoHome(); }} style={{ width: '50%', padding: '12px 10px', fontSize: '15px', cursor: 'pointer', fontWeight: activeBrand === b.name ? 'bold' : 'normal', color: activeBrand === b.name ? THEME.primary : THEME.text }}>
                  {b.name} <span style={{fontSize:'13px', color:THEME.subText}}>({getBrandCount(b.name)})</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: '#fff', borderRadius: '15px', padding: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: '15px', color: THEME.primary, padding: '10px', borderBottom: `1px solid ${THEME.border}`, fontWeight: 'bold' }}>아이템별</h3>
            <div onClick={() => { setActiveLargeCat('전체'); setActiveSmallCat('전체'); handleGoHome(); }} style={{ padding: '15px 10px', borderBottom: `1px solid ${THEME.border}`, fontSize: '15px', cursor: 'pointer', fontWeight: 'bold' }}>모든 상품 보기 ({products.length})</div>
            {Object.keys(categoryTree).map(mainCat => (
              <div key={mainCat}>
                <div onClick={() => setExpandedCats({...expandedCats, [mainCat]: !expandedCats[mainCat]})} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 10px', borderBottom: `1px solid ${THEME.border}`, fontSize: '15px', cursor: 'pointer' }}>
                  <span style={{ fontWeight: '500' }}>{mainCat} <span style={{fontSize:'13px', color:THEME.subText}}>({getLargeCatCount(mainCat)})</span></span>
                  {expandedCats[mainCat] ? <ChevronUp size={20} color={THEME.subText} /> : <ChevronDown size={20} color={THEME.subText} />}
                </div>
                {expandedCats[mainCat] && (
                  <div style={{ padding: '10px 10px 10px 20px', backgroundColor: '#FCFCFC' }}>
                    <div onClick={() => { setActiveLargeCat(mainCat); setActiveSmallCat('전체'); handleGoHome(); }} style={{ padding: '10px 0', fontSize: '14px', color: THEME.subText, cursor: 'pointer' }}>{mainCat} 전체 ({getLargeCatCount(mainCat)})</div>
                    {categoryTree[mainCat].map((sub: string) => (
                      <div key={sub} onClick={() => { setActiveLargeCat(mainCat); setActiveSmallCat(sub); handleGoHome(); }} style={{ padding: '10px 0', fontSize: '14px', color: THEME.subText, cursor: 'pointer' }}>- {sub} ({getSmallCatCount(mainCat, sub)})</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- 상세페이지 --- */}
      {currentView === 'detail' && selectedProduct && (
        <div style={{ paddingBottom: '100px', backgroundColor: '#fff' }}>
          <div style={{ width: '100%', height: '120vw', overflow: 'hidden' }}>
            <img src={selectedProduct.main_image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ padding: '24px 20px' }}>
            {isNewProduct(selectedProduct.created_at) && <span style={{ display: 'inline-block', backgroundColor: THEME.primary, color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', marginBottom: '10px' }}>✨ NEW</span>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <h2 style={{ fontSize: '22px', margin: 0, fontWeight: 'bold', lineHeight: '1.4' }}>{selectedProduct.name}</h2>
              <button onClick={handleShareProduct} style={{ backgroundColor: THEME.bg, border: `1px solid ${THEME.border}`, borderRadius: '50%', width: '36px', height: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginLeft: '10px' }}>
                <Share size={18} color={THEME.text} />
              </button>
            </div>
            <p style={{ fontSize: '13px', color: THEME.subText, margin: '0 0 10px 0' }}>{selectedProduct.sizes}</p>
            {(() => {
              const lp = getListPrice(selectedProduct, shopSettings.list_price_rate);
              const dc = getDiscountRate(selectedProduct.price, lp);
              return (
                <div style={{ margin: '0 0 24px 0' }}>
                  {dc > 0 && <p style={{ fontSize: '14px', color: '#aaa', textDecoration: 'line-through', margin: '0 0 2px 0' }}>{lp.toLocaleString()}원</p>}
                  <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
                    {dc > 0 && <span style={{ color: '#e53935', marginRight: '8px' }}>{dc}%</span>}
                    {selectedProduct.price.toLocaleString()}원
                  </p>
                  {selectedProduct.is_soldout && <p style={{ display: 'inline-block', marginTop: '10px', padding: '6px 12px', borderRadius: '8px', backgroundColor: '#333', color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>품절된 상품입니다</p>}
                </div>
              );
            })()}
            <div style={{ height: '1px', backgroundColor: THEME.border, margin: '20px 0' }}></div>

            {selectedProduct.colors && (
              <div style={{ marginBottom: '25px' }}>
                <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>색상</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {selectedProduct.colors.split(',').map((c: string) => (
                    <button key={c} disabled={isOptionSoldOut(c)} onClick={() => setSelectedColor(c.trim())} style={optionBtnStyle(selectedColor === c.trim(), isOptionSoldOut(c), '20px')}>{c.trim()}</button>
                  ))}
                </div>
              </div>
            )}
            {selectedProduct.sizes && (
              <div style={{ marginBottom: '25px' }}>
                <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>사이즈</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {selectedProduct.sizes.split(',').map((s: string) => (
                    <button key={s} disabled={isOptionSoldOut(s)} onClick={() => setSelectedSize(s.trim())} style={optionBtnStyle(selectedSize === s.trim(), isOptionSoldOut(s), '24px')}>{s.trim()}</button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '25px' }}>
               <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>수량</p>
               <div style={{ display: 'flex', alignItems: 'center', gap: '15px', backgroundColor: '#fff', border: `1px solid ${THEME.border}`, borderRadius: '25px', padding: '10px 15px', width: 'fit-content' }}>
                  <Minus size={18} color={quantity > 1 ? THEME.text : THEME.border} onClick={() => setQuantity(q => Math.max(1, q - 1))} style={{cursor:'pointer'}} />
                  <span style={{ fontSize: '16px', fontWeight: 'bold', width: '30px', textAlign: 'center' }}>{quantity}</span>
                  <Plus size={18} color={THEME.text} onClick={() => setQuantity(q => q + 1)} style={{cursor:'pointer'}} />
               </div>
            </div>

            {selectedProduct.description && (
              <div style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: '25px', marginTop: '10px' }}>
                <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '15px' }}>상품 설명</p>
                <p style={{ fontSize: '15px', lineHeight: '1.8', color: '#555', whiteSpace: 'pre-line', marginBottom: '30px' }}>{selectedProduct.description}</p>
              </div>
            )}
          </div>

          {selectedProduct.sub_images && (
            <div style={{ paddingBottom: '30px' }}>
              {selectedProduct.sub_images.split(',').map((url: string, idx: number) => (
                <img key={idx} src={url.trim()} style={{ width: '100%', display: 'block', marginBottom: '0' }} />
              ))}
            </div>
          )}

          <div style={{ position: 'fixed', bottom: 0, width: '100%', padding: '15px 20px', backgroundColor: '#fff', borderTop: `1px solid ${THEME.border}`, zIndex: 100 }}>
            <button onClick={addToCart} disabled={!!selectedProduct.is_soldout} style={{ width: '100%', padding: '16px', backgroundColor: selectedProduct.is_soldout ? '#bbb' : THEME.primary, color: 'white', border: 'none', borderRadius: '30px', fontSize: '16px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: selectedProduct.is_soldout ? 'none' : '0 4px 15px rgba(240,106,125,0.2)', cursor: selectedProduct.is_soldout ? 'default' : 'pointer' }}>
               {selectedProduct.is_soldout ? '품절된 상품입니다' : <><ShoppingBag size={20} /> 담기</>}
            </button>
          </div>

          {showCartModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(2px)' }}>
              <div style={{ backgroundColor: '#fff', padding: '35px 20px 25px 20px', borderRadius: '24px', width: '85%', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                <CheckCircle color={THEME.primary} size={50} style={{ margin: '0 auto 15px auto' }} />
                <p style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '30px', color: THEME.text }}>장바구니에 상품이 담겼습니다.</p>
                <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                  <button onClick={() => { setShowCartModal(false); setCurrentView('cart'); }} style={{ width: '100%', padding: '16px', backgroundColor: THEME.primary, color: 'white', borderRadius: '30px', fontWeight: 'bold', fontSize: '15px', border: 'none' }}>장바구니로 가기</button>
                  <button onClick={() => { setShowCartModal(false); handleGoHome(); }} style={{ width: '100%', padding: '16px', backgroundColor: '#fff', color: THEME.text, border: `1px solid ${THEME.border}`, borderRadius: '30px', fontWeight: 'bold', fontSize: '15px' }}>계속 쇼핑하기</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- 장바구니 --- */}
      {currentView === 'cart' && (
        <div style={{ padding: '20px', backgroundColor: '#fff', minHeight: '100vh' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0' }}>장바구니</h2>
            <span style={{ fontSize: '13px', color: THEME.subText, cursor: 'pointer' }} onClick={() => setCart([])}>전체삭제</span>
          </div>

          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
               <ShoppingBag size={50} color={THEME.border} style={{margin: '0 auto 15px auto'}} />
               <p style={{ color: THEME.subText, fontSize: '15px' }}>장바구니가 비어있습니다.</p>
            </div>
          ) : (
            <div>
              {cart.map((item) => (
                <div key={item.cartId} style={{ display: 'flex', gap: '15px', padding: '15px 0', borderBottom: `1px solid ${THEME.border}`, position: 'relative', alignItems: 'center' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: THEME.primary, display: 'flex', justifyContent: 'center', alignItems: 'center' }}><CheckCircle color="#fff" size={14} /></div>
                  <img src={item.main_image} style={{ width: '70px', height: '90px', borderRadius: '10px', objectFit: 'cover' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 'bold', color: THEME.text }}>{item.name}</p>
                    {(item.selectedSize || item.selectedColor) && <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: THEME.subText }}>{[item.selectedColor, item.selectedSize].filter(Boolean).join(' / ')}</p>}
                    <p style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold' }}>{(item.price * item.quantity).toLocaleString()}원</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#fff', border: `1px solid ${THEME.border}`, borderRadius: '20px', padding: '4px 10px', width: 'fit-content' }}>
                       <span style={{fontSize:'12px', color:THEME.subText}}>수량: {item.quantity}</span>
                    </div>
                  </div>
                  <Trash2 size={20} color="#ccc" style={{ position: 'absolute', top: '15px', right: '0', cursor: 'pointer' }} onClick={() => removeFromCart(item.cartId)} />
                </div>
              ))}

              <div style={{ padding: '15px', backgroundColor: THEME.primaryLight, borderRadius: '12px', marginTop: '20px', fontSize: '13px', color: THEME.primary, lineHeight: '1.5' }}>
                📢 <strong>기본 배송비 {shopSettings.shipping_fee.toLocaleString()}원</strong><br/> <span style={{color: THEME.text}}>* 여러 브랜드 주문 시 합배송 등의 이유로 배송비가 추가될 수 있습니다.</span>
              </div>

              <div style={{ marginTop: '30px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: '15px', color: THEME.text }}><span>총 {cart.length}개 상품</span><span style={{fontSize:'18px', fontWeight:'bold', color: THEME.primary}}>총 {totalItemAmount.toLocaleString()}원</span></div>
              </div>

              <button onClick={() => setCurrentView('orderForm')} style={{ width: '100%', padding: '16px', backgroundColor: THEME.primary, color: 'white', border: 'none', borderRadius: '30px', fontSize: '16px', fontWeight: 'bold', marginTop: '20px', boxShadow: '0 4px 15px rgba(240,106,125,0.2)' }}>주문하기</button>
            </div>
          )}
        </div>
      )}

      {/* --- 주문 폼 --- */}
      {currentView === 'orderForm' && (
        <div style={{ padding: '20px', backgroundColor: '#fff', minHeight: '100vh' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '25px', fontWeight: 'bold' }}>주문자 정보</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
             <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', color: THEME.text, display: 'block', marginBottom: '8px' }}>이름 <span style={{color: THEME.primary}}>*</span></label>
                <input placeholder="이름을 입력해주세요" value={orderName} onChange={e => setOrderName(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${THEME.border}`, fontSize: '15px' }} />
             </div>
             <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', color: THEME.text, display: 'block', marginBottom: '8px' }}>연락처 <span style={{color: THEME.primary}}>*</span></label>
                <input placeholder="010-0000-0000" value={orderPhone} onChange={e => setOrderPhone(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${THEME.border}`, fontSize: '15px' }} />
             </div>
             <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', color: THEME.text, display: 'block', marginBottom: '8px' }}>배송지 <span style={{color: THEME.primary}}>*</span></label>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <input placeholder="주소를 검색해주세요" value={orderAddress} onChange={e => setOrderAddress(e.target.value)} readOnly style={{ flex: 1, padding: '15px', borderRadius: '12px', border: `1px solid ${THEME.border}`, fontSize: '15px', backgroundColor: '#f9f9f9' }} />
                  <button onClick={handleSearchAddress} style={{ padding: '0 20px', backgroundColor: THEME.text, color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>주소 검색</button>
                </div>
                <input placeholder="상세 주소를 입력해주세요" value={orderDetailAddress} onChange={e => setOrderDetailAddress(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${THEME.border}`, fontSize: '15px' }} />
             </div>
             <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', color: THEME.text, display: 'block', marginBottom: '8px' }}>요청사항</label>
                <textarea placeholder="예) 빠른 배송 부탁드려요 :)" rows={3} value={orderMemo} onChange={e => setOrderMemo(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${THEME.border}`, fontSize: '15px', resize: 'none' }} />
             </div>
          </div>
          <button onClick={() => { if (!orderName || !orderPhone || !orderAddress) return alert("필수 정보를 모두 입력해주세요!"); setCurrentView('quotationPreview'); }} style={{ width: '100%', padding: '16px', backgroundColor: THEME.primary, color: 'white', border: 'none', borderRadius: '30px', fontSize: '16px', fontWeight: 'bold', marginTop: '30px' }}>견적서 확인하기</button>
        </div>
      )}

      {/* --- 견적서 --- */}
      {currentView === 'quotationPreview' && (
        <div style={{ padding: '20px', backgroundColor: '#fff', minHeight: '100vh' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', textAlign: 'center', marginBottom: '30px' }}>주문 견적서</h2>

          <div style={{ border: `1px solid ${THEME.border}`, borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '20px', color: THEME.primary, textAlign: 'center', margin: '0 0 20px 0', fontWeight: '800' }}>{shopSettings.shop_name_kr} 주문 견적서</h3>
            <div style={{ fontSize: '14px', color: THEME.text, lineHeight: '2' }}>
              <div style={{display:'flex'}}><span style={{width:'80px', color:THEME.subText}}>주문일</span> <span>{new Date().toLocaleString()}</span></div>
              <div style={{display:'flex'}}><span style={{width:'80px', color:THEME.subText}}>주문자</span> <span>{orderName}</span></div>
              <div style={{display:'flex'}}><span style={{width:'80px', color:THEME.subText}}>연락처</span> <span>{orderPhone}</span></div>
              <div style={{display:'flex'}}><span style={{width:'80px', color:THEME.subText}}>배송지</span> <span>{orderAddress} {orderDetailAddress}</span></div>
            </div>
            <div style={{ height: '1px', backgroundColor: THEME.border, margin: '20px 0' }}></div>
            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: THEME.subText, borderBottom: `1px solid ${THEME.border}` }}>
                  <th style={{ textAlign: 'left', padding: '10px 0', fontWeight:'normal' }}>상품명</th><th style={{ textAlign: 'center', padding: '10px 0', fontWeight:'normal' }}>수량</th><th style={{ textAlign: 'right', padding: '10px 0', fontWeight:'normal' }}>금액</th>
                </tr>
              </thead>
              <tbody>
                {cart.map(item => (
                  <tr key={item.cartId} style={{ borderBottom: `1px solid ${THEME.border}` }}>
                    <td style={{ padding: '15px 0' }}>{item.name} <br/><span style={{ fontSize: '12px', color: THEME.subText }}>{[item.selectedColor, item.selectedSize].filter(Boolean).join(' / ')}</span></td>
                    <td style={{ textAlign: 'center', padding: '15px 0' }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right', padding: '15px 0' }}>{(item.price * item.quantity).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: '20px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '10px' }}><span style={{color:THEME.subText}}>상품 합계</span><span style={{fontWeight:'bold'}}>{totalItemAmount.toLocaleString()}원</span></div>
               <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '20px' }}><span style={{color:THEME.subText}}>기본 배송비</span><span style={{fontWeight:'bold'}}>{totalShippingFee.toLocaleString()}원</span></div>
               <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold', color: THEME.primary, padding: '15px 0', borderTop: `1px solid ${THEME.border}`, backgroundColor: THEME.primaryLight, borderRadius: '8px', paddingLeft:'15px', paddingRight:'15px' }}>
                 <span>최종 견적금액</span><span>{totalOrderAmount.toLocaleString()}원</span>
               </div>
            </div>
          </div>
          <p style={{fontSize:'11px', color:THEME.subText, textAlign:'center', marginBottom:'20px'}}>※ 본 견적서는 주문 확인용으로, 실제 결제 금액과 차이가 있을 수 있습니다.</p>
          <button onClick={submitOrder} disabled={isSubmittingOrder} style={{ width: '100%', padding: '16px', backgroundColor: isSubmittingOrder ? '#ccc' : THEME.primary, color: 'white', border: 'none', borderRadius: '30px', fontSize: '16px', fontWeight: 'bold' }}>{isSubmittingOrder ? '주문 접수 중...' : '주문하기'}</button>
        </div>
      )}

      {/* --- 주문 완료 --- */}
      {currentView === 'orderComplete' && currentOrder && (
        <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#fff', minHeight: '100vh' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}><CheckCircle size={60} color={THEME.primary} /></div>
          <h2 style={{ fontSize: '24px', marginBottom: '15px', fontWeight:'bold' }}>주문이 완료되었습니다!</h2>
          <p style={{ color: THEME.subText, fontSize: '15px', marginBottom: '40px', lineHeight: '1.6' }}>정성껏 준비하여 빠르게 배송해드릴게요.<br/>감사합니다. ♡</p>
          <div style={{ border: `1px solid ${THEME.border}`, borderRadius: '16px', padding: '25px', textAlign: 'left', marginBottom: '30px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'15px', fontSize:'14px' }}>
               <span style={{color:THEME.subText}}>주문번호</span> <span style={{fontWeight:'500'}}>{currentOrder.order_number}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'15px', fontSize:'14px' }}>
               <span style={{color:THEME.subText}}>주문일</span> <span style={{fontWeight:'500'}}>{new Date(currentOrder.created_at).toLocaleString()}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:'20px', paddingTop:'20px', borderTop:`1px solid ${THEME.border}`, fontSize:'16px', fontWeight:'bold' }}>
               <span>최종금액</span> <span style={{color:THEME.primary}}>{currentOrder.total_amount.toLocaleString()}원</span>
            </div>
          </div>
          <div style={{ backgroundColor: '#F9F9F9', padding: '20px', borderRadius: '12px', marginBottom: '30px' }}>
            <p style={{ fontSize: '13px', color: THEME.subText, margin: '0 0 8px 0' }}>입금 계좌번호</p>
            <p style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 5px 0', color: THEME.text }}>{bankInfo.bank_name} {bankInfo.account_number}</p>
            <p style={{ fontSize: '14px', margin: 0, color: THEME.subText }}>예금주: {bankInfo.depositor_name}</p>
          </div>
          <p style={{ fontSize: '13px', color: THEME.primary, fontWeight: 'bold', margin: '0 0 10px 0' }}>⬇️ 아래 버튼을 눌러 주문서를 꼭 보내주세요</p>
          <button onClick={handleSendOrderSheet} style={{ width: '100%', padding: '18px', backgroundColor: THEME.primary, color: 'white', border: 'none', borderRadius: '30px', fontSize: '17px', fontWeight: 'bold', marginBottom: '30px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(240,106,125,0.3)' }}><Send size={20} /> 주문서 전송하기</button>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '30px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => window.open(shopSettings.community_url || DEFAULT_COMMUNITY_URL, '_blank')}>
              <div style={{ backgroundColor: '#FEE500', padding: '15px', borderRadius: '50%' }}><Megaphone size={20} color="#191919" /></div>
              <span style={{ fontSize: '13px', color: THEME.text }}>📢 신상 소식방</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setCurrentView('lookup')}>
              <div style={{ backgroundColor: '#fff', border:`1px solid ${THEME.border}`, padding: '15px', borderRadius: '50%' }}><FileText size={20} color={THEME.text} /></div>
              <span style={{ fontSize: '13px', color: THEME.text }}>주문내역 보기</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={handleGoHome}>
              <div style={{ backgroundColor: '#fff', border:`1px solid ${THEME.border}`, padding: '15px', borderRadius: '50%' }}><Home size={20} color={THEME.text} /></div>
              <span style={{ fontSize: '13px', color: THEME.text }}>홈으로 가기</span>
            </div>
          </div>

          {showOrderSentModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(2px)', padding: '16px', boxSizing: 'border-box' }}>
              <div style={{ backgroundColor: '#fff', borderRadius: '24px', width: '100%', maxWidth: '380px', maxHeight: '90vh', overflowY: 'auto', textAlign: 'left', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
                <div style={{ backgroundColor: THEME.primaryLight, padding: '22px 20px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', lineHeight: 1, marginBottom: '8px' }}>🎀</div>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: THEME.primary, margin: '0 0 4px 0' }}>주문이 접수되었어요!</h3>
                  <p style={{ fontSize: '13px', color: THEME.text, margin: 0 }}>아래 <strong>두 단계</strong>만 마치면 주문이 확정돼요</p>
                </div>
                <div style={{ padding: '20px' }}>
                  {/* ① 입금 */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
                    <span style={stepBadgeStyle}>1</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '15px', fontWeight: 'bold', color: THEME.text, margin: '2px 0 8px 0' }}>아래 계좌로 입금해주세요</p>
                      <div style={{ backgroundColor: THEME.bg, borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '14.5px', fontWeight: 'bold', margin: '0 0 2px 0', color: THEME.text, wordBreak: 'break-all' }}>{bankInfo.bank_name} {bankInfo.account_number}</p>
                          <p style={{ fontSize: '12.5px', margin: '0 0 4px 0', color: THEME.subText }}>예금주 {bankInfo.depositor_name}</p>
                          <p style={{ fontSize: '17px', fontWeight: 'bold', margin: 0, color: THEME.primary }}>{currentOrder.total_amount.toLocaleString()}원</p>
                        </div>
                        <button onClick={handleCopyAccount} style={smallActionStyle}><Copy size={13} /> 계좌 복사</button>
                      </div>
                    </div>
                  </div>
                  {/* ② 입금 후 주문서 전송 */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
                    <span style={stepBadgeStyle}>2</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '15px', fontWeight: 'bold', color: THEME.text, margin: '2px 0 2px 0' }}>입금 후 1:1 채팅으로 주문서 전송</p>
                      <p style={{ fontSize: '12px', color: THEME.subText, margin: '0 0 8px 0' }}>채팅방 입력칸을 꾹 눌러 '붙여넣기' 하면 아래 내용이 들어가요</p>
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '12.5px', lineHeight: 1.6, color: THEME.text, backgroundColor: THEME.bg, padding: '12px 14px', borderRadius: '12px', margin: '0 0 8px 0', userSelect: 'all' }}>{buildOrderSheet(currentOrder)}</pre>
                      <button onClick={handleCopyOrderSheet} style={smallActionStyle}><Copy size={13} /> 주문서 복사</button>
                    </div>
                  </div>
                  <button onClick={handleOpenChatWithSheet} style={{ width: '100%', padding: '16px', backgroundColor: '#FEE500', color: '#191919', border: 'none', borderRadius: '30px', fontSize: '16px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '6px', cursor: 'pointer' }}><KakaoIcon size={20} /> 주문서 복사하고 1:1 채팅방 열기</button>
                  <p style={{ fontSize: '12.5px', textAlign: 'center', color: THEME.subText, margin: '8px 0 6px 0' }}>💛 입금 확인 후 주문 접수를 도와드릴게요</p>
                  <button onClick={() => setShowOrderSentModal(false)} style={{ width: '100%', padding: '10px', backgroundColor: 'transparent', color: THEME.subText, border: 'none', fontSize: '14px', cursor: 'pointer' }}>닫기</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- 주문 내역 조회 --- */}
      {currentView === 'lookup' && (
        <div style={{ padding: '20px', backgroundColor: '#fff', minHeight: '100vh' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '20px', fontWeight: 'bold' }}>주문 내역 조회</h2>

          <div style={{ border: `1px solid ${THEME.border}`, padding: '25px 20px', borderRadius: '16px' }}>
            <p style={{ fontSize: '14px', color: THEME.text, marginBottom: '20px', textAlign: 'center', lineHeight: '1.5' }}>
              안전한 개인정보 보호를 위해<br/><strong>연락처</strong>와 함께 <strong>주문번호</strong> 또는 <strong>이름</strong>을 입력해주세요.
            </p>

            <label style={{ fontSize: '13px', fontWeight: 'bold', color: THEME.text, display: 'block', marginBottom: '8px' }}>연락처 (필수) <span style={{color: THEME.primary}}>*</span></label>
            <input placeholder="예: 010-0000-0000" value={lookupPhone} onChange={e => setLookupPhone(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${THEME.border}`, marginBottom: '15px', fontSize: '14px', backgroundColor: '#f9f9f9' }} />

            <div style={{ display: 'flex', alignItems: 'center', margin: '15px 0', color: THEME.border, fontSize: '13px' }}>
              <hr style={{ flex: 1, border: 'none', borderTop: `1px solid ${THEME.border}` }} /> <span style={{ padding: '0 15px', color: THEME.subText, fontWeight: 'bold' }}>AND</span> <hr style={{ flex: 1, border: 'none', borderTop: `1px solid ${THEME.border}` }} />
            </div>

            <label style={{ fontSize: '13px', fontWeight: 'bold', color: THEME.text, display: 'block', marginBottom: '8px' }}>주문번호 (또는 이름 입력)</label>
            <input placeholder="HM-00000000-000" value={lookupOrderNumber} onChange={e => setLookupOrderNumber(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${THEME.border}`, marginBottom: '10px', fontSize: '14px' }} />

            <p style={{ fontSize: '13px', color: THEME.subText, textAlign: 'center', margin: '10px 0' }}>또는</p>

            <label style={{ fontSize: '13px', fontWeight: 'bold', color: THEME.text, display: 'block', marginBottom: '8px' }}>주문자 이름</label>
            <input placeholder="이름을 입력해주세요" value={lookupName} onChange={e => setLookupName(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${THEME.border}`, marginBottom: '25px', fontSize: '14px' }} />

            <button onClick={searchMyOrder} style={{ width: '100%', padding: '16px', backgroundColor: THEME.primary, color: 'white', border: 'none', borderRadius: '30px', fontWeight: 'bold', fontSize: '16px' }}>조회하기</button>
          </div>

          {myOrders.length > 0 && (
            <div style={{ marginTop: '30px' }}>
              {myOrders.map((order, idx) => {
                const isEditingInfo = editingCustomerOrderId === order.id;
                const itemTotal = order.order_items ? order.order_items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) : 0;
                const shippingFee = order.total_amount - itemTotal;

                return (
                  <div key={idx} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '16px', marginBottom: '20px', border: `1px solid ${THEME.primary}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                      <div>
                        <p style={{ fontSize: '13px', color: THEME.subText, marginBottom: '5px' }}>{new Date(order.created_at).toLocaleString()}</p>
                        <p style={{ fontSize: '15px', fontWeight: 'bold', margin: 0 }}>{order.order_number}</p>
                      </div>
                      <span style={{ padding: '6px 12px', backgroundColor: getStatusStyle(order.status).bg, color: getStatusStyle(order.status).text, borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>{order.status}</span>
                    </div>
                    {isEditingInfo ? (
                      <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '12px', marginBottom: '15px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '10px' }}>배송지 정보 수정 (입금대기 상태만 가능)</p>
                        <input placeholder="이름" value={editOrderInputs.name} onChange={e => setEditOrderInputs({...editOrderInputs, name: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${THEME.border}`, marginBottom: '8px', fontSize: '13px' }} />
                        <input placeholder="연락처" value={editOrderInputs.phone} onChange={e => setEditOrderInputs({...editOrderInputs, phone: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${THEME.border}`, marginBottom: '8px', fontSize: '13px' }} />
                        <input placeholder="배송지 주소" value={editOrderInputs.address} onChange={e => setEditOrderInputs({...editOrderInputs, address: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${THEME.border}`, marginBottom: '8px', fontSize: '13px' }} />
                        <input placeholder="요청사항" value={editOrderInputs.memo} onChange={e => setEditOrderInputs({...editOrderInputs, memo: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${THEME.border}`, marginBottom: '15px', fontSize: '13px' }} />
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button onClick={() => setEditingCustomerOrderId(null)} style={{ flex: 1, padding: '12px', backgroundColor: '#ddd', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold' }}>취소</button>
                          <button onClick={() => saveCustomerEdit(order.id)} style={{ flex: 1, padding: '12px', backgroundColor: THEME.primary, color: 'white', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', border: 'none' }}>저장</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ backgroundColor: THEME.bg, padding: '15px', borderRadius: '12px', marginBottom: '20px', fontSize: '14px', color: '#555', position: 'relative' }}>
                        <p style={{ margin: '0 0 6px 0', fontWeight:'bold', color: THEME.text }}>{order.customer_name} <span style={{fontWeight:'normal', color:THEME.subText}}>({order.phone})</span></p>
                        <p style={{ margin: '0 0 6px 0', lineHeight:'1.4' }}>{order.address}</p>
                        {order.memo && <p style={{ margin: 0, color: THEME.primary }}>요청사항: {order.memo}</p>}
                        {order.status === '입금대기' && (
                          <button onClick={() => openCustomerEdit(order)} style={{ position: 'absolute', top: '15px', right: '15px', padding: '6px 12px', fontSize: '12px', border: `1px solid ${THEME.border}`, backgroundColor: '#fff', borderRadius: '20px', fontWeight:'bold' }}>수정</button>
                        )}
                      </div>
                    )}

                    {/* 상세 주문 내역 (브랜드 분리) */}
                    <div style={{ borderTop: `1px dashed ${THEME.border}`, paddingTop: '20px', marginBottom: '20px' }}>
                      <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '15px', color: THEME.text }}>주문 상품 상세</p>
                      {order.order_items && order.order_items.map((item:any, i:number) => renderOrderItem(item, i))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: THEME.subText, marginBottom: '10px' }}>
                      <span>상품 합계</span><span>{itemTotal.toLocaleString()}원</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: THEME.subText, marginBottom: '20px' }}>
                      <span>배송비</span><span>{shippingFee.toLocaleString()}원</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${THEME.border}`, paddingTop: '20px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 'bold' }}>최종 결제 금액</span>
                      <span style={{ fontSize: '22px', fontWeight: 'bold', color: THEME.primary }}>{order.total_amount.toLocaleString()}원</span>
                    </div>

                    {order.tracking_number && <p style={{ fontSize: '14px', color: THEME.primary, marginTop: '20px', backgroundColor: THEME.primaryLight, padding: '15px', borderRadius: '12px', textAlign: 'center', fontWeight: 'bold' }}>📦 송장번호: {order.tracking_number}</p>}
                    {order.admin_memo && <p style={{ fontSize: '14px', color: '#c62828', marginTop: '10px', backgroundColor: '#ffebee', padding: '15px', borderRadius: '12px' }}>📢 판매자 안내: {order.admin_memo}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- 관리자 모드 --- */}
      {currentView === 'adminLogin' && (
        <div style={{ padding: '50px 20px', textAlign: 'center', backgroundColor: '#fff', minHeight: '100vh' }}>
          <Lock size={50} color={THEME.primary} style={{ margin: '0 auto 20px auto' }} />
          <h3 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '30px' }}>관리자 접속</h3>
          <input type="email" autoComplete="username" placeholder="관리자 이메일" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: `1px solid ${THEME.border}`, marginBottom: '10px', fontSize: '15px', textAlign: 'center' }} />
          <div style={{ position: 'relative', marginBottom: '20px' }}>
            <input type={showAdminPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="비밀번호" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAdminLogin(); }} style={{ width: '100%', padding: '16px 48px', borderRadius: '12px', border: `1px solid ${THEME.border}`, fontSize: '15px', textAlign: 'center', boxSizing: 'border-box' }} />
            <button type="button" onClick={() => setShowAdminPassword(v => !v)} aria-label={showAdminPassword ? '비밀번호 숨기기' : '비밀번호 보기'} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: THEME.subText, display: 'flex' }}>
              {showAdminPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <button onClick={handleAdminLogin} disabled={isLoggingIn} style={{ width: '100%', padding: '16px', backgroundColor: isLoggingIn ? '#ccc' : THEME.primary, color: 'white', border: 'none', borderRadius: '30px', fontWeight: 'bold', fontSize: '16px' }}>{isLoggingIn ? '확인 중...' : '접속하기'}</button>
        </div>
      )}

      {currentView === 'admin' && (
        <div style={{ padding: '16px 16px 100px', maxWidth: '720px', margin: '0 auto' }}>
          {/* 관리자 상단: 제목 + 로그아웃 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={20} color={THEME.primary} />
              <span style={{ fontSize: '17px', fontWeight: 'bold' }}>관리자 모드</span>
            </div>
            <button onClick={handleAdminLogout} style={A.smallBtn('danger')}>로그아웃</button>
          </div>

          {/* 탭: 5칸 같은 너비 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '4px', backgroundColor: '#fff', border: `1px solid ${THEME.border}`, borderRadius: '14px', padding: '4px', marginBottom: '16px', position: 'sticky', top: '64px', zIndex: 50 }}>
            {([
              ['orders', '주문', FileText, () => setAdminTab('orders')],
              ['productAdd', '상품등록', Plus, () => { setAdminTab('productAdd'); resetProductForm(); }],
              ['productEdit', '상품관리', List, () => { setAdminTab('productEdit'); setAdminEditPage(1); }],
              ['dashboard', '매출', TrendingUp, () => setAdminTab('dashboard')],
              ['settings', '설정', LayoutGrid, () => setAdminTab('settings')],
            ] as [string, string, any, () => void][]).map(([key, label, Icon, onClick]) => {
              const active = adminTab === key || (key === 'productAdd' && adminTab === 'productAdd');
              return (
                <button key={key} onClick={onClick} style={{ position: 'relative', height: '52px', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', backgroundColor: active ? THEME.primary : 'transparent', color: active ? '#fff' : THEME.subText, fontSize: '11.5px', fontWeight: 'bold' }}>
                  <Icon size={18} />{label}
                  {key === 'orders' && newOrderCount > 0 && (
                    <span style={{ position: 'absolute', top: '4px', right: '6px', minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '9px', backgroundColor: '#e53935', color: '#fff', fontSize: '10.5px', lineHeight: '18px', textAlign: 'center' }}>{newOrderCount}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 📊 매출/수익 */}
          {adminTab === 'dashboard' && (
            <div>
              <div style={A.card}>
                <p style={A.cardTitle}>매출 요약</p>
                <p style={A.help}>결제완료 · 배송지연 · 발송완료 주문만 합산합니다. (주문 {stats.orderCount}건)</p>
              </div>
              <div style={{ ...A.row2, marginBottom: '14px' }}>
                {[
                  ['총 결제금액', stats.totalOrderAmount, THEME.primary, '고객 실 입금액'],
                  ['순수익', stats.netProfit, '#2e7d32', stats.totalProductSales > 0 ? `마진율 ${Math.round(stats.netProfit / stats.totalProductSales * 100)}%` : '상품매출 - 매입원가'],
                  ['상품 매출', stats.totalProductSales, THEME.text, '배송비 제외'],
                  ['매입 원가', stats.totalCost, '#c62828', '도매가 합계'],
                ].map(([label, value, color, sub]) => (
                  <div key={label as string} style={{ ...A.card, marginBottom: 0 }}>
                    <p style={{ fontSize: '12.5px', color: THEME.subText, margin: '0 0 8px 0' }}>{label}</p>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: color as string, margin: '0 0 4px 0' }}>{(value as number).toLocaleString()}원</p>
                    <p style={{ fontSize: '11.5px', color: THEME.subText, margin: 0 }}>{sub}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 🧾 주문 관리 */}
          {adminTab === 'orders' && (() => {
            const q = orderSearch.trim().replace(/\s+/g, '');
            const qDigits = q.replace(/[^0-9]/g, '');
            const visibleOrders = filteredAdminOrders.filter(o => !q
              || (o.customer_name || '').replace(/\s+/g, '').includes(q)
              || (o.order_number || '').includes(q)
              || (qDigits.length >= 3 && (o.phone || '').replace(/[^0-9]/g, '').includes(qDigits)));
            const countOf = (s: string) => adminOrders.filter(o => o.status === s).length;
            const nextAction: Record<string, [string, string]> = { '입금대기': ['결제완료', '입금 확인'], '결제완료': ['발송완료', '발송 완료'], '배송지연': ['발송완료', '발송 완료'] };
            return (
              <div>
                {/* 🆕 지난번 확인 이후 들어온 주문 */}
                {newOrderCount > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', marginBottom: '10px', borderRadius: '12px', backgroundColor: '#fdecea', border: '1px solid #f5c2c0' }}>
                    <span style={{ flex: 1, fontSize: '13.5px', fontWeight: 'bold', color: '#c62828' }}>🆕 새 주문 {newOrderCount}건 (NEW 표시)</span>
                    <button onClick={() => markOrdersSeen()} style={A.smallBtn('outline')}>확인했어요</button>
                  </div>
                )}
                {/* 상태별 건수 = 필터 버튼 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px', marginBottom: '8px' }}>
                  {['입금대기', '결제완료', '배송지연', '발송완료'].map(s => {
                    const active = adminFilter === s; const st = getStatusStyle(s);
                    return (
                      <button key={s} onClick={() => setAdminFilter(active ? '전체' : s)} style={{ height: '62px', borderRadius: '12px', cursor: 'pointer', border: `1px solid ${active ? st.text : THEME.border}`, backgroundColor: active ? st.bg : '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                        <span style={{ fontSize: '19px', fontWeight: 'bold', color: st.text }}>{countOf(s)}</span>
                        <span style={{ fontSize: '11.5px', color: THEME.text, fontWeight: 500 }}>{s}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                  <button onClick={() => setAdminFilter('전체')} style={chipStyle(adminFilter === '전체', 'sub')}>전체 {adminOrders.length}</button>
                  <button onClick={() => setAdminFilter('취소/환불')} style={chipStyle(adminFilter === '취소/환불', 'sub')}>취소·환불 {countOf('주문취소') + countOf('환불처리')}</button>
                  <button onClick={fetchAdminOrders} style={{ ...chipStyle(false, 'sub'), marginLeft: 'auto' }}>새로고침</button>
                </div>
                <div style={{ position: 'relative', marginBottom: '14px' }}>
                  <input placeholder="이름 · 연락처 · 주문번호 검색" value={orderSearch} onChange={e => setOrderSearch(e.target.value)} style={{ ...A.input, paddingLeft: '36px' }} />
                  <Search size={16} color={THEME.subText} style={{ position: 'absolute', left: '12px', top: '14px' }} />
                </div>

                {visibleOrders.length === 0 && <div style={{ ...A.card, textAlign: 'center', color: THEME.subText, fontSize: '14px', padding: '40px 18px' }}>해당하는 주문이 없습니다.</div>}

                {visibleOrders.map(order => {
                  const sStyle = getStatusStyle(order.status);
                  const isEditing = editingOrderId === order.id;
                  const itemTotal = order.order_items ? order.order_items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) : 0;
                  const shippingFee = order.total_amount - itemTotal;
                  const isItemsExpanded = expandedOrderItems[order.id];
                  const action = nextAction[order.status];
                  return (
                    <div key={order.id} style={{ ...A.card, padding: 0, overflow: 'hidden', borderLeft: `4px solid ${sStyle.text}` }}>
                      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '14.5px', fontWeight: 'bold', margin: '0 0 2px 0' }}>
                            {isNewOrder(order) && <span style={{ display: 'inline-block', marginRight: '6px', padding: '1px 6px', borderRadius: '6px', backgroundColor: '#e53935', color: '#fff', fontSize: '10.5px', verticalAlign: '2px' }}>NEW</span>}
                            {order.order_number}
                          </p>
                          <p style={{ fontSize: '12px', color: THEME.subText, margin: 0 }}>{new Date(order.created_at).toLocaleString()}</p>
                        </div>
                        <span style={{ flexShrink: 0, padding: '5px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', backgroundColor: sStyle.bg, color: sStyle.text }}>{order.status}</span>
                      </div>

                      <div style={{ padding: '0 16px 12px', fontSize: '13px', color: '#555', lineHeight: 1.6 }}>
                        <p style={{ margin: 0 }}><strong style={{ color: THEME.text }}>{order.customer_name}</strong> · {order.phone}</p>
                        <p style={{ margin: 0 }}>{order.address}</p>
                        {order.memo && <p style={{ margin: '4px 0 0 0', color: THEME.primary }}>요청: {order.memo}</p>}
                        {order.admin_memo && <p style={{ margin: '4px 0 0 0', color: '#c62828' }}>안내 메모: {order.admin_memo}</p>}
                        {order.tracking_number && <p style={{ margin: '4px 0 0 0', color: '#2e7d32' }}>송장: {order.tracking_number}</p>}
                      </div>

                      <div style={{ borderTop: `1px solid ${THEME.border}`, padding: '10px 16px' }}>
                        <button onClick={() => setExpandedOrderItems({...expandedOrderItems, [order.id]: !isItemsExpanded})} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '13px', color: THEME.text }}>
                          <span>주문 상품 <strong style={{ color: THEME.primary }}>{order.order_items?.length || 0}건</strong></span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', color: THEME.subText }}>상품 {itemTotal.toLocaleString()} + 배송 {shippingFee.toLocaleString()}</span>
                            {isItemsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </span>
                        </button>
                        {isItemsExpanded && <div style={{ marginTop: '12px' }}>{order.order_items && order.order_items.map((item:any, i:number) => renderOrderItem(item, i))}</div>}
                      </div>

                      <div style={{ borderTop: `1px solid ${THEME.border}`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ flex: 1, fontSize: '18px', fontWeight: 'bold', color: THEME.primary }}>{order.total_amount.toLocaleString()}원</span>
                        {action && <button onClick={() => updateOrderStatus(order.id, action[0])} style={A.smallBtn('dark')}>{action[1]}</button>}
                        <button onClick={() => setEditingOrderId(isEditing ? null : order.id)} style={A.smallBtn('outline')}>{isEditing ? '닫기' : '관리'}</button>
                      </div>

                      {isEditing && (
                        <div style={{ borderTop: `1px solid ${THEME.border}`, backgroundColor: THEME.bg, padding: '14px 16px' }}>
                          <div style={A.field}>
                            <label style={A.label}>송장번호</label>
                            <input placeholder="예: CJ 123456789" defaultValue={order.tracking_number || ''} onChange={e => setTrackingInputs({...trackingInputs, [order.id]: e.target.value})} style={A.input} />
                          </div>
                          <div style={A.field}>
                            <label style={A.label}>고객 안내 메모 <span style={{ fontWeight: 'normal', color: THEME.subText }}>(주문조회 화면에 보임)</span></label>
                            <input placeholder="예: 입고 지연으로 3일 후 발송 예정입니다" defaultValue={order.admin_memo || ''} onChange={e => setAdminMemoInputs({...adminMemoInputs, [order.id]: e.target.value})} style={A.input} />
                          </div>
                          <button onClick={() => saveOrderInfo(order.id, order.tracking_number, order.admin_memo)} style={{ ...A.btn('dark'), marginBottom: '16px' }}>송장 · 메모 저장</button>

                          <label style={A.label}>상태 변경</label>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px', marginBottom: '12px' }}>
                            {['입금대기', '결제완료', '배송지연', '발송완료', '주문취소', '환불처리'].map(s => {
                              const st = getStatusStyle(s); const current = order.status === s;
                              return <button key={s} disabled={current} onClick={() => updateOrderStatus(order.id, s)} style={{ height: '38px', borderRadius: '9px', fontSize: '12.5px', fontWeight: 'bold', cursor: current ? 'default' : 'pointer', border: `1px solid ${current ? st.text : THEME.border}`, backgroundColor: current ? st.bg : '#fff', color: st.text }}>{s === '결제완료' ? '결제완료(입금확인)' : s}</button>;
                            })}
                          </div>
                          <button onClick={() => deleteOrder(order.id)} style={A.btn('danger')}><Trash2 size={15} /> 주문 영구 삭제</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* 📦 상품 등록 / 수정 폼 */}
          {adminTab === 'productAdd' && (
            <div>
              <div style={{ ...A.card, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={A.cardTitle}>{editingProductId ? '상품 수정' : '새 상품 등록'}</p>
                  <p style={{ ...A.help, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{editingProductId ? prodName : '스마트 복붙 → 사진 → 정보 순서로 채워주세요'}</p>
                </div>
                {editingProductId && <button onClick={() => { resetProductForm(); setAdminTab('productEdit'); }} style={A.smallBtn('outline')}>목록으로</button>}
              </div>

              {/* 판매 상태: 판매중 / 품절 */}
              <div style={{ ...A.card, display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={A.cardTitle}>판매 상태</p>
                  <p style={A.help}>품절로 바꾸면 손님 화면에 SOLD OUT 표시, 주문이 막히고 목록 맨 뒤로 갑니다. 사이즈별 품절은 옵션에 <strong>JL(품절)</strong>처럼 적으세요.</p>
                </div>
                <div style={{ display: 'flex', flexShrink: 0, border: `1px solid ${THEME.border}`, borderRadius: '10px', overflow: 'hidden' }}>
                  <button onClick={() => setProdSoldout(false)} style={{ height: '38px', padding: '0 14px', border: 'none', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: !prodSoldout ? '#2e7d32' : '#fff', color: !prodSoldout ? '#fff' : THEME.subText }}>판매중</button>
                  <button onClick={() => setProdSoldout(true)} style={{ height: '38px', padding: '0 14px', border: 'none', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: prodSoldout ? '#333' : '#fff', color: prodSoldout ? '#fff' : THEME.subText }}>품절</button>
                </div>
              </div>

              {!editingProductId && (
                <div style={{ ...A.card, backgroundColor: THEME.primaryLight, borderColor: THEME.primaryLight }}>
                  <p style={{ ...A.cardTitle, fontSize: '14.5px', display: 'flex', alignItems: 'center', gap: '6px', color: THEME.primary }}><Scissors size={16} /> 도매 상품 스마트 복붙</p>
                  <p style={{ ...A.help, marginBottom: '10px' }}>도매 사이트 글자를 드래그해 복사한 뒤 붙여넣으면 브랜드·이름·가격·색상·사이즈가 자동으로 채워집니다.</p>
                  <textarea placeholder="여기에 붙여넣기" value={importText} onChange={e => setImportText(e.target.value)} style={{ ...A.textarea, height: '84px', resize: 'none', marginBottom: '8px', border: 'none' }} />
                  <button onClick={handleSmartPaste} style={A.btn('primary')}>텍스트 자동 분석하기</button>
                </div>
              )}

              <div style={A.card}>
                <p style={{ ...A.cardTitle, marginBottom: '12px' }}>사진</p>
                <div style={A.row2}>
                  <label style={{ height: '140px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: THEME.bg, borderRadius: '12px', border: `1px dashed ${prodFiles || existingMainImageUrl ? THEME.primary : THEME.border}`, cursor: 'pointer', overflow: 'hidden', position: 'relative' }}>
                    {existingMainImageUrl && !prodFiles ? <img src={existingMainImageUrl} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35 }} /> : null}
                    <ImagePlus color={THEME.primary} size={28} style={{ position: 'relative' }} />
                    <span style={{ fontSize: '13px', fontWeight: 'bold', position: 'relative' }}>{editingProductId ? '대표 사진 교체' : '대표 사진'} <span style={{ color: THEME.primary }}>*</span></span>
                    <span style={{ fontSize: '11.5px', color: prodFiles ? THEME.primary : THEME.subText, position: 'relative', fontWeight: prodFiles ? 'bold' : 'normal' }}>{prodFiles ? `${prodFiles.length}장 선택됨` : existingMainImageUrl ? '등록됨' : '여러 장 선택 가능'}</span>
                    <input type="file" accept="image/*" multiple onChange={(e) => setProdFiles(e.target.files)} style={{ display: 'none' }} />
                  </label>
                  <label style={{ height: '140px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: THEME.bg, borderRadius: '12px', border: `1px dashed ${subProdFiles ? THEME.primary : THEME.border}`, cursor: 'pointer' }}>
                    <ImageIcon color={THEME.subText} size={28} />
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>상세 사진 (선택)</span>
                    <span style={{ fontSize: '11.5px', color: subProdFiles ? THEME.primary : THEME.subText, fontWeight: subProdFiles ? 'bold' : 'normal' }}>{subProdFiles ? `${subProdFiles.length}장 추가됨` : '파일 직접 첨부'}</span>
                    <input type="file" accept="image/*" multiple onChange={(e) => setSubProdFiles(e.target.files)} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>

              <div style={A.card}>
                <p style={{ ...A.cardTitle, marginBottom: '12px' }}>기본 정보</p>
                <div style={{ ...A.row2, ...A.field }}>
                  <div>
                    <label style={A.label}>브랜드</label>
                    <select value={prodBrand} onChange={e => setProdBrand(e.target.value)} style={A.input}>
                      <option value="">브랜드 선택</option>
                      {[...(brands || [])].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={A.label}>분류</label>
                    <select value={prodCategory} onChange={e => setProdCategory(e.target.value)} style={A.input}>
                      <option value="">분류 선택</option>
                      {[...(categories || [])].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={A.label}>상품명 <span style={{ color: THEME.primary }}>*</span></label>
                  <input placeholder="상품명을 입력하세요" value={prodName} onChange={e => setProdName(e.target.value)} style={{ ...A.input, fontWeight: 'bold' }} />
                </div>
              </div>

              <div style={A.card}>
                <p style={{ ...A.cardTitle, marginBottom: '12px' }}>가격</p>
                <div style={A.row2}>
                  <div>
                    <label style={A.label}>판매가 <span style={{ color: THEME.primary }}>*</span></label>
                    <input type="number" inputMode="numeric" placeholder="예: 25000" value={prodPrice} onChange={e => setProdPrice(e.target.value)} style={{ ...A.input, fontWeight: 'bold', borderColor: THEME.primary }} />
                  </div>
                  <div>
                    <label style={A.label}>매입원가 <span style={{ fontWeight: 'normal', color: THEME.subText }}>(손님에게 안 보임)</span></label>
                    <input type="number" inputMode="numeric" placeholder="예: 15000" value={prodCostPrice} onChange={e => setProdCostPrice(e.target.value)} style={A.input} />
                  </div>
                </div>
                {Number(prodPrice) > 0 && Number(prodCostPrice) > 0 && (
                  <p style={{ ...A.help, marginTop: '8px', color: Number(prodPrice) > Number(prodCostPrice) ? '#2e7d32' : '#c62828', fontWeight: 'bold' }}>
                    마진 {(Number(prodPrice) - Number(prodCostPrice)).toLocaleString()}원 ({Math.round((Number(prodPrice) - Number(prodCostPrice)) / Number(prodPrice) * 100)}%)
                  </p>
                )}
                {(() => {
                  const autoLp = getListPrice({ price: Number(prodPrice) }, shopSettings.list_price_rate);
                  const lp = getListPrice({ price: Number(prodPrice), list_price: prodListPrice.trim() === '' ? null : (parseInt(prodListPrice) || 0) }, shopSettings.list_price_rate);
                  const dc = getDiscountRate(Number(prodPrice), lp);
                  return (
                    <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: `1px dashed ${THEME.border}` }}>
                      <label style={A.label}>정가 (삭선 표시) <span style={{ fontWeight: 'normal', color: THEME.subText }}>비우면 자동 · 0 = 표시 안 함</span></label>
                      <input type="number" inputMode="numeric" placeholder={autoLp ? `자동: ${autoLp.toLocaleString()}원 (설정 ${shopSettings.list_price_rate}%)` : '자동 정가 꺼짐 (설정 0%)'} value={prodListPrice} onChange={e => setProdListPrice(e.target.value)} style={A.input} />
                      {Number(prodPrice) > 0 && (
                        <p style={{ ...A.help, marginTop: '8px' }}>
                          손님 화면: {dc > 0 ? <><span style={{ textDecoration: 'line-through' }}>{lp.toLocaleString()}원</span> <strong style={{ color: '#e53935' }}>{dc}%</strong> <strong style={{ color: THEME.text }}>{Number(prodPrice).toLocaleString()}원</strong></> : <strong style={{ color: THEME.text }}>{Number(prodPrice).toLocaleString()}원 (정가 표시 없음)</strong>}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div style={A.card}>
                <p style={A.cardTitle}>옵션</p>
                <p style={{ ...A.help, marginBottom: '12px' }}>쉼표(,)로 구분 · 추가요금은 <strong>JS(+3000원)</strong>처럼 적으면 자동 반영됩니다.</p>
                <div style={A.field}>
                  <label style={A.label}>색상</label>
                  <input placeholder="예: 소라, 브라운" value={prodColors} onChange={e => setProdColors(e.target.value)} style={A.input} />
                </div>
                <div>
                  <label style={A.label}>사이즈</label>
                  <input placeholder="예: 1(XS), 2(S), 3(M), JS(+3000원)" value={prodSizes} onChange={e => setProdSizes(e.target.value)} style={A.input} />
                </div>
                {(prodColors || prodSizes) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '10px' }}>
                    {[...prodColors.split(','), ...prodSizes.split(',')].map(s => s.trim()).filter(Boolean).map((s, i) => (
                      <span key={i} style={{ fontSize: '11.5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: THEME.bg, border: `1px solid ${THEME.border}` }}>{s}</span>
                    ))}
                  </div>
                )}
              </div>

              <div style={A.card}>
                <p style={{ ...A.cardTitle, marginBottom: '12px' }}>상세</p>
                <div style={A.field}>
                  <label style={A.label}>상품 설명</label>
                  <textarea placeholder="간단한 설명을 적어주세요." rows={3} value={prodDesc} onChange={e => setProdDesc(e.target.value)} style={A.textarea} />
                </div>
                <div>
                  <label style={A.label}>상세 이미지 링크 <span style={{ fontWeight: 'normal', color: THEME.subText }}>(추천)</span></label>
                  <textarea placeholder="도매 사이트 이미지 주소를 쉼표나 줄바꿈으로 구분해 붙여넣기" value={inputSubImageUrls} onChange={e => setInputSubImageUrls(e.target.value)} style={{ ...A.textarea, height: '84px' }} />
                  <p style={A.help}>사진 파일을 직접 올리는 것보다 링크가 쇼핑몰이 더 빠릅니다.</p>
                </div>
              </div>

              {/* 저장 버튼: 화면 아래 고정 */}
              <div style={{ position: 'sticky', bottom: '84px', display: 'flex', gap: '8px', backgroundColor: THEME.bg, padding: '8px 0' }}>
                {editingProductId && <button onClick={() => { resetProductForm(); setAdminTab('productEdit'); }} style={{ ...A.btn('outline'), flex: 1 }}>취소</button>}
                <button onClick={handleSaveProduct} disabled={isUploading} style={{ ...A.btn('primary'), flex: 2, backgroundColor: isUploading ? '#ccc' : THEME.primary }}>{isUploading ? '업로드 중...' : (editingProductId ? '수정 내용 저장' : '이 상품 등록하기')}</button>
              </div>
            </div>
          )}

          {/* 📝 상품 관리(목록) */}
          {adminTab === 'productEdit' && (
            <div>
              <div style={A.card}>
                <div style={{ position: 'relative', marginBottom: '8px' }}>
                  <input placeholder="상품명 또는 브랜드 검색" value={adminEditSearch} onChange={(e) => setAdminEditSearch(e.target.value)} style={{ ...A.input, paddingLeft: '36px' }} />
                  <Search size={16} color={THEME.subText} style={{ position: 'absolute', left: '12px', top: '14px' }} />
                </div>
                <div style={A.row2}>
                  <select value={adminEditBrand} onChange={(e) => setAdminEditBrand(e.target.value)} style={{ ...A.input, height: '40px', fontSize: '13px' }}>
                    <option value="전체">모든 브랜드</option>
                    {homeBrands.map(b => <option key={b.name} value={b.name}>{b.name} ({b.count})</option>)}
                  </select>
                  <select value={adminEditCategory} onChange={(e) => setAdminEditCategory(e.target.value)} style={{ ...A.input, height: '40px', fontSize: '13px' }}>
                    <option value="전체">모든 분류</option>
                    {homeMainCats.map(c => <option key={c} value={c}>{c} ({mainCatCounts[c]})</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  {['전체', '판매중', '품절'].map(st => (
                    <button key={st} onClick={() => setAdminEditStatus(st)} style={chipStyle(adminEditStatus === st, 'sub')}>
                      {st} {st === '전체' ? products.length : st === '품절' ? products.filter(x => x.is_soldout).length : products.filter(x => !x.is_soldout).length}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 2px 10px', fontSize: '13px', color: THEME.subText }}>
                <span>검색 결과 <strong style={{ color: THEME.text }}>{adminDisplayProducts.length.toLocaleString()}</strong>개</span>
                <button onClick={() => { setAdminTab('productAdd'); resetProductForm(); }} style={A.smallBtn('dark')}><Plus size={14} /> 새 상품</button>
              </div>

              {adminCurrentProducts.length > 0 ? (
                <>
                  <div style={{ backgroundColor: '#fff', borderRadius: '16px', border: `1px solid ${THEME.border}`, overflow: 'hidden' }}>
                    {adminCurrentProducts.map((p, idx) => {
                      const margin = (p.price || 0) - (p.cost_price || 0);
                      return (
                        <div key={p.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', borderTop: idx === 0 ? 'none' : `1px solid ${THEME.border}` }}>
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <img src={p.main_image} loading="lazy" style={{ width: '60px', height: '75px', objectFit: 'cover', borderRadius: '8px', backgroundColor: '#eee', display: 'block', filter: p.is_soldout ? 'grayscale(1)' : 'none', opacity: p.is_soldout ? 0.6 : 1 }} />
                            {p.is_soldout && <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center', backgroundColor: 'rgba(40,40,40,0.85)', color: '#fff', fontSize: '10px', fontWeight: 'bold', borderRadius: '0 0 8px 8px', padding: '2px 0' }}>품절</span>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '11.5px', fontWeight: 'bold', color: THEME.primary, margin: '0 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.brand || '자체제작'} <span style={{ color: THEME.subText, fontWeight: 'normal' }}>· {p.category || '분류 없음'}</span></p>
                            <p style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                            <p style={{ fontSize: '12.5px', margin: 0, color: THEME.text }}>
                              {p.price.toLocaleString()}원
                              <span style={{ color: THEME.subText }}> · 원가 {(p.cost_price || 0).toLocaleString()}</span>
                              {p.cost_price > 0 && <span style={{ color: margin > 0 ? '#2e7d32' : '#c62828' }}> · 마진 {margin.toLocaleString()}</span>}
                            </p>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                            <button onClick={() => openEditProduct(p)} style={A.smallBtn('dark')}><Edit size={13} /> 수정</button>
                            <button onClick={() => toggleSoldout(p)} style={{ ...A.smallBtn('outline'), color: p.is_soldout ? '#2e7d32' : THEME.text }}>{p.is_soldout ? '판매 재개' : '품절'}</button>
                            <button onClick={() => deleteProduct(p.id)} style={A.smallBtn('danger')}><Trash2 size={13} /> 삭제</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: '20px' }}>
                    {renderPagination(adminEditPage, adminTotalPages, (p) => { setAdminEditPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }, THEME.text)}
                  </div>
                </>
              ) : (
                <div style={{ ...A.card, textAlign: 'center', padding: '40px 18px', color: THEME.subText, fontSize: '14px' }}>검색 조건에 맞는 상품이 없습니다.</div>
              )}
            </div>
          )}

          {/* ⚙️ 설정: 항목별 접기/펼치기 */}
          {adminTab === 'settings' && (
            <div>
              {/* 쇼핑몰 정보 (상호·채팅·배송비·계좌·사업자) — 저장 버튼 하나로 전체 저장 */}
              <div style={A.card}>
                {settingsHeader('shop', '쇼핑몰 정보', '상호 · 채팅 주소 · 배송비 · 입금 계좌 · 사업자 정보')}
                {settingsOpen.shop && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ ...A.row2, ...A.field }}>
                      <div><label style={A.label}>영문 상호</label><input placeholder="예: Hoo & Moi" value={shopSettings.shop_name} onChange={e => setShopSettings({...shopSettings, shop_name: e.target.value})} style={A.input} /></div>
                      <div><label style={A.label}>한글 상호</label><input placeholder="예: 후앤모아" value={shopSettings.shop_name_kr} onChange={e => setShopSettings({...shopSettings, shop_name_kr: e.target.value})} style={A.input} /></div>
                    </div>
                    <div style={A.field}><label style={A.label}>1:1 채팅 주소 <span style={{ fontWeight: 'normal', color: THEME.subText }}>(주문서 전송 · 하단 문의하기)</span></label><input placeholder="https://open.kakao.com/o/..." value={shopSettings.kakao_url} onChange={e => setShopSettings({...shopSettings, kakao_url: e.target.value})} style={A.input} /></div>
                    <div style={A.field}><label style={A.label}>📢 신상 소식방 주소 <span style={{ fontWeight: 'normal', color: THEME.subText }}>(단체 오픈채팅)</span></label><input placeholder="https://open.kakao.com/o/..." value={shopSettings.community_url} onChange={e => setShopSettings({...shopSettings, community_url: e.target.value})} style={A.input} /></div>
                    <div style={{ ...A.field, maxWidth: '50%' }}><label style={A.label}>기본 배송비</label><input type="number" inputMode="numeric" placeholder="3500" value={shopSettings.shipping_fee} onChange={e => setShopSettings({...shopSettings, shipping_fee: parseInt(e.target.value) || 0})} style={A.input} /></div>

                    <p style={{ fontSize: '14px', fontWeight: 'bold', margin: '20px 0 10px', paddingTop: '16px', borderTop: `1px solid ${THEME.border}` }}>무통장 입금 계좌</p>
                    <div style={{ ...A.row2, ...A.field }}>
                      <div><label style={A.label}>은행명</label><input placeholder="예: 농협" value={editBankInfo.bank_name} onChange={e => setEditBankInfo({...editBankInfo, bank_name: e.target.value})} style={A.input} /></div>
                      <div><label style={A.label}>예금주</label><input placeholder="예금주" value={editBankInfo.depositor_name} onChange={e => setEditBankInfo({...editBankInfo, depositor_name: e.target.value})} style={A.input} /></div>
                    </div>
                    <div style={A.field}><label style={A.label}>계좌번호</label><input placeholder="계좌번호" value={editBankInfo.account_number} onChange={e => setEditBankInfo({...editBankInfo, account_number: e.target.value})} style={A.input} /></div>

                    <p style={{ fontSize: '14px', fontWeight: 'bold', margin: '20px 0 4px', paddingTop: '16px', borderTop: `1px solid ${THEME.border}` }}>사업자 정보</p>
                    <p style={{ ...A.help, margin: '0 0 10px 0' }}>쇼핑몰 맨 아래에 표시됩니다. 상호명은 한글 상호, 문의하기는 1:1 채팅 주소가 쓰입니다.</p>
                    <div style={{ ...A.row2, ...A.field }}>
                      <div><label style={A.label}>대표자</label><input placeholder="대표자" value={shopSettings.biz_owner} onChange={e => setShopSettings({...shopSettings, biz_owner: e.target.value})} style={A.input} /></div>
                      <div><label style={A.label}>사업자등록번호</label><input placeholder="000-00-00000" value={shopSettings.biz_number} onChange={e => setShopSettings({...shopSettings, biz_number: e.target.value})} style={A.input} /></div>
                    </div>
                    <div style={{ ...A.row2, ...A.field }}>
                      <div><label style={A.label}>통신판매업 신고번호</label><input placeholder="2026-OO-0000" value={shopSettings.ecommerce_number} onChange={e => setShopSettings({...shopSettings, ecommerce_number: e.target.value})} style={A.input} /></div>
                      <div><label style={A.label}>이메일</label><input placeholder="이메일" value={shopSettings.biz_email} onChange={e => setShopSettings({...shopSettings, biz_email: e.target.value})} style={A.input} /></div>
                    </div>
                    <button onClick={saveStoreSettings} style={A.btn('dark')}>쇼핑몰 정보 저장</button>
                  </div>
                )}
              </div>

              {/* 💲 가격 표시: 정가(삭선) 배율 */}
              <div style={A.card}>
                {settingsHeader('price', '가격 표시 (정가 삭선)', `현재: 판매가보다 ${shopSettings.list_price_rate}% 높은 정가를 삭선으로 표시${shopSettings.list_price_rate ? '' : ' (꺼짐)'}`)}
                {settingsOpen.price && (() => {
                  const sample = 25000;
                  const lp = getListPrice({ price: sample }, shopSettings.list_price_rate);
                  const dc = getDiscountRate(sample, lp);
                  return (
                    <div style={{ marginTop: '16px' }}>
                      <label style={A.label}>정가 배율 (%)</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                        <input type="number" inputMode="numeric" min={0} max={100} value={shopSettings.list_price_rate} onChange={e => setShopSettings({ ...shopSettings, list_price_rate: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })} style={{ ...A.input, width: '110px' }} />
                        {[0, 20, 25, 30].map(r => (
                          <button key={r} onClick={() => setShopSettings({ ...shopSettings, list_price_rate: r })} style={chipStyle(shopSettings.list_price_rate === r, 'sub')}>{r === 0 ? '끄기' : `${r}%`}</button>
                        ))}
                      </div>
                      <p style={{ ...A.help, margin: '0 0 6px 0' }}>예) 판매가 25,000원 → {dc > 0 ? <><span style={{ textDecoration: 'line-through' }}>{lp.toLocaleString()}원</span> <strong style={{ color: '#e53935' }}>{dc}%</strong> <strong>25,000원</strong></> : '정가 표시 없음'}</p>
                      <p style={{ ...A.help, margin: '0 0 12px 0' }}>상품마다 정가를 직접 적으면 그 값이 우선입니다. (상품 등록 → 가격 → 정가) 도매몰 수집 상품도 이 배율이 적용됩니다.<br />※ 실제로 판매한 적 없는 가격을 정가로 크게 부풀리면 표시광고법 문제가 될 수 있어요.</p>
                      {!hasRateColumn && <p style={{ ...A.help, margin: '0 0 10px 0', color: '#c62828' }}>저장하려면 supabase/updates/03_soldout_listprice.sql 을 먼저 실행해주세요.</p>}
                      <button onClick={saveStoreSettings} disabled={!hasRateColumn} style={{ ...A.btn('dark'), opacity: hasRateColumn ? 1 : 0.4 }}>배율 저장</button>
                    </div>
                  );
                })()}
              </div>

              {/* 🔑 관리자 계정: 비밀번호 변경 */}
              <div style={A.card}>
                {settingsHeader('account', '관리자 계정', `로그인 비밀번호 변경${adminEmail ? ` · ${adminEmail}` : ''}`)}
                {settingsOpen.account && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={A.field}>
                      <label style={A.label}>새 비밀번호 <span style={{ fontWeight: 'normal', color: THEME.subText }}>(8자 이상)</span></label>
                      <input type={showNewPw ? 'text' : 'password'} autoComplete="new-password" value={newPw} onChange={e => setNewPw(e.target.value)} style={A.input} />
                    </div>
                    <div style={A.field}>
                      <label style={A.label}>새 비밀번호 확인</label>
                      <input type={showNewPw ? 'text' : 'password'} autoComplete="new-password" value={newPw2} onChange={e => setNewPw2(e.target.value)} style={A.input} />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: THEME.subText, marginBottom: '12px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={showNewPw} onChange={e => setShowNewPw(e.target.checked)} /> 입력한 비밀번호 보기
                    </label>
                    <button onClick={handleChangePassword} disabled={isChangingPw} style={A.btn('dark')}>{isChangingPw ? '변경 중...' : '비밀번호 변경'}</button>
                    <p style={{ ...A.help, marginTop: '8px' }}>바꾼 뒤에는 브라우저에 저장된 예전 비밀번호도 새 비밀번호로 바꿔주세요.</p>
                  </div>
                )}
              </div>

              {/* 💬 카카오톡 주문 알림: 새 주문 → 관리자 카카오톡 '나와의 채팅'으로 (키·계정 언제든 변경) */}
              <div style={A.card}>
                {settingsHeader('kakao', '카카오톡 주문 알림', kakaoStatusError ? '준비 필요 (SQL 실행 전)' : !kakaoStatus ? '새 주문을 내 카카오톡으로 받기' : kakaoStatus.connected ? `현재: 연결됨 · 알림 ${kakaoStatus.enabled ? '켜짐' : '꺼짐'}` : '현재: 연결 안 됨')}
                {settingsOpen.kakao && (() => {
                  const s = kakaoStatus;
                  const fmt = (v?: string) => v ? new Date(v).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
                  const infoRow = (label: string, value: React.ReactNode, color?: string) => (
                    <div style={{ display: 'flex', gap: '10px', fontSize: '13px', lineHeight: 1.7 }}>
                      <span style={{ flexShrink: 0, width: '78px', color: THEME.subText }}>{label}</span>
                      <span style={{ flex: 1, minWidth: 0, color: color || THEME.text, fontWeight: 500, wordBreak: 'break-all' }}>{value}</span>
                    </div>
                  );
                  const copyRow = (label: string, value: string) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '4px 0 2px' }}>
                      <code style={{ flex: 1, minWidth: 0, padding: '7px 10px', borderRadius: '8px', backgroundColor: '#fff', border: `1px solid ${THEME.border}`, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</code>
                      <button onClick={async () => alert((await copyText(value)) ? `${label} 복사했습니다.` : '복사 실패: 직접 선택해서 복사해주세요.')} style={A.smallBtn('outline')}><Copy size={13} />복사</button>
                    </div>
                  );
                  return (
                    <div style={{ marginTop: '16px' }}>
                      {kakaoStatusError ? (
                        <p style={{ ...A.help, margin: '0 0 12px', color: '#c62828' }}>{kakaoStatusError}<br />Supabase › SQL Editor 에서 supabase/updates/04_kakao_notify.sql 을 실행한 뒤 <button onClick={fetchKakaoStatus} style={{ background: 'none', border: 'none', padding: 0, color: THEME.primary, fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>다시 확인</button></p>
                      ) : !s ? (
                        <p style={A.help}>불러오는 중...</p>
                      ) : (
                        <>
                          {/* 1) 지금 상태 */}
                          <div style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: THEME.bg, border: `1px solid ${THEME.border}`, marginBottom: '12px' }}>
                            {infoRow('연결', s.connected ? `✅ 연결됨 (${fmt(s.connected_at)})` : '연결 안 됨', s.connected ? '#2e7d32' : '#c62828')}
                            {infoRow('알림', s.enabled ? '켜짐 · 새 주문 30초~1분 안에 도착' : '꺼짐')}
                            {s.connected && infoRow('연결 유지', `매일 자동 갱신 (현재 만료 예정 ${s.refresh_expires_at ? new Date(s.refresh_expires_at).toLocaleDateString('ko-KR') : '-'})`)}
                            {infoRow('보낸 알림', `${s.sent_count}건 · 마지막 ${fmt(s.last_sent_at)}${s.failed_count ? ` · 실패 ${s.failed_count}건` : ''}`)}
                            {s.last_error && infoRow('오류', `${s.last_error} (${fmt(s.last_error_at)})`, '#c62828')}
                          </div>

                          {s.connected ? (
                            <>
                              <div style={{ ...A.row2, marginBottom: '8px' }}>
                                <button onClick={() => runKakao('kakao_admin_test', undefined, "테스트 메시지를 보냈습니다. 카카오톡 '나와의 채팅'을 확인해주세요.")} disabled={kakaoBusy} style={A.btn('primary')}><Send size={15} />테스트 메시지</button>
                                <button onClick={() => saveKakaoConfig(!s.enabled)} disabled={kakaoBusy} style={A.btn('outline')}>{s.enabled ? '알림 잠시 끄기' : '알림 다시 켜기'}</button>
                              </div>
                              <div style={{ ...A.row2, marginBottom: '16px' }}>
                                <button onClick={() => startKakaoConnect(true)} disabled={kakaoBusy} style={A.btn('outline')}>다른 카카오 계정으로</button>
                                <button onClick={() => { if (window.confirm("카카오 연결을 끊을까요? 새 주문 알림이 오지 않습니다. (앱 키는 남아 있어 언제든 다시 연결 가능)")) runKakao('kakao_admin_disconnect', undefined, "연결을 끊었습니다."); }} disabled={kakaoBusy} style={A.btn('danger')}>연결 끊기</button>
                              </div>
                            </>
                          ) : (
                            <button onClick={() => startKakaoConnect(false)} disabled={kakaoBusy || !s.rest_api_key} style={{ ...A.btn('primary'), marginBottom: '6px', backgroundColor: '#FEE500', color: '#191919', opacity: s.rest_api_key ? 1 : 0.4 }}><KakaoIcon size={18} />카카오 연결하기</button>
                          )}
                          {!s.connected && <p style={{ ...A.help, margin: '0 0 16px' }}>{s.rest_api_key ? '알림을 받을 카카오 계정으로 로그인 → "카카오톡 메시지 전송" 동의 → 이 화면으로 돌아오면 끝.' : '아래 ② 카카오 앱 정보를 먼저 저장해주세요.'}</p>}

                          {/* 2) 카카오 앱 정보 (언제든 변경 가능) */}
                          <p style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 4px', paddingTop: '16px', borderTop: `1px solid ${THEME.border}` }}>② 카카오 앱 정보</p>
                          <p style={{ ...A.help, margin: '0 0 10px' }}>카카오 디벨로퍼스 › 내 애플리케이션 › 앱 키 에서 복사합니다. 다른 카카오 앱으로 바꿀 때도 여기서 바꾸고 다시 연결하면 됩니다.</p>
                          <div style={A.field}><label style={A.label}>REST API 키</label><input value={kakaoKeyInput} onChange={e => setKakaoKeyInput(e.target.value)} placeholder="32자리 영문·숫자" autoComplete="off" spellCheck={false} style={A.input} /></div>
                          <div style={A.field}>
                            <label style={A.label}>Client Secret <span style={{ fontWeight: 'normal', color: THEME.subText }}>(카카오 앱에서 사용 중일 때만)</span></label>
                            <input value={kakaoSecretInput} onChange={e => setKakaoSecretInput(e.target.value)} placeholder={s.has_client_secret ? '저장되어 있음 · 바꿀 때만 입력' : '없으면 비워두기'} autoComplete="off" spellCheck={false} style={A.input} />
                            {s.has_client_secret && <button onClick={clearKakaoSecret} style={{ background: 'none', border: 'none', padding: '6px 0 0', color: '#c62828', fontSize: '12px', cursor: 'pointer' }}>저장된 Client Secret 지우기</button>}
                          </div>
                          <button onClick={() => saveKakaoConfig()} disabled={kakaoBusy} style={{ ...A.btn('dark'), marginBottom: '16px' }}>{kakaoBusy ? '처리 중...' : '앱 정보 저장'}</button>

                          {/* 3) 처음 한 번 카카오 앱 만들기 안내 */}
                          <details style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: '14px' }}>
                            <summary style={{ fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>처음 설정 방법 (카카오 앱 만들기, 1번만)</summary>
                            <div style={{ fontSize: '12.5px', color: THEME.text, lineHeight: 1.7, marginTop: '10px', padding: '12px', backgroundColor: THEME.bg, borderRadius: '10px' }}>
                              <p style={{ margin: '0 0 6px' }}>1. developers.kakao.com 에 카카오 계정으로 로그인 → <strong>내 애플리케이션 › 애플리케이션 추가</strong> (이름 예: 후앤모아 알림)</p>
                              <p style={{ margin: '0 0 2px' }}>2. <strong>플랫폼 › Web › 사이트 도메인</strong>에 아래 주소 등록</p>
                              {copyRow('사이트 도메인을', window.location.origin)}
                              <p style={{ margin: '8px 0 2px' }}>3. <strong>카카오 로그인</strong> 켜기(ON) → <strong>Redirect URI</strong>에 아래 주소 등록</p>
                              {copyRow('Redirect URI 를', kakaoRedirectUri)}
                              <p style={{ margin: '8px 0 6px' }}>4. <strong>카카오 로그인 › 동의항목</strong>에서 <strong>카카오톡 메시지 전송</strong>을 "선택 동의"로 설정</p>
                              <p style={{ margin: '0 0 6px' }}>5. <strong>앱 키</strong>의 REST API 키 (그리고 <strong>보안 › Client Secret</strong> 코드가 "사용함"이면 그 코드도) → 위 ②에 붙여넣고 저장</p>
                              <p style={{ margin: 0 }}>6. [카카오 연결하기] → 알림 받을 카카오 계정으로 로그인·동의</p>
                              <p style={{ margin: '8px 0 0', color: THEME.subText }}>※ 알림은 "연결한 카카오 계정"의 나와의 채팅으로 갑니다. 받는 계정을 바꾸려면 [다른 카카오 계정으로]를 누르세요. 무료이며 하루 보낼 수 있는 양도 충분합니다.</p>
                            </div>
                          </details>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* ↕️ 홈 화면 배치: 분류 탭 · 브랜드 · 상품 순서 (끌어서 변경 후 저장) */}
              <div style={A.card}>
                {settingsHeader('layout', '홈 화면 배치', '분류 탭 · 브랜드 · 상품 순서를 손잡이(≡)를 끌어서 바꾸기')}
                {settingsOpen.layout && (() => {
                  const cats = layoutCats ?? homeMainCats;
                  const brandNames = layoutBrands ?? homeBrands.map(b => b.name);
                  const prodList = layoutProducts ?? products;
                  const shown = prodList.slice(0, layoutProductLimit);
                  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', height: '46px', padding: '0 8px 0 4px', backgroundColor: THEME.bg, border: `1px solid ${THEME.border}`, borderRadius: '10px' };
                  const numStyle: React.CSSProperties = { flexShrink: 0, width: '24px', textAlign: 'center', fontSize: '12px', color: THEME.subText, fontWeight: 'bold' };
                  const moveTop = <T,>(list: T[], i: number) => { const n = [...list]; const [x] = n.splice(i, 1); n.unshift(x); return n; };
                  return (
                    <div style={{ marginTop: '16px' }}>
                      <p style={{ ...A.help, margin: '0 0 14px 0', backgroundColor: THEME.primaryLight, color: THEME.text, padding: '10px 12px', borderRadius: '10px' }}>
                        오른쪽 <strong>≡</strong>를 꾹 누른 채 위아래로 끌면 자리가 바뀝니다. <strong>저장</strong>을 눌러야 홈 화면에 반영돼요.
                      </p>

                      {/* 1) 분류 탭 순서 */}
                      <p style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 4px' }}>① 분류 탭 순서</p>
                      <p style={{ ...A.help, margin: '0 0 8px' }}>홈 화면 맨 위 탭입니다. [전체] [브랜드]는 항상 맨 앞에 있어요.</p>
                      <SortableList items={cats} keyOf={c => c} onChange={setLayoutCats} render={(c, i, handle) => (
                        <div style={rowStyle}>
                          <span style={numStyle}>{i + 1}</span>
                          <span style={{ flex: 1, fontSize: '14px', fontWeight: 500 }}>{c}</span>
                          <span style={{ fontSize: '12px', color: THEME.subText }}>{mainCatCounts[c] || 0}개</span>
                          {i > 0 && <button onClick={() => setLayoutCats(moveTop(cats, i))} style={A.smallBtn('outline')}>맨 앞</button>}
                          {handle}
                        </div>
                      )} />

                      {/* 2) 브랜드 순서 */}
                      <p style={{ fontSize: '14px', fontWeight: 'bold', margin: '20px 0 4px', paddingTop: '16px', borderTop: `1px solid ${THEME.border}` }}>② 브랜드 순서</p>
                      <p style={{ ...A.help, margin: '0 0 8px' }}>[브랜드] 탭을 눌렀을 때 나오는 순서입니다.</p>
                      <SortableList items={brandNames} keyOf={b => b} onChange={setLayoutBrands} maxHeight="320px" render={(b, i, handle) => (
                        <div style={rowStyle}>
                          <span style={numStyle}>{i + 1}</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b}</span>
                          <span style={{ fontSize: '12px', color: THEME.subText }}>{brandCounts[b] || 0}개</span>
                          {i > 0 && <button onClick={() => setLayoutBrands(moveTop(brandNames, i))} style={A.smallBtn('outline')}>맨 앞</button>}
                          {handle}
                        </div>
                      )} />
                      <div style={{ ...A.row2, marginTop: '10px' }}>
                        <button onClick={() => { setLayoutCats(null); setLayoutBrands(null); }} style={A.btn('outline')}>되돌리기</button>
                        <button onClick={saveTabLayout} disabled={isSavingLayout} style={A.btn('dark')}>{isSavingLayout ? '저장 중...' : '① ② 순서 저장'}</button>
                      </div>

                      {/* 3) 상품 노출 순서 */}
                      <p style={{ fontSize: '14px', fontWeight: 'bold', margin: '24px 0 4px', paddingTop: '16px', borderTop: `1px solid ${THEME.border}` }}>③ 상품 노출 순서</p>
                      <p style={{ ...A.help, margin: '0 0 10px' }}>홈 화면 [전체]에 보이는 순서입니다. 앞쪽 {layoutProductLimit}개를 끌어서 정리할 수 있고, 새로 등록한 상품은 자동으로 맨 앞에 나옵니다.</p>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                        <select value={layoutBrandPick} onChange={e => setLayoutBrandPick(e.target.value)} style={{ ...A.input, height: '40px', fontSize: '13px', flex: 1, minWidth: 0 }}>
                          <option value="">브랜드 선택</option>
                          {homeBrands.map(b => <option key={b.name} value={b.name}>{b.name} ({b.count})</option>)}
                        </select>
                        <button disabled={!layoutBrandPick} onClick={() => {
                          const picked = prodList.filter((p: any) => p.brand === layoutBrandPick);
                          setLayoutProducts([...picked, ...prodList.filter((p: any) => p.brand !== layoutBrandPick)]);
                        }} style={{ ...A.smallBtn('dark'), height: '40px', opacity: layoutBrandPick ? 1 : 0.4 }}>이 브랜드 상품 맨 앞으로</button>
                      </div>
                      <SortableList items={shown} keyOf={(p: any) => String(p.id)} maxHeight="420px"
                        onChange={next => setLayoutProducts([...next, ...prodList.slice(layoutProductLimit)])}
                        render={(p: any, i, handle) => (
                          <div style={{ ...rowStyle, height: '58px' }}>
                            <span style={numStyle}>{i + 1}</span>
                            <img src={p.main_image} loading="lazy" style={{ width: '38px', height: '46px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0, backgroundColor: '#eee' }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: '11px', color: THEME.primary, fontWeight: 'bold', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.brand || '자체제작'}</p>
                              <p style={{ fontSize: '13px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                            </div>
                            {i > 0 && <button onClick={() => setLayoutProducts(moveTop(prodList, i))} style={A.smallBtn('outline')}>맨 앞</button>}
                            {handle}
                          </div>
                        )} />
                      {prodList.length > layoutProductLimit && (
                        <button onClick={() => setLayoutProductLimit(n => n + 60)} style={{ ...A.btn('outline'), marginTop: '8px', height: '40px', fontSize: '13px' }}>다음 60개 더 보기 ({layoutProductLimit} / {prodList.length})</button>
                      )}
                      <div style={{ ...A.row2, marginTop: '10px' }}>
                        <button onClick={() => setLayoutProducts(null)} style={A.btn('outline')}>되돌리기</button>
                        <button onClick={saveProductLayout} disabled={isSavingLayout || !layoutProducts} style={{ ...A.btn('dark'), opacity: layoutProducts ? 1 : 0.4 }}>{isSavingLayout ? '저장 중...' : '③ 상품 순서 저장'}</button>
                      </div>
                      <button onClick={resetProductLayout} disabled={isSavingLayout} style={{ ...A.btn('danger'), marginTop: '8px', height: '40px', fontSize: '13px' }}>상품 순서를 최신 등록순으로 초기화</button>
                    </div>
                  );
                })()}
              </div>

              {/* 홈 화면 꾸미기: 문구 + 배너 */}
              <div style={A.card}>
                {settingsHeader('home', '홈 화면', '상단 인사말 · 메인 배너')}
                {settingsOpen.home && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={A.field}><label style={A.label}>메인 문구 (큰 글씨)</label><textarea rows={2} value={introMainInput} onChange={e => setIntroMainInput(e.target.value)} style={{ ...A.textarea, resize: 'none' }} /></div>
                    <div style={A.field}><label style={A.label}>서브 문구 (작은 글씨)</label><textarea rows={2} value={introSubInput} onChange={e => setIntroSubInput(e.target.value)} style={{ ...A.textarea, resize: 'none' }} /></div>
                    <button onClick={handleSaveIntro} disabled={isIntroUploading} style={{ ...A.btn('dark'), marginBottom: '20px' }}>{isIntroUploading ? '저장 중...' : '문구 저장'}</button>

                    <label style={{ ...A.label, paddingTop: '16px', borderTop: `1px solid ${THEME.border}` }}>메인 배너 이미지</label>
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '150px', backgroundColor: THEME.bg, borderRadius: '12px', border: `1px dashed ${THEME.border}`, cursor: 'pointer', marginBottom: '10px', overflow: 'hidden' }}>
                      {bannerFile ? ( <span style={{ fontSize: '14px', color: THEME.primary, fontWeight: 'bold' }}>{bannerFile.name} 선택됨</span>
                      ) : mainBannerUrl ? ( <img src={mainBannerUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : ( <><ImagePlus color={THEME.subText} size={28} /><span style={{ marginTop: '8px', fontSize: '13px', color: THEME.subText }}>눌러서 사진 선택</span></> )}
                      <input type="file" accept="image/*" onChange={(e) => setBannerFile(e.target.files ? e.target.files[0] : null)} style={{ display: 'none' }} />
                    </label>
                    <button onClick={handleSaveMainBanner} disabled={isBannerUploading} style={A.btn('dark')}>{isBannerUploading ? '업로드 중...' : '배너 적용'}</button>
                  </div>
                )}
              </div>

              {/* 공지 팝업 */}
              <div style={A.card}>
                {settingsHeader('notice', '공지 팝업', notice?.is_active ? '현재: 켜짐 (손님 접속 시 표시)' : '현재: 꺼짐')}
                {settingsOpen.notice && (
                  <div style={{ marginTop: '16px' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '150px', backgroundColor: THEME.bg, borderRadius: '12px', border: `1px dashed ${THEME.border}`, cursor: 'pointer', marginBottom: '10px', overflow: 'hidden' }}>
                      {noticeFile ? ( <span style={{ fontSize: '14px', color: THEME.primary, fontWeight: 'bold' }}>{noticeFile.name} 선택됨</span>
                      ) : (notice && notice.image_url) ? ( <img src={notice.image_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      ) : ( <><ImagePlus color={THEME.subText} size={28} /><span style={{ marginTop: '8px', fontSize: '13px', color: THEME.subText }}>팝업 사진 (선택)</span></> )}
                      <input type="file" accept="image/*" onChange={(e) => setNoticeFile(e.target.files ? e.target.files[0] : null)} style={{ display: 'none' }} />
                    </label>
                    <div style={A.field}><textarea placeholder="공지할 내용을 작성해주세요." rows={5} value={noticeInput} onChange={e => setNoticeInput(e.target.value)} style={A.textarea} /></div>
                    <div style={A.row2}>
                      <button onClick={() => handleSaveNotice(false)} disabled={isNoticeUploading} style={A.btn('outline')}>저장 후 끄기</button>
                      <button onClick={() => handleSaveNotice(true)} disabled={isNoticeUploading} style={A.btn('primary')}>{isNoticeUploading ? '저장 중...' : '저장 후 켜기'}</button>
                    </div>
                  </div>
                )}
              </div>

              {/* 브랜드 관리 */}
              <div style={A.card}>
                {settingsHeader('brand', `브랜드 관리 (${brands.length})`, '추가 · 검색 · 삭제')}
                {settingsOpen.brand && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <input placeholder="새 브랜드명" value={newBrand} onChange={e => setNewBrand(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addBrand(); }} style={{ ...A.input, flex: 1, minWidth: 0 }} />
                      <button onClick={addBrand} style={A.btn('dark', false)}>추가</button>
                    </div>
                    <div style={{ position: 'relative', marginBottom: '10px' }}>
                      <input placeholder="브랜드 검색" value={brandSearch} onChange={e => setBrandSearch(e.target.value)} style={{ ...A.input, height: '40px', paddingLeft: '34px', backgroundColor: THEME.bg, fontSize: '13px' }} />
                      <Search size={15} color={THEME.subText} style={{ position: 'absolute', left: '12px', top: '12px' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px', maxHeight: '360px', overflowY: 'auto' }}>
                      {[...(brands || [])]
                        .filter(b => !brandSearch || b.name.toLowerCase().includes(brandSearch.trim().toLowerCase()))
                        .sort((a, b) => (brandCounts[b.name] || 0) - (brandCounts[a.name] || 0) || a.name.localeCompare(b.name, 'ko'))
                        .map(b => (
                        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '40px', padding: '0 6px 0 12px', backgroundColor: THEME.bg, border: `1px solid ${THEME.border}`, borderRadius: '10px', minWidth: 0 }}>
                          <span style={{ flex: 1, minWidth: 0, fontSize: '13.5px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                          <span style={{ flexShrink: 0, fontSize: '12px', color: THEME.subText }}>{brandCounts[b.name] || 0}개</span>
                          <button onClick={() => deleteBrand(b.id)} aria-label={`${b.name} 삭제`} style={{ flexShrink: 0, background: 'none', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex' }}><Trash2 size={15} color="#c62828" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 카테고리 관리 */}
              <div style={A.card}>
                {settingsHeader('category', '분류(카테고리) 관리', '대분류 · 중분류 추가와 삭제')}
                {settingsOpen.category && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      <input placeholder="새 대분류 이름" value={newMainCat} onChange={e => setNewMainCat(e.target.value)} style={{ ...A.input, flex: 1, minWidth: 0 }} />
                      <button onClick={() => addCategory(newMainCat, '')} style={A.btn('dark', false)}>생성</button>
                    </div>
                    <div style={{ border: `1px solid ${THEME.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                      {Object.keys(categoryTree).sort((a, b) => catRank(a) - catRank(b) || a.localeCompare(b, 'ko')).map((mainCat, idx) => {
                        const isExpanded = adminCatExpanded[mainCat];
                        return (
                          <div key={mainCat} style={{ borderTop: idx === 0 ? 'none' : `1px solid ${THEME.border}` }}>
                            <button onClick={() => setAdminCatExpanded({...adminCatExpanded, [mainCat]: !isExpanded})} style={{ width: '100%', height: '46px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 14px', background: isExpanded ? THEME.primaryLight : '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', color: THEME.text, textAlign: 'left' }}>
                              <span style={{ flex: 1 }}>{mainCat}</span>
                              <span style={{ fontSize: '12px', fontWeight: 'normal', color: THEME.subText }}>상품 {mainCatCounts[mainCat] || 0} · 중분류 {categoryTree[mainCat].length}</span>
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                            {isExpanded && (
                              <div style={{ padding: '6px 14px 14px', backgroundColor: '#fdfdfd' }}>
                                {categoryTree[mainCat].length > 0 ? categoryTree[mainCat].map(sub => {
                                  const targetCat = categories.find(c => c.name === `${mainCat} > ${sub}`);
                                  return (
                                    <div key={sub} style={{ display: 'flex', alignItems: 'center', height: '38px', borderBottom: `1px dashed ${THEME.border}`, fontSize: '13.5px' }}>
                                      <span style={{ flex: 1 }}>{sub}</span>
                                      <span style={{ fontSize: '12px', color: THEME.subText, marginRight: '8px' }}>{subCatCounts[`${mainCat} > ${sub}`] || 0}개</span>
                                      {targetCat ? <button onClick={() => deleteCategory(targetCat.id)} aria-label={`${sub} 삭제`} style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex' }}><Trash2 size={15} color="#c62828" /></button> : <span style={{ fontSize: '11px', color: THEME.subText }}>기본</span>}
                                    </div>
                                  );
                                }) : <p style={{ fontSize: '13px', color: THEME.subText, margin: '8px 0' }}>등록된 중분류가 없습니다.</p>}
                                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                                  <input placeholder={`'${mainCat}' 안에 중분류 추가`} value={newSubCats[mainCat] || ''} onChange={e => setNewSubCats({...newSubCats, [mainCat]: e.target.value})} style={{ ...A.input, height: '38px', fontSize: '13px', flex: 1, minWidth: 0 }} />
                                  <button onClick={() => addCategory(mainCat, newSubCats[mainCat])} style={A.smallBtn('dark')}>추가</button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {currentView !== 'admin' && currentView !== 'adminLogin' && renderBusinessFooter()}

      {currentView !== 'detail' && currentView !== 'quotationPreview' && currentView !== 'orderComplete' && (
        <div style={{ position: 'fixed', bottom: 0, width: '100%', backgroundColor: '#fff', display: 'flex', borderTop: `1px solid ${THEME.border}`, paddingTop: '10px', paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 15px)', zIndex: 100 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', color: currentView === 'home' ? THEME.primary : THEME.subText, cursor: 'pointer' }} onClick={handleGoHome}>
            <Home size={24} /><span style={{ fontSize: '11px', marginTop: '6px', fontWeight: currentView === 'home' ? 'bold' : 'normal' }}>홈</span>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', color: currentView === 'category' ? THEME.primary : THEME.subText, cursor: 'pointer' }} onClick={() => setCurrentView('category')}>
            <LayoutGrid size={24} /><span style={{ fontSize: '11px', marginTop: '6px', fontWeight: currentView === 'category' ? 'bold' : 'normal' }}>카테고리</span>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', color: currentView === 'cart' ? THEME.primary : THEME.subText, cursor: 'pointer' }} onClick={() => setCurrentView('cart')}>
            <ShoppingBag size={24} /><span style={{ fontSize: '11px', marginTop: '6px', fontWeight: currentView === 'cart' ? 'bold' : 'normal' }}>장바구니</span>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', color: currentView === 'lookup' ? THEME.primary : THEME.subText, cursor: 'pointer' }} onClick={() => setCurrentView('lookup')}>
            <FileText size={24} /><span style={{ fontSize: '11px', marginTop: '6px', fontWeight: currentView === 'lookup' ? 'bold' : 'normal' }}>주문내역</span>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', color: currentView === 'adminLogin' || currentView === 'admin' ? THEME.primary : '#DDDDDD', cursor: 'pointer' }} onClick={openAdmin}>
            <Lock size={24} /><span style={{ fontSize: '11px', marginTop: '6px', fontWeight: currentView === 'adminLogin' || currentView === 'admin' ? 'bold' : 'normal' }}>관리자</span>
          </div>
        </div>
      )}
    </div>
  );
}