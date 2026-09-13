import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ShoppingBag, Home, CheckCircle, ShieldCheck, ImagePlus, Trash2, Search, ChevronLeft, FileText, LayoutGrid, Lock, Plus, Minus, ChevronDown, ChevronUp, Edit, Share, List, X, Download, Link as LinkIcon, TrendingUp } from 'lucide-react';

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

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  const [showCartModal, setShowCartModal] = useState(false);

  const [activeBrand, setActiveBrand] = useState('전체');
  const [activeLargeCat, setActiveLargeCat] = useState('전체');
  const [activeSmallCat, setActiveSmallCat] = useState('전체');

  const [notice, setNotice] = useState<any>(null);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeInput, setNoticeInput] = useState('');
  const [noticeFile, setNoticeFile] = useState<File | null>(null);
  const [isNoticeUploading, setIsNoticeUploading] = useState(false);

  const [mainBannerUrl, setMainBannerUrl] = useState('');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [isBannerUploading, setIsBannerUploading] = useState(false);

  const [orderName, setOrderName] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [orderAddress, setOrderAddress] = useState('');
  const [orderMemo, setOrderMemo] = useState('');
  const [currentOrder, setCurrentOrder] = useState<any>(null);

  const [lookupName, setLookupName] = useState('');
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupOrderNumber, setLookupOrderNumber] = useState(''); 
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [editingCustomerOrderId, setEditingCustomerOrderId] = useState<string | null>(null);
  const [editOrderInputs, setEditOrderInputs] = useState({ name: '', phone: '', address: '', memo: '' });

  const [adminPassword, setAdminPassword] = useState('');
  const [adminTab, setAdminTab] = useState('orders'); 
  const [adminOrders, setAdminOrders] = useState<any[]>([]);
  const [adminFilter, setAdminFilter] = useState('전체'); 
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [adminMemoInputs, setAdminMemoInputs] = useState<Record<string, string>>({});

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
  const [isUploading, setIsUploading] = useState(false);

  // ✨ 이미지 링크 직접 붙여넣기 상태 추가 ✨
  const [inputMainImageUrl, setInputMainImageUrl] = useState('');
  const [inputSubImageUrls, setInputSubImageUrls] = useState('');

  const [catLarge, setCatLarge] = useState('');
  const [catMedium, setCatMedium] = useState('');
  const [newBrand, setNewBrand] = useState('');

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchBrands();
    fetchNoticesAndBanner();

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert("아이폰(Safari)은 하단의 [공유] 버튼(↑)을 누르고 [홈 화면에 추가]를 선택해주세요!\n\n이미 설치되어 있거나 현재 브라우저에서 지원하지 않을 수 있습니다.");
    }
  };

  const fetchNoticesAndBanner = async () => {
    const { data } = await supabase.from('notices').select('*').in('id', [1, 2]);
    if (data) {
      const popup = data.find((d:any) => d.id === 1);
      const banner = data.find((d:any) => d.id === 2);
      if (popup) {
        setNotice(popup); setNoticeInput(popup.content || '');
        if (popup.is_active) setShowNoticeModal(true); 
      }
      if (banner && banner.image_url) setMainBannerUrl(banner.image_url);
    }
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (data) setProducts(data);
  };
  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('id', { ascending: true });
    if (data) setCategories(data);
  };
  const fetchBrands = async () => {
    const { data } = await supabase.from('brands').select('*').order('id', { ascending: true });
    if (data) setBrands(data);
  };

  const getStatusStyle = (status: string) => {
    if (status === '입금대기') return { bg: '#f1f1f1', text: '#666' };
    if (status === '결제완료') return { bg: '#e3f2fd', text: '#1976d2' };
    if (status === '배송지연') return { bg: '#fff3e0', text: '#e65100' };
    if (status === '발송완료') return { bg: '#e8f5e9', text: '#2e7d32' };
    if (status === '주문취소' || status === '환불처리') return { bg: '#ffebee', text: '#c62828' };
    return { bg: THEME.primary, text: 'white' };
  };

  const isNewProduct = (dateString: string) => {
    if (!dateString) return false;
    return (new Date().getTime() - new Date(dateString).getTime()) <= 14 * 24 * 60 * 60 * 1000;
  };

  const openProductDetail = (p: any) => {
    setSelectedProduct(p); setSelectedSize(''); setSelectedColor(''); setQuantity(1); setCurrentView('detail');
  };

  const addToCart = () => {
    if (selectedProduct.sizes && !selectedSize) return alert("사이즈를 선택해주세요!");
    if (selectedProduct.colors && !selectedColor) return alert("색상을 선택해주세요!");
    setCart([...cart, { ...selectedProduct, selectedSize, selectedColor, quantity, cartId: Date.now(), cost_price: selectedProduct.cost_price || 0 }]);
    setShowCartModal(true); 
  };
  const removeFromCart = (cartId: number) => { setCart(cart.filter(item => item.cartId !== cartId)); };

  const totalShippingFee = cart.length > 0 ? 3500 : 0;
  const totalItemAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalOrderAmount = totalItemAmount + totalShippingFee;

  const goToQuotationPreview = () => {
    if (!orderName || !orderPhone || !orderAddress) return alert("정보를 모두 입력해주세요!");
    setCurrentView('quotationPreview');
  };

  const submitOrder = async () => {
    const orderNumber = `HM-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random() * 1000)}`;
    const { data: newOrder, error } = await supabase.from('orders').insert([{
      order_number: orderNumber, customer_name: orderName, phone: orderPhone, address: orderAddress, memo: orderMemo, total_amount: totalOrderAmount, status: '입금대기'
    }]).select();

    if (error) return alert("오류가 발생했습니다.");
    if (newOrder && newOrder[0]) {
      const orderItems = cart.map(item => {
        const optionText = [item.selectedColor, item.selectedSize].filter(Boolean).join(' / ');
        return { 
          order_id: newOrder[0].id, 
          product_name: `${item.name} ${optionText ? `(${optionText})` : ''}`, 
          price: item.price, 
          quantity: item.quantity,
          cost_price: item.cost_price
        };
      });
      await supabase.from('order_items').insert(orderItems);
      setCurrentOrder(newOrder[0]);
      setCart([]); 
      setCurrentView('orderComplete'); 
    }
  };

  const handleSaveQuotation = async () => {
    alert("❗입금 완료 후 [주문번호, 주문자 정보, 전화번호]를 1:1 채팅으로 보내주셔야 최종 주문이 완료됩니다.");
    const text = `[후앤모아 입금확인 요청]\n주문번호: ${currentOrder.order_number}\n주문자: ${currentOrder.customer_name}\n연락처: ${currentOrder.phone}\n입금액: ${currentOrder.total_amount.toLocaleString()}원`;
    try {
      await navigator.clipboard.writeText(text);
      alert("요청 메시지가 복사되었습니다! 1:1 채팅창에 붙여넣어주세요.");
    } catch (e) { alert("복사에 실패했습니다. 직접 메모해주세요."); }
  };

  const searchMyOrder = async () => {
    if(!lookupOrderNumber && (!lookupName || !lookupPhone)) return alert("주문번호를 입력하시거나, 이름+연락처를 입력해주세요.");
    try {
      let query = supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false });
      if (lookupOrderNumber) query = query.eq('order_number', lookupOrderNumber);
      else query = query.eq('customer_name', lookupName).eq('phone', lookupPhone);
      const { data, error } = await query;
      if (error) throw error;
      if (data && data.length > 0) setMyOrders(data); 
      else alert("주문 내역을 찾을 수 없습니다.");
    } catch (err) { alert("조회 중 오류가 발생했습니다."); }
  };

  const openCustomerEdit = (order: any) => {
    setEditingCustomerOrderId(order.id);
    setEditOrderInputs({ name: order.customer_name, phone: order.phone, address: order.address, memo: order.memo || '' });
  };
  const saveCustomerEdit = async (id: string) => {
    await supabase.from('orders').update({ customer_name: editOrderInputs.name, phone: editOrderInputs.phone, address: editOrderInputs.address, memo: editOrderInputs.memo }).eq('id', id);
    alert("배송지 정보가 수정되었습니다."); setEditingCustomerOrderId(null); searchMyOrder();
  };

  const fetchAdminOrders = async () => {
    const { data } = await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false });
    if (data) setAdminOrders(data);
  };
  const handleAdminLogin = async () => {
    if (adminPassword === 'dhrnfl64') { await fetchAdminOrders(); setCurrentView('admin'); } else alert("비밀번호 오류");
  };
  const updateOrderStatus = async (id: string, status: string) => {
    if (window.confirm(`상태를 [${status}](으)로 변경하시겠습니까?`)) { await supabase.from('orders').update({ status }).eq('id', id); fetchAdminOrders(); }
  };
  const saveOrderInfo = async (id: string, currentTracking: string, currentMemo: string) => {
    const tracking = trackingInputs[id] !== undefined ? trackingInputs[id] : currentTracking;
    const memo = adminMemoInputs[id] !== undefined ? adminMemoInputs[id] : currentMemo;
    await supabase.from('orders').update({ tracking_number: tracking, admin_memo: memo }).eq('id', id);
    alert("저장되었습니다."); setEditingOrderId(null); fetchAdminOrders();
  };
  const deleteOrder = async (id: string) => {
    if (window.confirm("❗주문을 영구히 삭제하시겠습니까?")) { await supabase.from('orders').delete().eq('id', id); fetchAdminOrders(); }
  };

  const handleSaveProduct = async () => {
    if (!prodName || !prodPrice) return alert("상품명, 판매 가격은 필수입니다!");
    
    // 대표 이미지 URL 또는 파일 중 하나는 필수로 있어야 함
    if (!editingProductId && (!prodFiles || prodFiles.length === 0) && !inputMainImageUrl) {
      return alert("새 상품 등록 시 대표 사진(파일 첨부 또는 URL)은 필수입니다!");
    }

    setIsUploading(true);
    try {
      let main_image = inputMainImageUrl || undefined; 
      let sub_images = inputSubImageUrls || undefined;

      // 파일 업로드가 있다면 파일을 최우선으로 적용
      if (prodFiles && prodFiles.length > 0) {
        const imageUrls = [];
        for (let i = 0; i < prodFiles.length; i++) {
          const file = prodFiles[i];
          const fileName = `${Date.now()}_${i}.${file.name.split('.').pop()}`;
          await supabase.storage.from('products').upload(fileName, file);
          const { data } = supabase.storage.from('products').getPublicUrl(fileName);
          imageUrls.push(data.publicUrl);
        }
        main_image = imageUrls[0]; 
        // 여러 장 올렸을 경우, 첫 장은 메인, 나머지는 서브 이미지에 합침
        if (imageUrls.length > 1) {
          const uploadedSubs = imageUrls.slice(1).join(',');
          sub_images = sub_images ? `${sub_images},${uploadedSubs}` : uploadedSubs;
        }
      }

      const productData: any = { 
        name: prodName, 
        price: parseInt(prodPrice), 
        cost_price: parseInt(prodCostPrice) || 0,
        category: prodCategory, 
        brand: prodBrand, 
        description: prodDesc, 
        sizes: prodSizes, 
        colors: prodColors 
      };

      if (main_image) productData.main_image = main_image; 
      if (sub_images) productData.sub_images = sub_images; 
      
      if (editingProductId) {
        const { error } = await supabase.from('products').update(productData).eq('id', editingProductId);
        if(error) throw error; alert("✅ 상품 수정 완료!");
      } else {
        const { error } = await supabase.from('products').insert([productData]);
        if(error) throw error; alert("🎉 새 상품 등록 완료!");
      }
      resetProductForm(); await fetchProducts(); setAdminTab('productEdit');
    } catch (err: any) { alert("오류 발생: " + err.message); } 
    finally { setIsUploading(false); }
  };

  const resetProductForm = () => {
    setEditingProductId(null); setProdName(''); setProdPrice(''); setProdCostPrice(''); setProdDesc(''); setProdSizes(''); setProdColors(''); setProdCategory(''); setProdBrand(''); setProdFiles(null); setInputMainImageUrl(''); setInputSubImageUrls('');
  };
  const openEditProduct = (p: any) => {
    setEditingProductId(p.id); setProdName(p.name); setProdPrice(p.price.toString()); setProdCostPrice(p.cost_price ? p.cost_price.toString() : ''); setProdDesc(p.description || ''); setProdSizes(p.sizes || ''); setProdColors(p.colors || ''); setProdCategory(p.category || ''); setProdBrand(p.brand || ''); setInputMainImageUrl(p.main_image || ''); setInputSubImageUrls(p.sub_images || ''); setAdminTab('productAdd');
  };
  const deleteProduct = async (id: string) => {
    if (window.confirm("❗이 상품을 완전히 삭제하시겠습니까?")) { await supabase.from('products').delete().eq('id', id); fetchProducts(); }
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
      const { error } = await supabase.from('notices').upsert([{ id: 1, content: noticeInput, image_url: imageUrl, is_active: status }]);
      if (error) throw error;
      alert(`공지사항이 ${status ? '팝업 활성화' : '팝업 숨김'} 처리되었습니다.`); fetchNoticesAndBanner();
    } catch (error: any) { alert("공지 저장 실패: " + error.message); }
    finally { setIsNoticeUploading(false); }
  };

  const handleSaveMainBanner = async () => {
    if (!bannerFile) return alert("배너 이미지를 첨부해주세요.");
    setIsBannerUploading(true);
    try {
      const fileName = `banner_${Date.now()}.${bannerFile.name.split('.').pop()}`;
      await supabase.storage.from('products').upload(fileName, bannerFile);
      const { data } = supabase.storage.from('products').getPublicUrl(fileName);
      const { error } = await supabase.from('notices').upsert([{ id: 2, image_url: data.publicUrl, is_active: true }]);
      if (error) throw error;
      alert("메인 배너가 성공적으로 적용되었습니다!"); setBannerFile(null); fetchNoticesAndBanner();
    } catch (error: any) { alert("배너 저장 실패: " + error.message); }
    finally { setIsBannerUploading(false); }
  };

  const addCategory = async () => { 
    const fullName = [catLarge, catMedium].filter(Boolean).join(' > ');
    if(!fullName) return alert("대분류를 하나 이상 입력해주세요.");
    await supabase.from('categories').insert([{ name: fullName }]); 
    setCatLarge(''); setCatMedium(''); fetchCategories(); 
  };
  const deleteCategory = async (id: number) => { if (window.confirm("삭제하시겠습니까?")) { await supabase.from('categories').delete().eq('id', id); fetchCategories(); } };
  const addBrand = async () => { if(newBrand) { await supabase.from('brands').insert([{ name: newBrand }]); setNewBrand(''); fetchBrands(); } };
  const deleteBrand = async (id: number) => { if (window.confirm("삭제하시겠습니까?")) { await supabase.from('brands').delete().eq('id', id); fetchBrands(); } };

  const calculateStats = () => {
    const validOrders = adminOrders.filter(o => ['결제완료', '배송지연', '발송완료'].includes(o.status));
    let totalOrderAmount = 0; 
    let totalProductSales = 0; 
    let totalCost = 0;  

    validOrders.forEach(order => {
      totalOrderAmount += order.total_amount;
      if(order.order_items) {
        order.order_items.forEach((item: any) => {
          totalProductSales += item.price * item.quantity;
          totalCost += (item.cost_price || 0) * item.quantity;
        });
      }
    });

    const netProfit = totalProductSales - totalCost; 
    return { totalOrderAmount, totalProductSales, totalCost, netProfit, orderCount: validOrders.length };
  };
  const stats = calculateStats();

  const getCombinedCategories = () => {
    const tree: Record<string, string[]> = JSON.parse(JSON.stringify(BASE_CATEGORIES));
    (categories || []).forEach(c => {
      const parts = c.name.split('>');
      const main = parts[0].trim();
      if (!tree[main]) tree[main] = [];
      if (parts.length > 1) {
        const sub = parts.slice(1).map((p:string) => p.trim()).join(' > ');
        if (!tree[main].includes(sub)) tree[main].push(sub);
      }
    });
    return tree;
  };
  const categoryTree = getCombinedCategories();

  const displayProducts = products.filter(p => {
    const matchBrand = activeBrand === '전체' || p.brand === activeBrand;
    let matchCategory = true;
    if (activeLargeCat !== '전체') {
      if (activeSmallCat !== '전체') {
        matchCategory = p.category === `${activeLargeCat} > ${activeSmallCat}`;
      } else {
        matchCategory = p.category && p.category.startsWith(activeLargeCat);
      }
    }
    const normalize = (str: string) => (str || '').replace(/\s+/g, '').toLowerCase();
    const normalizedQuery = normalize(searchQuery);
    const matchSearch = !normalizedQuery || normalize(p.name).includes(normalizedQuery) || normalize(p.brand).includes(normalizedQuery);
    return matchBrand && matchCategory && matchSearch;
  });

  const filteredAdminOrders = adminOrders.filter(o => adminFilter === '전체' ? true : adminFilter === '취소/환불' ? (o.status === '주문취소' || o.status === '환불처리') : o.status === adminFilter);

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

      {showNoticeModal && notice && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(2px)' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '20px', width: '85%', maxWidth: '400px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            {notice.image_url && <img src={notice.image_url} style={{ width: '100%', maxHeight: '250px', objectFit: 'cover' }} />}
            <div style={{ padding: '25px 20px', textAlign: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: THEME.brown, marginBottom: '15px' }}>📢 후앤모아 공지사항</h3>
              <p style={{ fontSize: '14px', color: THEME.text, lineHeight: '1.6', whiteSpace: 'pre-line', marginBottom: '25px', textAlign: 'left' }}>{notice.content}</p>
              <button onClick={() => setShowNoticeModal(false)} style={{ width: '100%', padding: '14px', backgroundColor: THEME.primary, color: 'white', borderRadius: '30px', fontWeight: 'bold', fontSize: '15px', border: 'none' }}>확인했습니다</button>
            </div>
          </div>
        </div>
      )}

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', backgroundColor: '#fff', position: 'sticky', top: 0, zIndex: 100, borderBottom: `1px solid ${THEME.border}` }}>
        <div style={{ width: '80px', display: 'flex', alignItems: 'center' }}>
           {currentView !== 'home' ? (
             <ChevronLeft size={28} onClick={() => setCurrentView('home')} style={{ cursor: 'pointer', color: THEME.text }}/>
           ) : (
             <div onClick={handleInstallClick} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', backgroundColor: THEME.primaryLight, padding: '6px 10px', borderRadius: '15px' }}>
               <Download size={14} color={THEME.primary} />
               <span style={{fontSize: '12px', color: THEME.primary, fontWeight: 'bold', whiteSpace: 'nowrap'}}>앱 다운</span>
             </div>
           )}
        </div>
        
        <h1 className="serif-text" style={{ color: THEME.brown, fontSize: '26px', fontWeight: '700', margin: 0, textAlign: 'center', cursor: 'pointer', flex: 1 }} onClick={() => setCurrentView('home')}>Hoo & Moi</h1>
        
        <div style={{ position: 'relative', cursor: 'pointer', width: '80px', display: 'flex', justifyContent: 'flex-end' }} onClick={() => setCurrentView('cart')}>
          <div style={{ position: 'relative' }}>
            <ShoppingBag size={24} color={THEME.text} />
            {cart.length > 0 && <span style={{ position: 'absolute', top: '-5px', right: '-5px', backgroundColor: THEME.primary, color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '11px', fontWeight: 'bold' }}>{cart.length}</span>}
          </div>
        </div>
      </header>

      {currentView === 'home' && (
        <div>
          <div style={{ padding: '30px 20px 0 20px', textAlign: 'center' }}>
            <p className="serif-text" style={{ color: THEME.brown, fontSize: '17px', marginBottom: '20px', lineHeight: '1.5' }}>매일매일 입고 싶은 옷,<br/>고민 없이 후앤모아 🎈</p>
            <p className="serif-text" style={{ color: THEME.brown, fontSize: '14px', marginBottom: '30px' }}>편안함에 감성을 더한<br/>우리 아이 맞춤 옷장🎀</p>
          </div>

          <div style={{ padding: '0 20px 20px 20px' }}>
            <div style={{ width: '100%', borderRadius: '20px', overflow: 'hidden', marginBottom: '20px', backgroundColor: '#fff', boxShadow: '0 4px 15px rgba(0,0,0,0.04)' }}>
               {mainBannerUrl ? (
                 <img src={mainBannerUrl} alt="후앤모아 배너" style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
               ) : (
                 <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#f9f9f9', color: THEME.subText, fontSize: '13px' }}>관리자 탭에서 메인 배너를 등록해주세요.</div>
               )}
            </div>

            <div style={{ position: 'relative', margin: '0 0 20px 0' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '10px' }}>
              {displayProducts.map((p) => (
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
          </div>
        </div>
      )}

      {currentView === 'category' && (
        <div style={{ padding: '20px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '20px', fontWeight: 'bold' }}>전체 카테고리</h2>

          <div style={{ backgroundColor: '#fff', borderRadius: '15px', padding: '10px', marginBottom: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: '15px', color: THEME.primary, padding: '10px', borderBottom: `1px solid ${THEME.border}`, fontWeight: 'bold' }}>브랜드관</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', padding: '10px 5px' }}>
              <div onClick={() => { setActiveBrand('전체'); setCurrentView('home'); }} style={{ width: '50%', padding: '12px 10px', fontSize: '15px', cursor: 'pointer', fontWeight: activeBrand === '전체' ? 'bold' : 'normal', color: activeBrand === '전체' ? THEME.primary : THEME.text }}>전체 브랜드</div>
              {brands.map(b => (
                <div key={b.id} onClick={() => { setActiveBrand(b.name); setCurrentView('home'); }} style={{ width: '50%', padding: '12px 10px', fontSize: '15px', cursor: 'pointer', fontWeight: activeBrand === b.name ? 'bold' : 'normal', color: activeBrand === b.name ? THEME.primary : THEME.text }}>{b.name}</div>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: '#fff', borderRadius: '15px', padding: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: '15px', color: THEME.primary, padding: '10px', borderBottom: `1px solid ${THEME.border}`, fontWeight: 'bold' }}>아이템별</h3>
            <div onClick={() => { setActiveLargeCat('전체'); setActiveSmallCat('전체'); setCurrentView('home'); }} style={{ padding: '15px 10px', borderBottom: `1px solid ${THEME.border}`, fontSize: '15px', cursor: 'pointer', fontWeight: 'bold' }}>모든 상품 보기</div>
            {Object.keys(categoryTree).map(mainCat => (
              <div key={mainCat}>
                <div onClick={() => setExpandedCats({...expandedCats, [mainCat]: !expandedCats[mainCat]})} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 10px', borderBottom: `1px solid ${THEME.border}`, fontSize: '15px', cursor: 'pointer' }}>
                  <span style={{ fontWeight: '500' }}>{mainCat}</span>
                  {expandedCats[mainCat] ? <ChevronUp size={20} color={THEME.subText} /> : <ChevronDown size={20} color={THEME.subText} />}
                </div>
                {expandedCats[mainCat] && (
                  <div style={{ padding: '10px 10px 10px 20px', backgroundColor: '#FCFCFC' }}>
                    <div onClick={() => { setActiveLargeCat(mainCat); setActiveSmallCat('전체'); setCurrentView('home'); }} style={{ padding: '10px 0', fontSize: '14px', color: THEME.subText, cursor: 'pointer' }}>{mainCat} 전체</div>
                    {categoryTree[mainCat].map((sub: string) => (
                      <div key={sub} onClick={() => { setActiveLargeCat(mainCat); setActiveSmallCat(sub); setCurrentView('home'); }} style={{ padding: '10px 0', fontSize: '14px', color: THEME.subText, cursor: 'pointer' }}>- {sub}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ✨ 상세페이지 화면 업데이트 ✨ */}
      {currentView === 'detail' && selectedProduct && (
        <div style={{ paddingBottom: '100px', backgroundColor: '#fff' }}>
          
          {/* 1. 최상단: 대표 썸네일 이미지 딱 1장만 노출 */}
          <div style={{ width: '100%', height: '120vw', overflow: 'hidden' }}>
            <img src={selectedProduct.main_image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>

          <div style={{ padding: '24px 20px' }}>
            {isNewProduct(selectedProduct.created_at) && <span style={{ display: 'inline-block', backgroundColor: THEME.primary, color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', marginBottom: '10px' }}>✨ NEW</span>}
            <h2 style={{ fontSize: '22px', margin: '0 0 12px 0', fontWeight: 'bold', lineHeight: '1.4' }}>{selectedProduct.name}</h2>
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
          
          {/* ✨ 2. 하단: [상세 이미지 URL]로 넣은 사진들이 쇼핑몰 상세설명란에 쫙 깔리도록 렌더링 ✨ */}
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
                  <button onClick={() => { setShowCartModal(false); setCurrentView('home'); }} style={{ width: '100%', padding: '16px', backgroundColor: '#fff', color: THEME.text, border: `1px solid ${THEME.border}`, borderRadius: '30px', fontWeight: 'bold', fontSize: '15px' }}>계속 쇼핑하기</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {currentView === 'cart' && (
        <div style={{ padding: '20px', backgroundColor: '#fff', minHeight: '100vh' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>장바구니</h2>
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
                📢 <strong>기본 배송비 3,500원</strong><br/> <span style={{color: THEME.text}}>* 여러 브랜드 주문 시 합배송 등의 이유로 배송비가 추가될 수 있습니다.</span>
              </div>

              <div style={{ marginTop: '30px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: '15px', color: THEME.text }}><span>총 {cart.length}개 상품</span><span style={{fontSize:'18px', fontWeight:'bold', color: THEME.primary}}>총 {totalItemAmount.toLocaleString()}원</span></div>
              </div>

              <button onClick={() => setCurrentView('orderForm')} style={{ width: '100%', padding: '16px', backgroundColor: THEME.primary, color: 'white', border: 'none', borderRadius: '30px', fontSize: '16px', fontWeight: 'bold', marginTop: '20px', boxShadow: '0 4px 15px rgba(240,106,125,0.2)' }}>주문하기</button>
            </div>
          )}
        </div>
      )}

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
                <input placeholder="주소를 검색해주세요" value={orderAddress} onChange={e => setOrderAddress(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${THEME.border}`, fontSize: '15px', marginBottom: '10px' }} />
             </div>
             <div>
                <label style={{ fontSize: '14px', fontWeight: 'bold', color: THEME.text, display: 'block', marginBottom: '8px' }}>요청사항</label>
                <textarea placeholder="예) 빠른 배송 부탁드려요 :)" rows={3} value={orderMemo} onChange={e => setOrderMemo(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${THEME.border}`, fontSize: '15px', resize: 'none' }} />
             </div>
          </div>

          <button onClick={goToQuotationPreview} style={{ width: '100%', padding: '16px', backgroundColor: THEME.primary, color: 'white', border: 'none', borderRadius: '30px', fontSize: '16px', fontWeight: 'bold', marginTop: '30px' }}>견적서 확인하기</button>
        </div>
      )}

      {currentView === 'quotationPreview' && (
        <div style={{ padding: '20px', backgroundColor: '#fff', minHeight: '100vh' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', textAlign: 'center', marginBottom: '30px' }}>주문 견적서</h2>

          <div style={{ border: `1px solid ${THEME.border}`, borderRadius: '16px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '20px', color: THEME.primary, textAlign: 'center', margin: '0 0 20px 0', fontWeight: '800' }}>후앤모아 주문 견적서</h3>
            <div style={{ fontSize: '14px', color: THEME.text, lineHeight: '2' }}>
              <div style={{display:'flex'}}><span style={{width:'80px', color:THEME.subText}}>주문일</span> <span>{new Date().toLocaleString()}</span></div>
              <div style={{display:'flex'}}><span style={{width:'80px', color:THEME.subText}}>주문자</span> <span>{orderName}</span></div>
              <div style={{display:'flex'}}><span style={{width:'80px', color:THEME.subText}}>연락처</span> <span>{orderPhone}</span></div>
              <div style={{display:'flex'}}><span style={{width:'80px', color:THEME.subText}}>배송지</span> <span>{orderAddress}</span></div>
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

      {currentView === 'orderComplete' && currentOrder && (
        <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#fff', minHeight: '100vh' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <CheckCircle size={60} color={THEME.primary} />
          </div>
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
            <p style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 5px 0', color: THEME.text }}>국민은행 453202-04-062095</p>
            <p style={{ fontSize: '14px', margin: 0, color: THEME.subText }}>예금주: 권용훈</p>
          </div>

          <button onClick={handleSaveQuotation} style={{ width: '100%', padding: '16px', backgroundColor: THEME.primary, color: 'white', border: 'none', borderRadius: '30px', fontSize: '16px', fontWeight: 'bold', marginBottom: '30px' }}>
            주문 견적서 복사하기
          </button>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '30px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => window.open('https://open.kakao.com/o/sy8ZbjNi', '_blank')}>
              <div style={{ backgroundColor: '#333', padding: '15px', borderRadius: '50%' }}><Share size={20} color="#fff" /></div>
              <span style={{ fontSize: '13px', color: THEME.text }}>1:1 채팅</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setCurrentView('lookup')}>
              <div style={{ backgroundColor: '#fff', border:`1px solid ${THEME.border}`, padding: '15px', borderRadius: '50%' }}><FileText size={20} color={THEME.text} /></div>
              <span style={{ fontSize: '13px', color: THEME.text }}>주문내역 보기</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setCurrentView('home')}>
              <div style={{ backgroundColor: '#fff', border:`1px solid ${THEME.border}`, padding: '15px', borderRadius: '50%' }}><Home size={20} color={THEME.text} /></div>
              <span style={{ fontSize: '13px', color: THEME.text }}>홈으로 가기</span>
            </div>
          </div>
        </div>
      )}

      {currentView === 'lookup' && (
        <div style={{ padding: '20px', backgroundColor: '#fff', minHeight: '100vh' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '20px', fontWeight: 'bold' }}>주문 내역 조회</h2>
          <div style={{ border: `1px solid ${THEME.border}`, padding: '25px 20px', borderRadius: '16px' }}>
            <p style={{ fontSize: '14px', color: THEME.subText, marginBottom: '20px', textAlign: 'center' }}>주문번호 또는 이름/연락처로<br/>조회 가능합니다.</p>
            <input placeholder="주문번호 (선택사항)" value={lookupOrderNumber} onChange={e => setLookupOrderNumber(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${THEME.primary}`, marginBottom: '15px', fontSize: '14px' }} />
            <div style={{ display: 'flex', alignItems: 'center', margin: '15px 0', color: THEME.border, fontSize: '13px' }}>
              <hr style={{ flex: 1, border: 'none', borderTop: `1px solid ${THEME.border}` }} /> <span style={{ padding: '0 15px', color: THEME.subText }}>또는</span> <hr style={{ flex: 1, border: 'none', borderTop: `1px solid ${THEME.border}` }} />
            </div>
            <input placeholder="주문자 이름" value={lookupName} onChange={e => setLookupName(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${THEME.border}`, marginBottom: '10px', fontSize: '14px' }} />
            <input placeholder="연락처 (010-0000-0000)" value={lookupPhone} onChange={e => setLookupPhone(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${THEME.border}`, marginBottom: '20px', fontSize: '14px' }} />
            <button onClick={searchMyOrder} style={{ width: '100%', padding: '16px', backgroundColor: THEME.primary, color: 'white', border: 'none', borderRadius: '30px', fontWeight: 'bold', fontSize: '16px' }}>조회하기</button>
          </div>

          {myOrders.length > 0 && (
            <div style={{ marginTop: '30px' }}>
              {myOrders.map((order, idx) => {
                const isEditingInfo = editingCustomerOrderId === order.id;

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

                    <div style={{ borderTop: `1px dashed ${THEME.border}`, paddingTop: '20px', marginBottom: '20px' }}>
                      <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: THEME.text }}>주문 상품</p>
                      {order.order_items && order.order_items.map((item:any, i:number) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#555', marginBottom: '8px' }}>
                          <span>{item.product_name} <span style={{color:THEME.subText}}>({item.quantity}개)</span></span>
                          <span style={{ fontWeight: 'bold', color: THEME.text }}>{(item.price * item.quantity).toLocaleString()}원</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${THEME.border}`, paddingTop: '20px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 'bold' }}>최종 결제 금액</span>
                      <span style={{ fontSize: '20px', fontWeight: 'bold', color: THEME.primary }}>{order.total_amount.toLocaleString()}원</span>
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

      {currentView === 'adminLogin' && (
        <div style={{ padding: '50px 20px', textAlign: 'center', backgroundColor: '#fff', minHeight: '100vh' }}>
          <Lock size={50} color={THEME.primary} style={{ margin: '0 auto 20px auto' }} />
          <h3 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '30px' }}>관리자 접속</h3>
          <input type="password" placeholder="관리자 전용 페이지 입니다." value={adminPassword} onChange={e => setAdminPassword(e.target.value)} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: `1px solid ${THEME.border}`, marginBottom: '20px', fontSize: '15px', textAlign: 'center' }} />
          <button onClick={handleAdminLogin} style={{ width: '100%', padding: '16px', backgroundColor: THEME.primary, color: 'white', border: 'none', borderRadius: '30px', fontWeight: 'bold', fontSize: '16px' }}>접속하기</button>
        </div>
      )}

      {currentView === 'admin' && (
        <div style={{ padding: '20px', paddingBottom: '100px' }}>
          <div style={{ display: 'flex', borderBottom: `2px solid ${THEME.border}`, marginBottom: '20px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            <div onClick={() => setAdminTab('orders')} style={{ whiteSpace: 'nowrap', padding: '12px 15px', fontWeight: 'bold', borderBottom: adminTab === 'orders' ? `3px solid ${THEME.primary}` : 'none', color: adminTab === 'orders' ? THEME.primary : THEME.subText, cursor: 'pointer' }}>주문 관리</div>
            <div onClick={() => { setAdminTab('productAdd'); resetProductForm(); }} style={{ whiteSpace: 'nowrap', padding: '12px 15px', fontWeight: 'bold', borderBottom: adminTab === 'productAdd' ? `3px solid ${THEME.primary}` : 'none', color: adminTab === 'productAdd' ? THEME.primary : THEME.subText, cursor: 'pointer' }}>상품 등록</div>
            <div onClick={() => setAdminTab('productEdit')} style={{ whiteSpace: 'nowrap', padding: '12px 15px', fontWeight: 'bold', borderBottom: adminTab === 'productEdit' ? `3px solid ${THEME.primary}` : 'none', color: adminTab === 'productEdit' ? THEME.primary : THEME.subText, cursor: 'pointer' }}>상품 수정</div>
            <div onClick={() => setAdminTab('settings')} style={{ whiteSpace: 'nowrap', padding: '12px 15px', fontWeight: 'bold', borderBottom: adminTab === 'settings' ? `3px solid ${THEME.primary}` : 'none', color: adminTab === 'settings' ? THEME.primary : THEME.subText, cursor: 'pointer' }}>설정</div>
            <div onClick={() => setAdminTab('dashboard')} style={{ whiteSpace: 'nowrap', padding: '12px 15px', fontWeight: 'bold', borderBottom: adminTab === 'dashboard' ? `3px solid ${THEME.primary}` : 'none', color: adminTab === 'dashboard' ? THEME.primary : THEME.subText, cursor: 'pointer' }}>매출/수익</div>
          </div>

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

                    <div style={{ borderLeft: `3px solid ${THEME.border}`, paddingLeft: '15px', marginBottom: '20px' }}>
                      {order.order_items && order.order_items.map((item:any, i:number) => (
                        <p key={i} style={{ fontSize: '14px', margin: '0 0 6px 0', color: THEME.text }}>
                          {item.product_name} <span style={{fontWeight:'bold'}}>({item.quantity}개)</span>
                        </p>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ fontSize: '18px', margin: 0 }}><strong>{order.total_amount.toLocaleString()}원</strong></p>
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

          {/* ✨ 스마트폰 전용: 이미지 링크 등록 기능 (UI 대폭 간소화) ✨ */}
          {adminTab === 'productAdd' && (
            <div style={{ backgroundColor: '#fff', paddingBottom: '30px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
              
              <div style={{ padding: '20px', backgroundColor: THEME.primaryLight, borderBottom: `1px dashed ${THEME.primary}` }}>
                <p style={{ fontSize: '14px', fontWeight: 'bold', color: THEME.primary, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <LinkIcon size={16} /> 도매 상품 이미지 링크 붙여넣기
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: THEME.subText, fontWeight: 'bold' }}>1. 대표 이미지(썸네일) URL (선택)</span>
                    <input 
                      placeholder="도매 사이트에서 이미지 주소 복사 후 붙여넣기" 
                      value={inputMainImageUrl} 
                      onChange={e => setInputMainImageUrl(e.target.value)} 
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', fontSize: '13px', marginTop: '5px' }} 
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: THEME.subText, fontWeight: 'bold' }}>2. 상세설명 이미지 URL (길게 나오는 사진들)</span>
                    <textarea 
                      placeholder="상세 사진 링크를 붙여넣으세요. (여러 장일 경우 쉼표(,) 또는 엔터로 구분)" 
                      value={inputSubImageUrls} 
                      onChange={e => setInputSubImageUrls(e.target.value)} 
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', fontSize: '13px', resize: 'none', height: '80px', marginTop: '5px' }} 
                    />
                  </div>
                </div>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '200px', backgroundColor: THEME.bg, cursor: 'pointer' }}>
                <ImagePlus color={THEME.subText} size={40} />
                <span style={{ marginTop: '15px', fontSize: '14px', color: THEME.subText, fontWeight: 'bold' }}>앨범에서 사진 직접 첨부 (선택)</span>
                {prodFiles && <span style={{ marginTop: '10px', fontSize: '13px', color: THEME.primary, fontWeight: 'bold' }}>{prodFiles.length}장 선택됨</span>}
                <input type="file" accept="image/*" multiple onChange={(e) => setProdFiles(e.target.files)} style={{ display: 'none' }} />
              </label>
              
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
                <input placeholder="상품명을 직접 입력하세요" value={prodName} onChange={e => setProdName(e.target.value)} style={{ width: '100%', fontSize: '24px', fontWeight: 'bold', border: 'none', borderBottom: `1px solid ${THEME.border}`, paddingBottom: '15px', marginBottom: '20px', outline: 'none' }} />
                
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
                <input placeholder="색상 (예: 핑크, 네이비)" value={prodColors} onChange={e => setProdColors(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${THEME.border}`, marginBottom: '15px', fontSize: '14px' }} />
                <input placeholder="사이즈 (예: S, M, L)" value={prodSizes} onChange={e => setProdSizes(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${THEME.border}`, marginBottom: '25px', fontSize: '14px' }} />
                <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: THEME.text }}>상세 설명글 (선택)</p>
                <textarea placeholder="설명을 적어주세요." rows={6} value={prodDesc} onChange={e => setProdDesc(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: `1px solid ${THEME.border}`, fontSize: '15px', resize: 'none', lineHeight: '1.6' }} />
              </div>
              <div style={{ padding: '0 20px', display: 'flex', gap: '10px' }}>
                {editingProductId && <button onClick={resetProductForm} style={{ flex: 1, padding: '16px', backgroundColor: THEME.bg, color: THEME.text, borderRadius: '30px', fontWeight: 'bold', fontSize: '15px', border: 'none' }}>취소</button>}
                <button onClick={handleSaveProduct} disabled={isUploading} style={{ flex: 2, padding: '16px', backgroundColor: isUploading ? '#ccc' : THEME.primary, color: 'white', borderRadius: '30px', fontWeight: 'bold', fontSize: '16px', border: 'none', boxShadow: '0 4px 15px rgba(240,106,125,0.2)' }}>{isUploading ? '업로드 중...' : (editingProductId ? '수정 내용 저장' : '이 상품 등록하기')}</button>
              </div>
            </div>
          )}

          {adminTab === 'productEdit' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
              {products.map(p => (
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
          )}

          {adminTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                <h3 style={{ fontSize: '18px', marginBottom: '10px', fontWeight: 'bold', color: THEME.text }}>🖼️ 메인 배너 이미지 관리</h3>
                <p style={{ fontSize: '13px', color: THEME.subText, marginBottom: '20px' }}>홈 화면 중앙에 표시되는 배너 이미지를 변경합니다.</p>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '150px', backgroundColor: THEME.bg, borderRadius: '12px', cursor: 'pointer', marginBottom: '15px', overflow: 'hidden' }}>
                  {bannerFile ? ( 
                    <span style={{ fontSize: '14px', color: THEME.primary, fontWeight: 'bold' }}>{bannerFile.name} 선택됨</span> 
                  ) : mainBannerUrl ? ( 
                    <img src={mainBannerUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> 
                  ) : ( 
                    <><ImagePlus color={THEME.subText} size={30} /><span style={{ marginTop: '10px', fontSize: '13px', color: THEME.subText }}>사진 첨부 (선택)</span></> 
                  )}
                  <input type="file" accept="image/*" onChange={(e) => setBannerFile(e.target.files ? e.target.files[0] : null)} style={{ display: 'none' }} />
                </label>
                <button onClick={handleSaveMainBanner} disabled={isBannerUploading} style={{ width: '100%', padding: '14px', backgroundColor: THEME.primary, color: 'white', borderRadius: '10px', fontWeight: 'bold', border: 'none' }}>{isBannerUploading ? '업로드 중...' : '메인 배너 변경 적용하기'}</button>
              </div>

              <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                <h3 style={{ fontSize: '18px', marginBottom: '10px', fontWeight: 'bold', color: THEME.text }}>📢 고객 공지 팝업 관리</h3>
                <p style={{ fontSize: '13px', color: THEME.subText, marginBottom: '20px' }}>홈페이지 접속 시 바로 보이는 팝업창 내용입니다.</p>
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '150px', backgroundColor: THEME.bg, borderRadius: '12px', cursor: 'pointer', marginBottom: '15px', overflow: 'hidden' }}>
                  {noticeFile ? ( 
                    <span style={{ fontSize: '14px', color: THEME.primary, fontWeight: 'bold' }}>{noticeFile.name} 선택됨</span> 
                  ) : (notice && notice.image_url) ? ( 
                    <img src={notice.image_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> 
                  ) : ( 
                    <><ImagePlus color={THEME.subText} size={30} /><span style={{ marginTop: '10px', fontSize: '13px', color: THEME.subText }}>팝업 사진 첨부 (선택)</span></> 
                  )}
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
                  <button onClick={addBrand} style={{ flexShrink: 0, whiteSpace: 'nowrap', padding: '0 20px', backgroundColor: THEME.text, color: 'white', borderRadius: '10px', fontWeight: 'bold' }}>추가</button>
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
                <h3 style={{ fontSize: '18px', marginBottom: '20px', fontWeight: 'bold', color: THEME.text }}>분류(대/중) 관리</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexDirection: 'row' }}>
                    <input placeholder="대분류 (예: 아우터)" value={catLarge} onChange={e => setCatLarge(e.target.value)} style={{ flex: 1, minWidth: 0, padding: '12px', borderRadius: '10px', border: `1px solid ${THEME.border}`, fontSize: '14px' }} />
                    <input placeholder="중분류 (예: 코트)" value={catMedium} onChange={e => setCatMedium(e.target.value)} style={{ flex: 1, minWidth: 0, padding: '12px', borderRadius: '10px', border: `1px solid ${THEME.border}`, fontSize: '14px' }} />
                  </div>
                  <button onClick={addCategory} style={{ padding: '12px', backgroundColor: THEME.text, color: 'white', borderRadius: '10px', fontWeight: 'bold' }}>카테고리 추가</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {(categories || []).map(c => (
                    <span key={c.id} style={{ padding: '8px 14px', backgroundColor: THEME.bg, border: `1px solid ${THEME.border}`, borderRadius: '20px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {c.name} <Trash2 size={16} color="#c62828" style={{ cursor: 'pointer' }} onClick={() => deleteCategory(c.id)} />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {currentView !== 'detail' && currentView !== 'quotationPreview' && currentView !== 'orderComplete' && (
        <div style={{ position: 'fixed', bottom: 0, width: '100%', backgroundColor: '#fff', display: 'flex', borderTop: `1px solid ${THEME.border}`, paddingTop: '10px', paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 15px)', zIndex: 100 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', color: currentView === 'home' ? THEME.primary : THEME.subText, cursor: 'pointer' }} onClick={() => setCurrentView('home')}>
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
