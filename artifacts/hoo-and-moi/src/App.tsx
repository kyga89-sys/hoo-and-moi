import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ShoppingBag } from 'lucide-react';

// 1. 수파베이스 창고와 연결
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const [products, setProducts] = useState<any[]>([]);

  // 2. 창고에서 옷 꺼내오기
  useEffect(() => {
    async function fetchProducts() {
      const { data } = await supabase.from('products').select('*');
      if (data) setProducts(data);
    }
    fetchProducts();
  }, []);

  // 3. 후앤모아 쇼핑몰 화면
  return (
    <div style={{ backgroundColor: '#FAF8F5', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#E5989B', fontSize: '26px', fontWeight: 'bold', margin: 0 }}>Hoo & Moi</h1>
        <ShoppingBag color="#4A4A4A" size={28} />
      </header>

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ color: '#4A4A4A', fontSize: '22px', margin: '0 0 8px 0' }}>우리아이를 위한 예쁜 옷 🎈</h2>
        <p style={{ color: '#888', margin: 0, fontSize: '15px' }}>마음에 드는 상품을 골라 간편하게 주문해보세요.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        {products.map((product) => (
          <div key={product.id} style={{ backgroundColor: '#fff', borderRadius: '15px', padding: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.03)' }}>
            <img src={product.main_image} alt={product.name} style={{ width: '100%', borderRadius: '10px', objectFit: 'cover', aspectRatio: '4/5' }} />
            <h3 style={{ fontSize: '15px', color: '#4A4A4A', marginTop: '12px', marginBottom: '6px' }}>{product.name}</h3>
            <p style={{ fontSize: '17px', fontWeight: 'bold', color: '#E5989B', margin: 0 }}>
              {product.price.toLocaleString()}원
            </p>
          </div>
        ))}
      </div>

    </div>
  );
}