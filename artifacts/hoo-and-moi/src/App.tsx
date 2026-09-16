import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ShoppingBag, Home, CheckCircle, ShieldCheck, ImagePlus, Trash2, Search, ChevronLeft, FileText, LayoutGrid, Lock, Plus, Minus, ChevronDown, ChevronUp, Edit, Share, List, X, Download, Scissors, TrendingUp, ImageIcon, AlertCircle } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

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
  const [currentView, setCurrentView] = useState('home'); 

  // --- 수파베이스 연동 설정 ---
  const [shopSettings, setShopSettings] = useState({
    shop_name: 'Hoo & Moi', shop_name_kr: '후앤모아', admin_password: 'dhrnfl64', kakao_url: 'https://open.kakao.com/o/sy8ZbjNi', shipping_fee: 3500
  });
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
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 20;

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
  const [adminPassword, setAdminPassword] = useState('');
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
  const [adminEditPage, setAdminEditPage] = useState(1);

  // --- 상품 등록/수정 상태 ---
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodCostPrice, setProdCostPrice] = useState(''); 
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
  const [adminCatExpanded, setAdminCatExpanded] = useState<Record<string, boolean>>({});
  const [newMainCat, setNewMainCat] = useState('');
  const [newSubCats, setNewSubCats] = useState<Record<string, string>>({});

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const handleGoHome = () => {
    window.history.replaceState(null, '', window.location.pathname);
    setCurrentView('home');
  };

  useEffect(() => { setCurrentPage(1); }, [activeBrand, activeLargeCat, activeSmallCat, searchQuery]);
  useEffect(() => { setAdminEditPage(1); }, [adminEditSearch, adminEditBrand, adminEditCategory]);

  useEffect(() => {
    fetchProducts(); fetchCategories(); fetchBrands(); fetchNoticesAndBanner(); fetchStoreSettings();
    const handleBeforeInstallPrompt = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (!document.getElementById('daum-postcode-script')) {
      const script = document.createElement('script');
      script.id = 'daum-postcode-script';
      script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
      script.async = true;
      document.head.appendChild(script);
    }
    return () => { window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt); };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    } else {
      alert("아이폰(Safari)은 하단의 [공유] 버튼(↑)을 누르고 [홈 화면에 추가]를 선택해주세요!");
    }
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
      const { data } = await supabase.from('store_settings').select('*').limit(1);
      if (data && data.length > 0) {
        setBankInfo(data[0]); setEditBankInfo(data[0]);
        setShopSettings({
          shop_name: data[0].shop_name || 'Hoo & Moi', shop_name_kr: data[0].shop_name_kr || '후앤모아',
          admin_password: data[0].admin_password || 'dhrnfl64', kakao_url: data[0].kakao_url || 'https://open.kakao.com/o/sy8ZbjNi',
          shipping_fee: data[0].shipping_fee !== undefined ? data[0].shipping_fee : 3500
        });
      }
    } catch (err) {}
  };

  const saveStoreSettings = async () => {
    try {
      const updateData = {
        bank_name: editBankInfo.bank_name, account_number: editBankInfo.account_number, depositor_name: editBankInfo.depositor_name,
        shop_name: shopSettings.shop_name, shop_name_kr: shopSettings.shop_name_kr, admin_password: shopSettings.admin_password, 
        kakao_url: shopSettings.kakao_url, shipping_fee: shopSettings.shipping_fee
      };
      if (!editBankInfo.id) await supabase.from('store_settings').insert([updateData]);
      else await supabase.from('store_settings').update(updateData).eq('id', editBankInfo.id);
      alert("쇼핑몰 설정이 저장되었습니다."); fetchStoreSettings();
    } catch (err:any) { alert("저장 실패: " + err.message); }
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

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (data) {
      setProducts(data);
      const pId = new URLSearchParams(window.location.search).get('productId');
      if (pId) {
        const targetProduct = data.find((p:any) => p.id.toString() === pId);
        if (targetProduct) { setSelectedProduct(targetProduct); setSelectedSize(''); setSelectedColor(''); setQuantity(1); setCurrentView('detail'); }
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
              let gen = []; for(let i = sNum; i <= eNum; i += step) { gen.push(i.toString() + suffix); }
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
      if (main_image) productData.main_image = main_image; 
      if (sub_images_array.length > 0) productData.sub_images = sub_images_array.join(',');
      if (editingProductId && sub_images_array.length === 0 && inputSubImageUrls === '') productData.sub_images = null;

      if (editingProductId) { await supabase.from('products').update(productData).eq('id', editingProductId); alert("수정 완료!"); } 
      else { await supabase.from('products').insert([productData]); alert("등록 완료!"); }

      resetProductForm(); await fetchProducts(); setAdminTab('productEdit');
    } catch (err: any) { alert("오류 발생: " + err.message); } finally { setIsUploading(false); }
  };
  const resetProductForm = () => { setEditingProductId(null); setProdName(''); setProdPrice(''); setProdCostPrice(''); setProdDesc(''); setProdSizes(''); setProdColors(''); setProdCategory(''); setProdBrand(''); setProdFiles(null); setSubProdFiles(null); setInputSubImageUrls(''); setExistingMainImageUrl(''); setImportText(''); };
  const openEditProduct = (p: any) => { setEditingProductId(p.id); setProdName(p.name); setProdPrice(p.price.toString()); setProdCostPrice(p.cost_price ? p.cost_price.toString() : ''); setProdDesc(p.description || ''); setProdSizes(p.sizes || ''); setProdColors(p.colors || ''); setProdCategory(p.category || ''); setProdBrand(p.brand || ''); setExistingMainImageUrl(p.main_image || ''); setInputSubImageUrls(p.sub_images || ''); setAdminTab('productAdd'); };
  const deleteProduct = async (id: string) => { if (window.confirm("상품을 삭제하시겠습니까?")) { await supabase.from('products').delete().eq('id', id); fetchProducts(); } };

  const addToCart = () => {
    if (selectedProduct.sizes && !selectedSize) return alert("사이즈를 선택해주세요!");
    if (selectedProduct.colors && !selectedColor) return alert("색상을 선택해주세요!");
    setCart([...cart, { ...selectedProduct, selectedSize, selectedColor, quantity, cartId: Date.now(), cost_price: selectedProduct.cost_price || 0, brand: selectedProduct.brand }]);
    setShowCartModal(true); 
  };
  const removeFromCart = (cartId: number) => { setCart(cart.filter(item => item.cartId !== cartId)); };

  const totalShippingFee = cart.length > 0 ? shopSettings.shipping_fee : 0;
  const totalItemAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalOrderAmount = totalItemAmount + totalShippingFee;

  const submitOrder = async () => {
    const fullOrderAddress = `${orderAddress} ${orderDetailAddress}`.trim();
    const orderNumber = `HM-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random() * 1000)}`;
    const { data: newOrder, error } = await supabase.from('orders').insert([{ order_number: orderNumber, customer_name: orderName, phone: orderPhone, address: fullOrderAddress, memo: orderMemo, total_amount: totalOrderAmount, status: '입금대기' }]).select();
    if (newOrder && newOrder[0]) {
      const orderItems = cart.map(item => { 
        const optionText = [item.selectedColor, item.selectedSize].filter(Boolean).join(' / '); 
        return { 
          order_id: newOrder[0].id, 
          // 브랜드명이 포함되어 저장되도록 유지
          product_name: `[${item.brand || '자체제작'}] ${item.name} ${optionText ? `(${optionText})` : ''}`, 
          price: item.price, 
          quantity: item.quantity, 
          cost_price: item.cost_price 
        }; 
      });
      await supabase.from('order_items').insert(orderItems);
      setCurrentOrder(newOrder[0]); setCart([]); setCurrentView('orderComplete'); 
    }
  };

  const handleSaveQuotation = async () => {
    alert("❗입금 완료 후 [주문번호, 주문자 정보, 연락처]를 1:1 채팅으로 보내주셔야 최종 주문이 완료됩니다.");
    const text = `[${shopSettings.shop_name_kr} 입금확인 요청]\n주문번호: ${currentOrder.order_number}\n주문자: ${currentOrder.customer_name}\n연락처: ${currentOrder.phone}\n입금액: ${currentOrder.total_amount.toLocaleString()}원`;
    try { await navigator.clipboard.writeText(text); alert("복사되었습니다! 1:1 채팅창에 붙여넣어주세요."); } catch (e) { alert("복사에 실패했습니다."); }
  };

  // 🔒 주문 조회 보안 강화 (연락처 필수)
  const searchMyOrder = async () => {
    if(!lookupPhone) return alert("보안을 위해 주문 시 입력한 '연락처'를 반드시 입력해주세요.");
    if(!lookupOrderNumber && !lookupName) return alert("연락처와 함께 '주문번호' 또는 '주문자 이름'을 입력해주세요.");

    try {
      let query = supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).eq('phone', lookupPhone);

      if (lookupOrderNumber) query = query.eq('order_number', lookupOrderNumber);
      else if (lookupName) query = query.eq('customer_name', lookupName);

      const { data } = await query;
      if (data && data.length > 0) setMyOrders(data); 
      else alert("입력하신 정보와 일치하는 주문 내역이 없습니다. 연락처나 이름을 다시 확인해주세요.");
    } catch (err) {}
  };

  const openCustomerEdit = (order: any) => { setEditingCustomerOrderId(order.id); setEditOrderInputs({ name: order.customer_name, phone: order.phone, address: order.address, memo: order.memo || '' }); };
  const saveCustomerEdit = async (id: string) => { await supabase.from('orders').update({ customer_name: editOrderInputs.name, phone: editOrderInputs.phone, address: editOrderInputs.address, memo: editOrderInputs.memo }).eq('id', id); alert("수정되었습니다."); setEditingCustomerOrderId(null); searchMyOrder(); };

  const fetchAdminOrders = async () => { const { data } = await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }); if (data) setAdminOrders(data); };
  const handleAdminLogin = async () => { if (adminPassword === shopSettings.admin_password) { await fetchAdminOrders(); setCurrentView('admin'); } else alert("비밀번호 오류"); };
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
    window.history.replaceState(null, '', `${window.location.pathname}?productId=${p.id}`);
    setSelectedProduct(p); setSelectedSize(''); setSelectedColor(''); setQuantity(1); setCurrentView('detail');
  };

  // --- 화면 노출용 상품 데이터 (페이징 적용) ---
  const displayProducts = products.filter(p => {
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

  const totalPages = Math.max(1, Math.ceil(displayProducts.length / productsPerPage));
  const currentProducts = displayProducts.slice((currentPage - 1) * productsPerPage, currentPage * productsPerPage);

  const adminDisplayProducts = products.filter(p => {
    const matchBrand = adminEditBrand === '전체' || p.brand === adminEditBrand;
    const matchCategory = adminEditCategory === '전체' || (p.category && p.category.startsWith(adminEditCategory));
    const normalize = (str: string) => (str || '').replace(/\s+/g, '').toLowerCase();
    const matchSearch = !adminEditSearch || normalize(p.name).includes(normalize(adminEditSearch)) || normalize(p.brand).includes(normalize(adminEditSearch));
    return matchBrand && matchCategory && matchSearch;
  });
  const adminTotalPages = Math.max(1, Math.ceil(adminDisplayProducts.length / productsPerPage));
  const adminCurrentProducts = adminDisplayProducts.slice((adminEditPage - 1) * productsPerPage, adminEditPage * productsPerPage);

  const filteredAdminOrders = adminOrders.filter(o => adminFilter === '전체' ? true : adminFilter === '취소/환불' ? (o.status === '주문취소' || o.status === '환불처리') : o.status === adminFilter);

  // 🏷️ 주문 내역 렌더링 함수 (브랜드 분리/강조 로직)
  const renderOrderItem = (item: any, idx: number) => {
    let brandName = '';
    let itemName = item.product_name;
    // "[브랜드명] 상품명" 구조에서 브랜드명 추출
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

  return (
    <div style={{ backgroundColor: THEME.bg, minHeight: '100vh', fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif", paddingBottom: '110px', color: THEME.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&display=swap');
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
        * { font-family: 'Pretendard', sans-serif; letter-spacing: -0.3px; }
        .serif-text { font-family: 'Noto Serif KR', serif !important; }
        input, textarea, button, select { outline: none; }
        input:focus, textarea:focus { border-color: ${THEME.primary} !important; }
      `}</style>

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

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', backgroundColor: '#fff', position: 'sticky', top: 0, zIndex: 100, borderBottom: `1px solid ${THEME.border}` }}>
        <div style={{ width: '80px', display: 'flex', alignItems: 'center' }}>
           {currentView !== 'home' ? ( <ChevronLeft size={28} onClick={handleGoHome} style={{ cursor: 'pointer', color: THEME.text }}/>
           ) : (
             <div onClick={handleInstallClick} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', backgroundColor: THEME.primaryLight, padding: '6px 10px', borderRadius: '15px' }}>
               <Download size={14} color={THEME.primary} />
               <span style={{fontSize: '12px', color: THEME.primary, fontWeight: 'bold', whiteSpace: 'nowrap'}}>앱 다운</span>
             </div>
           )}
        </div>
        <h1 className="serif-text" style={{ color: THEME.brown, fontSize: '26px', fontWeight: '700', margin: 0, textAlign: 'center', cursor: 'pointer', flex: 1 }} onClick={handleGoHome}>{shopSettings.shop_name}</h1>
        <div style={{ position: 'relative', cursor: 'pointer', width: '80px', display: 'flex', justifyContent: 'flex-end' }} onClick={() => setCurrentView('cart')}>
          <div style={{ position: 'relative' }}>
            <ShoppingBag size={24} color={THEME.text} />
            {cart.length > 0 && <span style={{ position: 'absolute', top: '-5px', right: '-5px', backgroundColor: THEME.primary, color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '11px', fontWeight: 'bold' }}>{cart.length}</span>}
          </div>
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

            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <input placeholder="상품명, 브랜드 검색" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '14px 15px 14px 40px', borderRadius: '25px', border: `1px solid ${THEME.border}`, backgroundColor: '#fff', fontSize: '14px' }} />
              <Search size={18} color={THEME.subText} style={{ position: 'absolute', left: '15px', top: '14px' }} />
            </div>

            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '10px', scrollbarWidth: 'none' }}>
              <button onClick={() => { setActiveLargeCat('전체'); setActiveSmallCat('전체'); }} style={{ padding: '8px 18px', borderRadius: '20px', fontSize: '14px', fontWeight: activeLargeCat === '전체' ? 'bold' : 'normal', border: activeLargeCat === '전체' ? 'none' : `1px solid ${THEME.border}`, backgroundColor: activeLargeCat === '전체' ? THEME.primary : '#fff', color: activeLargeCat === '전체' ? 'white' : THEME.text, whiteSpace: 'nowrap', transition: '0.2s' }}>전체</button>
              {Object.keys(categoryTree).map(main => (
                <button key={main} onClick={() => { setActiveLargeCat(main); setActiveSmallCat('전체'); }} style={{ padding: '8px 18px', borderRadius: '20px', fontSize: '14px', fontWeight: activeLargeCat === main ? 'bold' : 'normal', border: activeLargeCat === main ? 'none' : `1px solid ${THEME.border}`, backgroundColor: activeLargeCat === main ? THEME.primary : '#fff', color: activeLargeCat === main ? 'white' : THEME.text, whiteSpace: 'nowrap', transition: '0.2s' }}>{main}</button>
              ))}
            </div>
            {activeLargeCat !== '전체' && categoryTree[activeLargeCat] && categoryTree[activeLargeCat].length > 0 && (
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '20px', scrollbarWidth: 'none' }}>
                <button onClick={() => setActiveSmallCat('전체')} style={{ padding: '6px 14px', borderRadius: '15px', fontSize: '13px', fontWeight: activeSmallCat === '전체' ? 'bold' : 'normal', border: `1px solid ${activeSmallCat === '전체' ? THEME.primary : THEME.border}`, backgroundColor: activeSmallCat === '전체' ? THEME.primaryLight : '#fff', color: activeSmallCat === '전체' ? THEME.primary : THEME.subText, whiteSpace: 'nowrap' }}>전체보기</button>
                {categoryTree[activeLargeCat].map((sub: string) => (
                  <button key={sub} onClick={() => setActiveSmallCat(sub)} style={{ padding: '6px 14px', borderRadius: '15px', fontSize: '13px', fontWeight: activeSmallCat === sub ? 'bold' : 'normal', border: `1px solid ${activeSmallCat === sub ? THEME.primary : THEME.border}`, backgroundColor: activeSmallCat === sub ? THEME.primaryLight : '#fff', color: activeSmallCat === sub ? THEME.primary : THEME.subText, whiteSpace: 'nowrap' }}>{sub}</button>
                ))}
              </div>
            )}

            {currentProducts.length > 0 ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '10px' }}>
                  {currentProducts.map((p) => (
                    <div key={p.id} onClick={() => openProductDetail(p)} style={{ cursor: 'pointer' }}>
                      <div style={{ position: 'relative', marginBottom: '12px' }}>
                        <img src={p.main_image} style={{ width: '100%', borderRadius: '12px', aspectRatio: '4/5', objectFit: 'cover', backgroundColor: '#eee' }} />
                        {isNewProduct(p.created_at) && <span style={{ position: 'absolute', top: '8px', left: '8px', backgroundColor: THEME.primary, color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(240,106,125,0.3)' }}>✨ NEW</span>}
                      </div>
                      <p style={{ fontSize: '12px', fontWeight: 'bold', color: THEME.primary, margin: '0 0 4px 0' }}>{p.brand || '자체제작'}</p>
                      <h3 style={{ fontSize: '15px', margin: '0 0 6px 0', fontWeight: '500', color: THEME.text, lineHeight: '1.3' }}>{p.name}</h3>
                      {p.sizes && <p style={{ fontSize: '12px', color: THEME.subText, margin: '0 0 6px 0' }}>{p.sizes}</p>}
                      <p style={{ fontSize: '17px', fontWeight: 'bold', color: THEME.text, margin: 0 }}>{p.price.toLocaleString()}원</p>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '40px', paddingBottom: '20px' }}>
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '8px 16px', borderRadius: '20px', border: `1px solid ${currentPage === 1 ? THEME.border : THEME.primary}`, backgroundColor: currentPage === 1 ? '#f9f9f9' : '#fff', color: currentPage === 1 ? '#ccc' : THEME.primary, fontWeight: 'bold', cursor: currentPage === 1 ? 'default' : 'pointer' }}>이전</button>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: THEME.text }}>{currentPage} / {totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: '8px 16px', borderRadius: '20px', border: `1px solid ${currentPage === totalPages ? THEME.border : THEME.primary}`, backgroundColor: currentPage === totalPages ? '#f9f9f9' : '#fff', color: currentPage === totalPages ? '#ccc' : THEME.primary, fontWeight: 'bold', cursor: currentPage === totalPages ? 'default' : 'pointer' }}>다음</button>
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
            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 30px 0' }}>{selectedProduct.price.toLocaleString()}원</p>
            <div style={{ height: '1px', backgroundColor: THEME.border, margin: '20px 0' }}></div>

            {selectedProduct.colors && (
              <div style={{ marginBottom: '25px' }}>
                <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>색상</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {selectedProduct.colors.split(',').map((c: string) => (
                    <button key={c} onClick={() => setSelectedColor(c.trim())} style={{ padding: '10px 20px', borderRadius: '25px', border: selectedColor === c.trim() ? `2px solid ${THEME.primary}` : `1px solid ${THEME.border}`, backgroundColor: selectedColor === c.trim() ? THEME.primaryLight : '#fff', color: selectedColor === c.trim() ? THEME.primary : THEME.text, fontWeight: selectedColor === c.trim() ? 'bold' : 'normal', fontSize: '14px', transition: '0.2s' }}>{c.trim()}</button>
                  ))}
                </div>
              </div>
            )}
            {selectedProduct.sizes && (
              <div style={{ marginBottom: '25px' }}>
                <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>사이즈</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {selectedProduct.sizes.split(',').map((s: string) => (
                    <button key={s} onClick={() => setSelectedSize(s.trim())} style={{ padding: '10px 24px', borderRadius: '25px', border: selectedSize === s.trim() ? `2px solid ${THEME.primary}` : `1px solid ${THEME.border}`, backgroundColor: selectedSize === s.trim() ? THEME.primaryLight : '#fff', color: selectedSize === s.trim() ? THEME.primary : THEME.text, fontWeight: selectedSize === s.trim() ? 'bold' : 'normal', fontSize: '14px', transition: '0.2s' }}>{s.trim()}</button>
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
            <button onClick={addToCart} style={{ width: '100%', padding: '16px', backgroundColor: THEME.primary, color: 'white', border: 'none', borderRadius: '30px', fontSize: '16px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: '0 4px 15px rgba(240,106,125,0.2)' }}>
               <ShoppingBag size={20} /> 담기
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
          <button onClick={submitOrder} style={{ width: '100%', padding: '16px', backgroundColor: THEME.primary, color: 'white', border: 'none', borderRadius: '30px', fontSize: '16px', fontWeight: 'bold' }}>주문하기</button>
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
          <button onClick={() => {
            alert("❗입금 완료 후 [주문번호, 주문자 정보, 연락처]를 1:1 채팅으로 보내주셔야 최종 주문이 완료됩니다.");
            const text = `[${shopSettings.shop_name_kr} 입금확인 요청]\n주문번호: ${currentOrder.order_number}\n주문자: ${currentOrder.customer_name}\n연락처: ${currentOrder.phone}\n입금액: ${currentOrder.total_amount.toLocaleString()}원`;
            try { navigator.clipboard.writeText(text); alert("요청 메시지가 복사되었습니다! 1:1 채팅창에 붙여넣어주세요."); } catch (e) { alert("복사에 실패했습니다."); }
          }} style={{ width: '100%', padding: '16px', backgroundColor: THEME.primary, color: 'white', border: 'none', borderRadius: '30px', fontSize: '16px', fontWeight: 'bold', marginBottom: '30px' }}>주문 견적서 복사하기</button>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '30px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => window.open(shopSettings.kakao_url, '_blank')}>
              <div style={{ backgroundColor: '#333', padding: '15px', borderRadius: '50%' }}><Share size={20} color="#fff" /></div>
              <span style={{ fontSize: '13px', color: THEME.text }}>1:1 채팅</span>
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
        </div>
      )}

      {/* --- 주문 내역 조회 (보안 강화) --- */}
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
          <input type="password" placeholder="비밀번호" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: `1px solid ${THEME.border}`, marginBottom: '20px', fontSize: '15px', textAlign: 'center' }} />
          <button onClick={handleAdminLogin} style={{ width: '100%', padding: '16px', backgroundColor: THEME.primary, color: 'white', border: 'none', borderRadius: '30px', fontWeight: 'bold', fontSize: '16px' }}>접속하기</button>
        </div>
      )}

      {currentView === 'admin' && (
        <div style={{ padding: '20px', paddingBottom: '100px' }}>
          <div style={{ display: 'flex', borderBottom: `2px solid ${THEME.border}`, marginBottom: '20px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            <div onClick={() => setAdminTab('orders')} style={{ whiteSpace: 'nowrap', padding: '12px 15px', fontWeight: 'bold', borderBottom: adminTab === 'orders' ? `3px solid ${THEME.primary}` : 'none', color: adminTab === 'orders' ? THEME.primary : THEME.subText, cursor: 'pointer' }}>주문 관리</div>
            <div onClick={() => { setAdminTab('productAdd'); resetProductForm(); }} style={{ whiteSpace: 'nowrap', padding: '12px 15px', fontWeight: 'bold', borderBottom: adminTab === 'productAdd' ? `3px solid ${THEME.primary}` : 'none', color: adminTab === 'productAdd' ? THEME.primary : THEME.subText, cursor: 'pointer' }}>상품 등록</div>
            <div onClick={() => { setAdminTab('productEdit'); setAdminEditPage(1); }} style={{ whiteSpace: 'nowrap', padding: '12px 15px', fontWeight: 'bold', borderBottom: adminTab === 'productEdit' ? `3px solid ${THEME.primary}` : 'none', color: adminTab === 'productEdit' ? THEME.primary : THEME.subText, cursor: 'pointer' }}>상품 수정</div>
            <div onClick={() => setAdminTab('settings')} style={{ whiteSpace: 'nowrap', padding: '12px 15px', fontWeight: 'bold', borderBottom: adminTab === 'settings' ? `3px solid ${THEME.primary}` : 'none', color: adminTab === 'settings' ? THEME.primary : THEME.subText, cursor: 'pointer' }}>설정</div>
            <div onClick={() => setAdminTab('dashboard')} style={{ whiteSpace: 'nowrap', padding: '12px 15px', fontWeight: 'bold', borderBottom: adminTab === 'dashboard' ? `3px solid ${THEME.primary}` : 'none', color: adminTab === 'dashboard' ? THEME.primary : THEME.subText, cursor: 'pointer' }}>매출/수익</div>
          </div>

          {/* 📊 매출/수익 대시보드 */}
          {adminTab === 'dashboard' && (
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>통계 대시보드 (진행중인 주문)</h3>
              <p style={{ fontSize: '13px', color: THEME.subText, marginBottom: '20px' }}>결제완료/배송지연/발송완료 상태의 주문만 합산됩니다.</p>
              <div style={{ backgroundColor: THEME.primary, color: 'white', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(240,106,125,0.2)', marginBottom: '15px' }}>
                <p style={{ fontSize: '14px', margin: '0 0 10px 0', opacity: 0.9 }}>총 결제금액 (고객 실 입금액)</p>
                <p style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>{stats.totalOrderAmount.toLocaleString()}원</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                <div style={{ backgroundColor: '#fff', border: `1px solid ${THEME.border}`, padding: '20px', borderRadius: '16px' }}>
                  <p style={{ fontSize: '13px', color: THEME.subText, margin: '0 0 10px 0' }}>총 상품매출</p>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: THEME.text }}>{stats.totalProductSales.toLocaleString()}원</p>
                </div>
                <div style={{ backgroundColor: '#fff', border: `1px solid ${THEME.border}`, padding: '20px', borderRadius: '16px' }}>
                  <p style={{ fontSize: '13px', color: THEME.subText, margin: '0 0 10px 0' }}>총 매입원가</p>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#c62828' }}>- {stats.totalCost.toLocaleString()}원</p>
                </div>
              </div>
              <div style={{ backgroundColor: THEME.primaryLight, border: `2px solid ${THEME.primary}`, padding: '25px', borderRadius: '16px', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}><TrendingUp color={THEME.primary} size={30} /></div>
                <p style={{ fontSize: '15px', color: THEME.primary, margin: '0 0 5px 0', fontWeight: 'bold' }}>순수익 (상품매출 - 매입원가)</p>
                <p style={{ fontSize: '32px', fontWeight: 'bold', color: THEME.text, margin: 0 }}>{stats.netProfit.toLocaleString()}원</p>
              </div>
            </div>
          )}

          {/* 🧾 주문 관리 탭 */}
          {adminTab === 'orders' && (
            <div>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '15px', scrollbarWidth: 'none' }}>
                <button onClick={() => setAdminFilter('전체')} style={{ padding: '8px 16px', borderRadius: '20px', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 'bold', border: adminFilter === '전체' ? 'none' : `1px solid ${THEME.border}`, backgroundColor: adminFilter === '전체' ? THEME.text : '#fff', color: adminFilter === '전체' ? 'white' : THEME.subText }}>전체 {adminOrders.length}</button>
                {['입금대기', '결제완료', '배송지연', '발송완료'].map(filter => (
                  <button key={filter} onClick={() => setAdminFilter(filter)} style={{ padding: '8px 16px', borderRadius: '20px', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 'bold', border: adminFilter === filter ? 'none' : `1px solid ${THEME.border}`, backgroundColor: adminFilter === filter ? THEME.text : '#fff', color: adminFilter === filter ? 'white' : THEME.subText }}>
                    {filter} {adminOrders.filter(o => o.status === filter).length}
                  </button>
                ))}
              </div>

              {filteredAdminOrders.map(order => {
                const sStyle = getStatusStyle(order.status);
                const isEditing = editingOrderId === order.id;
                const itemTotal = order.order_items ? order.order_items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) : 0;
                const shippingFee = order.total_amount - itemTotal;
                const isItemsExpanded = expandedOrderItems[order.id];

                return (
                  <div key={order.id} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '16px', marginBottom: '20px', borderTop: `6px solid ${sStyle.bg}`, boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 'bold' }}>{order.order_number}</span>
                      <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', backgroundColor: sStyle.bg, color: sStyle.text }}>{order.status}</span>
                    </div>
                    <p style={{ fontSize: '12px', color: THEME.subText, margin: '0 0 15px 0' }}>{new Date(order.created_at).toLocaleString()}</p>

                    <div style={{ backgroundColor: THEME.bg, padding: '15px', borderRadius: '12px', marginBottom: '15px', fontSize: '13px', color: '#555' }}>
                      <p style={{ margin: '0 0 6px 0', fontWeight: 'bold', color: THEME.text }}>{order.customer_name} <span style={{fontWeight:'normal', color:THEME.subText}}>({order.phone})</span></p>
                      <p style={{ margin: '0 0 6px 0' }}>{order.address}</p>
                      {order.memo && <p style={{ margin: 0, color: THEME.primary }}>요청: {order.memo}</p>}
                    </div>

                    {/* 주문 상품 상세 (아코디언 기능) */}
                    <div style={{ borderTop: `1px dashed ${THEME.border}`, paddingTop: '15px', marginBottom: '20px' }}>
                      <div onClick={() => setExpandedOrderItems({...expandedOrderItems, [order.id]: !isItemsExpanded})} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isItemsExpanded ? '15px' : '0' }}>
                         <p style={{ fontSize: '14px', fontWeight: 'bold', margin: 0, color: THEME.text }}>주문 상품 상세 <span style={{color: THEME.primary}}>({order.order_items?.length || 0}건)</span></p>
                         <span style={{ fontSize: '12px', color: THEME.subText, backgroundColor: THEME.bg, padding: '4px 10px', borderRadius: '15px' }}>{isItemsExpanded ? '접어두기 ▲' : '펼쳐보기 ▼'}</span>
                      </div>

                      {isItemsExpanded && (
                        <div>
                          {order.order_items && order.order_items.map((item:any, i:number) => renderOrderItem(item, i))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: THEME.subText, marginBottom: '8px' }}>
                      <span>상품 합계</span><span>{itemTotal.toLocaleString()}원</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: THEME.subText, marginBottom: '20px' }}>
                      <span>배송비</span><span>{shippingFee.toLocaleString()}원</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ fontSize: '20px', margin: 0, fontWeight: 'bold', color: THEME.primary }}>{order.total_amount.toLocaleString()}원</p>
                      <button onClick={() => setEditingOrderId(isEditing ? null : order.id)} style={{ padding: '8px 16px', borderRadius: '20px', border: `1px solid ${THEME.border}`, fontSize: '13px', fontWeight: 'bold', backgroundColor: isEditing ? THEME.bg : '#fff' }}>{isEditing ? '닫기' : '관리/수정'}</button>
                    </div>

                    {isEditing && (
                      <div style={{ padding: '15px', backgroundColor: THEME.bg, borderRadius: '12px', marginTop: '20px' }}>
                        <input placeholder="송장번호 (예: CJ 12345)" defaultValue={order.tracking_number || ''} onChange={e => setTrackingInputs({...trackingInputs, [order.id]: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${THEME.border}`, marginBottom: '10px', fontSize: '13px' }} />
                        <input placeholder="고객 안내 메모" defaultValue={order.admin_memo || ''} onChange={e => setAdminMemoInputs({...adminMemoInputs, [order.id]: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${THEME.border}`, marginBottom: '15px', fontSize: '13px' }} />
                        <button onClick={() => saveOrderInfo(order.id, order.tracking_number, order.admin_memo)} style={{ width: '100%', padding: '12px', backgroundColor: THEME.text, color: 'white', border: 'none', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', fontWeight: 'bold' }}>저장</button>

                        <p style={{ fontSize: '12px', fontWeight: 'bold', color: THEME.subText, marginBottom: '10px' }}>상태 변경</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '15px' }}>
                          <button onClick={() => updateOrderStatus(order.id, '결제완료')} style={{ padding: '10px', backgroundColor: '#1976d2', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>결제승인</button>
                          <button onClick={() => updateOrderStatus(order.id, '발송완료')} style={{ padding: '10px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>발송완료</button>
                          <button onClick={() => updateOrderStatus(order.id, '배송지연')} style={{ padding: '10px', backgroundColor: '#ff9800', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>배송지연</button>
                          <button onClick={() => updateOrderStatus(order.id, '주문취소')} style={{ padding: '10px', backgroundColor: '#c62828', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>주문취소</button>
                          <button onClick={() => updateOrderStatus(order.id, '환불처리')} style={{ padding: '10px', backgroundColor: '#9e9e9e', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>환불처리</button>
                        </div>
                        <button onClick={() => deleteOrder(order.id)} style={{ width: '100%', padding: '12px', backgroundColor: '#fff', color: '#c62828', border: '1px solid #c62828', borderRadius: '8px', fontSize: '13px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}><Trash2 size={16} /> 주문 영구 삭제</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 📦 상품 등록 */}
          {adminTab === 'productAdd' && (
            <div style={{ backgroundColor: '#fff', paddingBottom: '30px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>

              <div style={{ display: 'flex', gap: '15px', padding: '20px', backgroundColor: THEME.bg }}>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '180px', backgroundColor: '#fff', borderRadius: '12px', border: `1px dashed ${THEME.border}`, cursor: 'pointer' }}>
                  <ImagePlus color={THEME.primary} size={36} style={{ marginBottom: '10px' }} />
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: THEME.text, textAlign: 'center' }}>{editingProductId ? '썸네일 교체' : '대표 사진 첨부'}<br/><span style={{color:THEME.primary}}>(필수)</span></span>
                  {prodFiles && <span style={{ marginTop: '8px', fontSize: '12px', color: THEME.primary, fontWeight: 'bold' }}>{prodFiles.length}장 선택됨</span>}
                  {existingMainImageUrl && !prodFiles && <span style={{ marginTop: '8px', fontSize: '11px', color: THEME.subText }}>등록됨</span>}
                  <input type="file" accept="image/*" multiple onChange={(e) => setProdFiles(e.target.files)} style={{ display: 'none' }} />
                </label>

                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '180px', backgroundColor: '#fff', borderRadius: '12px', border: `1px dashed ${THEME.border}`, cursor: 'pointer' }}>
                  <ImageIcon color={THEME.subText} size={36} style={{ marginBottom: '10px' }} />
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: THEME.text, textAlign: 'center' }}>상세 사진 파일<br/>직접 첨부 (선택)</span>
                  {subProdFiles && <span style={{ marginTop: '8px', fontSize: '12px', color: THEME.primary, fontWeight: 'bold' }}>{subProdFiles.length}장 추가됨</span>}
                  <input type="file" accept="image/*" multiple onChange={(e) => setSubProdFiles(e.target.files)} style={{ display: 'none' }} />
                </label>
              </div>

              {!editingProductId && (
                <div style={{ padding: '20px', backgroundColor: THEME.primaryLight, borderBottom: `1px dashed ${THEME.primary}`, borderTop: `1px solid ${THEME.border}` }}>
                  <p style={{ fontSize: '14px', fontWeight: 'bold', color: THEME.primary, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Scissors size={16} /> 도매 상품 스마트 복붙 (옵션 추출)
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <textarea 
                      placeholder="도매 사이트 화면의 글자를 쭉 드래그해서 복사한 후 여기에 붙여넣으세요. (이름, 소비자가, 판매가, 색상, 사이즈 포함)" 
                      value={importText} 
                      onChange={e => setImportText(e.target.value)} 
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', fontSize: '13px', resize: 'none', height: '80px' }} 
                    />
                    <button onClick={handleSmartPaste} style={{ width: '100%', padding: '12px', backgroundColor: THEME.primary, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                      텍스트 자동 분석하기
                    </button>
                  </div>
                </div>
              )}

              <div style={{ padding: '25px 20px' }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                  <select value={prodBrand} onChange={e => setProdBrand(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: `1px solid ${THEME.border}`, backgroundColor: '#fff', fontSize: '14px' }}>
                    <option value="" disabled>브랜드 선택</option>
                    {(brands || []).map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                  <select value={prodCategory} onChange={e => setProdCategory(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: `1px solid ${THEME.border}`, backgroundColor: '#fff', fontSize: '14px' }}>
                    <option value="" disabled>종류 선택</option>
                    {(categories || []).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <input placeholder="상품명을 입력하세요" value={prodName} onChange={e => setProdName(e.target.value)} style={{ width: '100%', fontSize: '24px', fontWeight: 'bold', border: 'none', borderBottom: `1px solid ${THEME.border}`, paddingBottom: '15px', marginBottom: '20px', outline: 'none' }} />

                <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '12px', color: THEME.primary, fontWeight: 'bold', marginBottom: '5px' }}>고객 판매가 (소비자가)</p>
                    <input type="number" placeholder="예: 25000" value={prodPrice} onChange={e => setProdPrice(e.target.value)} style={{ width: '100%', fontSize: '18px', fontWeight: 'bold', border: 'none', borderBottom: `2px solid ${THEME.primary}`, paddingBottom: '10px', outline: 'none' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '12px', color: THEME.subText, fontWeight: 'bold', marginBottom: '5px' }}>비밀 매입원가 (도매가)</p>
                    <input type="number" placeholder="예: 15000" value={prodCostPrice} onChange={e => setProdCostPrice(e.target.value)} style={{ width: '100%', fontSize: '18px', fontWeight: 'bold', border: 'none', borderBottom: `1px solid ${THEME.border}`, paddingBottom: '10px', outline: 'none', color: THEME.subText }} />
                  </div>
                </div>

                <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: THEME.text }}>옵션 입력 (선택사항 / 쉼표로 구분)</p>
                <input placeholder="색상 (예: 소라, 브라운)" value={prodColors} onChange={e => setProdColors(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${THEME.border}`, marginBottom: '15px', fontSize: '14px' }} />
                <input placeholder="사이즈 (예: 1(XS), 2(S), 3(M))" value={prodSizes} onChange={e => setProdSizes(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${THEME.border}`, marginBottom: '25px', fontSize: '14px' }} />

                <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: THEME.text }}>상세 설명</p>
                <textarea placeholder="간단한 설명을 적어주세요." rows={3} value={prodDesc} onChange={e => setProdDesc(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${THEME.border}`, fontSize: '14px', resize: 'none', lineHeight: '1.6', marginBottom: '20px' }} />

                <div style={{ backgroundColor: '#fffbe6', border: '1px solid #ffe58f', padding: '15px', borderRadius: '12px', marginBottom: '15px' }}>
                   <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#d48806', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}><AlertCircle size={16} /> 외부 상세 이미지 링크 붙여넣기 (권장)</p>
                   <p style={{ fontSize: '12px', color: '#888', marginBottom: '10px', lineHeight: '1.4' }}>사진을 직접 첨부하면 쇼핑몰 로딩이 느려질 수 있습니다.<br/>도매 사이트의 이미지 주소(URL)를 복사하여 이곳에 쉼표(,)나 엔터로 구분하여 붙여넣으시는 것을 가장 추천합니다.</p>
                   <textarea placeholder="예: https://image.com/detail1.jpg, https://image.com/detail2.jpg" value={inputSubImageUrls} onChange={e => setInputSubImageUrls(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid #ffe58f`, fontSize: '13px', resize: 'none', height: '80px', backgroundColor: '#fff' }} />
                </div>
              </div>

              <div style={{ padding: '0 20px', display: 'flex', gap: '10px' }}>
                {editingProductId && <button onClick={resetProductForm} style={{ flex: 1, padding: '16px', backgroundColor: THEME.bg, color: THEME.text, borderRadius: '30px', fontWeight: 'bold', fontSize: '15px', border: 'none' }}>취소</button>}
                <button onClick={handleSaveProduct} disabled={isUploading} style={{ flex: 2, padding: '16px', backgroundColor: isUploading ? '#ccc' : THEME.primary, color: 'white', borderRadius: '30px', fontWeight: 'bold', fontSize: '16px', border: 'none', boxShadow: '0 4px 15px rgba(240,106,125,0.2)' }}>{isUploading ? '업로드 중...' : (editingProductId ? '수정 내용 저장' : '이 상품 등록하기')}</button>
              </div>
            </div>
          )}

          {/* 📝 상품 수정 탭 */}
          {adminTab === 'productEdit' && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', backgroundColor: '#fff', padding: '15px', borderRadius: '16px', border: `1px solid ${THEME.border}` }}>
                <div style={{ position: 'relative' }}>
                  <input placeholder="상품명 또는 브랜드 검색" value={adminEditSearch} onChange={(e) => setAdminEditSearch(e.target.value)} style={{ width: '100%', padding: '12px 15px 12px 35px', borderRadius: '8px', border: `1px solid ${THEME.border}`, fontSize: '14px' }} />
                  <Search size={16} color={THEME.subText} style={{ position: 'absolute', left: '12px', top: '13px' }} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select value={adminEditBrand} onChange={(e) => setAdminEditBrand(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${THEME.border}`, fontSize: '13px', backgroundColor: THEME.bg }}>
                    <option value="전체">모든 브랜드</option>
                    {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                  <select value={adminEditCategory} onChange={(e) => setAdminEditCategory(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${THEME.border}`, fontSize: '13px', backgroundColor: THEME.bg }}>
                    <option value="전체">모든 카테고리</option>
                    {Object.keys(categoryTree).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {adminCurrentProducts.length > 0 ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                    {adminCurrentProducts.map(p => (
                      <div key={p.id} style={{ display: 'flex', gap: '15px', backgroundColor: '#fff', padding: '15px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                        <img src={p.main_image} style={{ width: '90px', height: '110px', objectFit: 'cover', borderRadius: '10px' }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <p style={{ fontSize: '13px', fontWeight: 'bold', color: THEME.primary, margin: '0 0 6px 0' }}>{p.brand}</p>
                          <p style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 6px 0' }}>{p.name}</p>
                          <p style={{ fontSize: '15px', color: THEME.text, margin: '0 0 5px 0' }}>판매가: {p.price.toLocaleString()}원</p>
                          <p style={{ fontSize: '12px', color: THEME.subText, margin: '0 0 15px 0' }}>매입원가: {(p.cost_price || 0).toLocaleString()}원</p>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => openEditProduct(p)} style={{ flex: 1, padding: '8px', backgroundColor: THEME.text, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}><Edit size={14} /> 수정</button>
                            <button onClick={() => deleteProduct(p.id)} style={{ flex: 1, padding: '8px', backgroundColor: '#fff', color: '#c62828', border: '1px solid #c62828', borderRadius: '8px', fontSize: '13px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}><Trash2 size={14} /> 삭제</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '30px' }}>
                    <button onClick={() => setAdminEditPage(p => Math.max(1, p - 1))} disabled={adminEditPage === 1} style={{ padding: '8px 16px', borderRadius: '20px', border: `1px solid ${adminEditPage === 1 ? THEME.border : THEME.text}`, backgroundColor: adminEditPage === 1 ? '#f9f9f9' : '#fff', color: adminEditPage === 1 ? '#ccc' : THEME.text, fontWeight: 'bold', cursor: adminEditPage === 1 ? 'default' : 'pointer' }}>이전</button>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: THEME.text }}>{adminEditPage} / {adminTotalPages}</span>
                    <button onClick={() => setAdminEditPage(p => Math.min(adminTotalPages, p + 1))} disabled={adminEditPage === adminTotalPages} style={{ padding: '8px 16px', borderRadius: '20px', border: `1px solid ${adminEditPage === adminTotalPages ? THEME.border : THEME.text}`, backgroundColor: adminEditPage === adminTotalPages ? '#f9f9f9' : '#fff', color: adminEditPage === adminTotalPages ? '#ccc' : THEME.text, fontWeight: 'bold', cursor: adminEditPage === adminTotalPages ? 'default' : 'pointer' }}>다음</button>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 0', color: THEME.subText, fontSize: '14px' }}>검색 조건에 맞는 상품이 없습니다.</div>
              )}
            </div>
          )}

          {/* ⚙️ 통합 설정 탭 */}
          {adminTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                <h3 style={{ fontSize: '18px', marginBottom: '10px', fontWeight: 'bold', color: THEME.text }}>📝 홈 화면 메인 문구 변경</h3>
                <p style={{ fontSize: '13px', color: THEME.subText, marginBottom: '20px' }}>홈 화면 상단에 노출되는 두 줄의 인사말을 변경합니다.</p>
                <p style={{ fontSize: '13px', fontWeight: 'bold', color: THEME.text, marginBottom: '8px' }}>메인 문구 (큰 글씨)</p>
                <textarea rows={2} value={introMainInput} onChange={e => setIntroMainInput(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: `1px solid ${THEME.border}`, fontSize: '14px', resize: 'none', marginBottom: '15px' }} />
                <p style={{ fontSize: '13px', fontWeight: 'bold', color: THEME.text, marginBottom: '8px' }}>서브 문구 (작은 글씨)</p>
                <textarea rows={2} value={introSubInput} onChange={e => setIntroSubInput(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: `1px solid ${THEME.border}`, fontSize: '14px', resize: 'none', marginBottom: '15px' }} />
                <button onClick={handleSaveIntro} disabled={isIntroUploading} style={{ width: '100%', padding: '14px', backgroundColor: THEME.primary, color: 'white', borderRadius: '10px', fontWeight: 'bold', border: 'none' }}>{isIntroUploading ? '저장중...' : '문구 변경 적용하기'}</button>
              </div>

              <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                <h3 style={{ fontSize: '18px', marginBottom: '10px', fontWeight: 'bold', color: THEME.text }}>🖼️ 메인 배너 이미지 관리</h3>
                <p style={{ fontSize: '13px', color: THEME.subText, marginBottom: '20px' }}>홈 화면 중앙에 표시되는 배너 이미지를 변경합니다.</p>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '150px', backgroundColor: THEME.bg, borderRadius: '12px', cursor: 'pointer', marginBottom: '15px', overflow: 'hidden' }}>
                  {bannerFile ? ( <span style={{ fontSize: '14px', color: THEME.primary, fontWeight: 'bold' }}>{bannerFile.name} 선택됨</span> 
                  ) : mainBannerUrl ? ( <img src={mainBannerUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> 
                  ) : ( <><ImagePlus color={THEME.subText} size={30} /><span style={{ marginTop: '10px', fontSize: '13px', color: THEME.subText }}>사진 첨부 (선택)</span></> )}
                  <input type="file" accept="image/*" onChange={(e) => setBannerFile(e.target.files ? e.target.files[0] : null)} style={{ display: 'none' }} />
                </label>
                <button onClick={handleSaveMainBanner} disabled={isBannerUploading} style={{ width: '100%', padding: '14px', backgroundColor: THEME.primary, color: 'white', borderRadius: '10px', fontWeight: 'bold', border: 'none' }}>{isBannerUploading ? '업로드 중...' : '메인 배너 변경 적용하기'}</button>
              </div>

              <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                <h3 style={{ fontSize: '18px', marginBottom: '10px', fontWeight: 'bold', color: THEME.text }}>📢 고객 공지 팝업 관리</h3>
                <p style={{ fontSize: '13px', color: THEME.subText, marginBottom: '20px' }}>홈페이지 접속 시 바로 보이는 팝업창 내용입니다.</p>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '150px', backgroundColor: THEME.bg, borderRadius: '12px', cursor: 'pointer', marginBottom: '15px', overflow: 'hidden' }}>
                  {noticeFile ? ( <span style={{ fontSize: '14px', color: THEME.primary, fontWeight: 'bold' }}>{noticeFile.name} 선택됨</span> 
                  ) : (notice && notice.image_url) ? ( <img src={notice.image_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> 
                  ) : ( <><ImagePlus color={THEME.subText} size={30} /><span style={{ marginTop: '10px', fontSize: '13px', color: THEME.subText }}>팝업 사진 첨부 (선택)</span></> )}
                  <input type="file" accept="image/*" onChange={(e) => setNoticeFile(e.target.files ? e.target.files[0] : null)} style={{ display: 'none' }} />
                </label>
                <textarea placeholder="공지할 내용을 작성해주세요." rows={5} value={noticeInput} onChange={e => setNoticeInput(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${THEME.border}`, fontSize: '14px', resize: 'none', marginBottom: '15px' }} />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => handleSaveNotice(false)} disabled={isNoticeUploading} style={{ flex: 1, padding: '14px', backgroundColor: THEME.bg, color: THEME.text, borderRadius: '10px', fontWeight: 'bold', border: `1px solid ${THEME.border}` }}>팝업 숨기기(OFF)</button>
                  <button onClick={() => handleSaveNotice(true)} disabled={isNoticeUploading} style={{ flex: 1, padding: '14px', backgroundColor: THEME.primary, color: 'white', borderRadius: '10px', fontWeight: 'bold', border: 'none' }}>{isNoticeUploading ? '저장중...' : '팝업 띄우기(ON)'}</button>
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                <h3 style={{ fontSize: '18px', marginBottom: '20px', fontWeight: 'bold', color: THEME.text }}>브랜드 관리</h3>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                  <input placeholder="새 브랜드명" value={newBrand} onChange={e => setNewBrand(e.target.value)} style={{ flex: 1, minWidth: 0, padding: '12px', borderRadius: '10px', border: `1px solid ${THEME.border}` }} />
                  <button onClick={addBrand} style={{ flexShrink: 0, whiteSpace: 'nowrap', padding: '0 20px', backgroundColor: THEME.text, color: 'white', borderRadius: '10px', fontWeight: 'bold', border: 'none' }}>추가</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {(brands || []).map(b => (
                    <span key={b.id} style={{ padding: '8px 14px', backgroundColor: THEME.bg, border: `1px solid ${THEME.border}`, borderRadius: '20px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {b.name} <Trash2 size={16} color="#c62828" style={{ cursor: 'pointer' }} onClick={() => deleteBrand(b.id)} />
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                <h3 style={{ fontSize: '18px', marginBottom: '15px', fontWeight: 'bold', color: THEME.text }}>📂 카테고리 관리 (폴더형)</h3>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                  <input placeholder="새로운 대분류 생성" value={newMainCat} onChange={e => setNewMainCat(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${THEME.border}` }} />
                  <button onClick={() => addCategory(newMainCat, '')} style={{ padding: '0 15px', backgroundColor: THEME.text, color: 'white', borderRadius: '8px', fontWeight: 'bold', border: 'none' }}>생성</button>
                </div>

                {Object.keys(categoryTree).map(mainCat => {
                  const isExpanded = adminCatExpanded[mainCat];
                  return (
                    <div key={mainCat} style={{ border: `1px solid ${THEME.border}`, borderRadius: '10px', marginBottom: '10px', overflow: 'hidden' }}>
                      <div onClick={() => setAdminCatExpanded({...adminCatExpanded, [mainCat]: !isExpanded})} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', backgroundColor: isExpanded ? THEME.primaryLight : '#fff', cursor: 'pointer', fontWeight: 'bold', color: THEME.text }}>
                        <span>📁 {mainCat}</span>
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>

                      {isExpanded && (
                        <div style={{ padding: '15px', backgroundColor: '#fdfdfd' }}>
                          {categoryTree[mainCat].length > 0 ? (
                            categoryTree[mainCat].map(sub => {
                              const targetCat = categories.find(c => c.name === `${mainCat} > ${sub}`);
                              return (
                                <div key={sub} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed #eee', fontSize: '14px', color: THEME.subText }}>
                                  <span>- {sub}</span>
                                  <Trash2 size={16} color="#c62828" style={{ cursor: 'pointer' }} onClick={() => targetCat && deleteCategory(targetCat.id)} />
                                </div>
                              );
                            })
                          ) : ( <p style={{ fontSize: '13px', color: '#999', margin: '0 0 10px 0' }}>등록된 중분류가 없습니다.</p> )}

                          <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
                            <input placeholder={`'${mainCat}' 안에 중분류 추가`} value={newSubCats[mainCat] || ''} onChange={e => setNewSubCats({...newSubCats, [mainCat]: e.target.value})} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: `1px solid ${THEME.border}`, fontSize: '13px' }} />
                            <button onClick={() => addCategory(mainCat, newSubCats[mainCat])} style={{ padding: '0 12px', backgroundColor: THEME.primary, color: 'white', borderRadius: '6px', border: 'none', fontSize: '12px' }}>추가</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                <h3 style={{ fontSize: '18px', marginBottom: '15px', fontWeight: 'bold', color: THEME.text }}>⚙️ 쇼핑몰 기본 및 계좌 설정</h3>
                <input placeholder="영문 상호 (예: Hoo & Moi)" value={shopSettings.shop_name} onChange={e => setShopSettings({...shopSettings, shop_name: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${THEME.border}`, marginBottom: '10px' }} />
                <input placeholder="한글 상호 (예: 후앤모아)" value={shopSettings.shop_name_kr} onChange={e => setShopSettings({...shopSettings, shop_name_kr: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${THEME.border}`, marginBottom: '10px' }} />
                <input placeholder="관리자 비밀번호" value={shopSettings.admin_password} onChange={e => setShopSettings({...shopSettings, admin_password: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${THEME.border}`, marginBottom: '10px' }} />
                <input placeholder="카카오톡 오픈채팅 주소" value={shopSettings.kakao_url} onChange={e => setShopSettings({...shopSettings, kakao_url: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${THEME.border}`, marginBottom: '10px' }} />
                <input type="number" placeholder="기본 배송비 (예: 3500)" value={shopSettings.shipping_fee} onChange={e => setShopSettings({...shopSettings, shipping_fee: parseInt(e.target.value) || 0})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${THEME.border}`, marginBottom: '20px' }} />

                <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>무통장 입금 계좌</p>
                <input placeholder="은행명 (예: 농협)" value={editBankInfo.bank_name} onChange={e => setEditBankInfo({...editBankInfo, bank_name: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${THEME.border}`, marginBottom: '10px' }} />
                <input placeholder="계좌번호" value={editBankInfo.account_number} onChange={e => setEditBankInfo({...editBankInfo, account_number: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${THEME.border}`, marginBottom: '10px' }} />
                <input placeholder="예금주" value={editBankInfo.depositor_name} onChange={e => setEditBankInfo({...editBankInfo, depositor_name: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${THEME.border}`, marginBottom: '15px' }} />

                <button onClick={saveStoreSettings} style={{ width: '100%', padding: '14px', backgroundColor: THEME.text, color: 'white', borderRadius: '10px', fontWeight: 'bold', border: 'none' }}>전체 설정 저장하기</button>
              </div>
            </div>
          )}
        </div>
      )}

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
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', color: currentView === 'adminLogin' || currentView === 'admin' ? THEME.primary : '#DDDDDD', cursor: 'pointer' }} onClick={() => setCurrentView('adminLogin')}>
            <Lock size={24} /><span style={{ fontSize: '11px', marginTop: '6px', fontWeight: currentView === 'adminLogin' || currentView === 'admin' ? 'bold' : 'normal' }}>관리자</span>
          </div>
        </div>
      )}
    </div>
  );
}