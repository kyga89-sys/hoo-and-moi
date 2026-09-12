import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ShoppingBag } from 'lucide-react';

type Product = {
  id: string | number;
  name: string;
  price: number | string | null;
  main_image?: string | null;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function formatPrice(price: Product['price']) {
  const numericPrice = typeof price === 'number' ? price : Number(price);
  return Number.isFinite(numericPrice)
    ? `${numericPrice.toLocaleString('ko-KR')}원`
    : '가격 준비 중';
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const client = supabase;

    if (!client) {
      setErrorMessage('상품 연결 설정을 확인해주세요.');
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    async function fetchProducts() {
      if (!client) return;

      const { data, error } = await client
        .from('products')
        .select('id, name, price, main_image')
        .order('id');

      if (isCancelled) return;

      if (error) {
        setErrorMessage('상품을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
        setProducts([]);
      } else {
        setProducts((data ?? []) as Product[]);
        setErrorMessage(null);
      }
      setIsLoading(false);
    }

    void fetchProducts();

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <div style={{ backgroundColor: '#FAF8F5', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#E5989B', fontSize: '26px', fontWeight: 'bold', margin: 0 }}>Hoo & Moi</h1>
        <ShoppingBag color="#4A4A4A" size={28} />
      </header>

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ color: '#4A4A4A', fontSize: '22px', margin: '0 0 8px 0' }}>우리아이를 위한 예쁜 옷</h2>
        <p style={{ color: '#888', margin: 0, fontSize: '15px' }}>마음에 드는 상품을 골라 간편하게 주문해보세요.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        {isLoading && (
          <p style={{ color: '#888', gridColumn: '1 / -1' }}>
            상품을 불러오는 중입니다.
          </p>
        )}

        {!isLoading && errorMessage && (
          <p role="alert" style={{ color: '#9B5C60', gridColumn: '1 / -1' }}>
            {errorMessage}
          </p>
        )}

        {!isLoading && !errorMessage && products.length === 0 && (
          <p style={{ color: '#888', gridColumn: '1 / -1' }}>
            아직 등록된 상품이 없습니다.
          </p>
        )}

        {!isLoading &&
          !errorMessage &&
          products.map((product) => {
            const imageUrl = product.main_image?.trim();

            return (
              <article key={product.id} style={{ backgroundColor: '#fff', borderRadius: '15px', padding: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.03)' }}>
                <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '10px', aspectRatio: '4/5', backgroundColor: '#F1E9E4' }}>
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt={product.name}
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                        const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;
                        if (fallback) fallback.hidden = false;
                      }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
                  <div
                    hidden={Boolean(imageUrl)}
                    style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#9B8580', fontSize: '14px' }}
                  >
                    이미지 준비 중
                  </div>
                </div>
                <h3 style={{ fontSize: '15px', color: '#4A4A4A', marginTop: '12px', marginBottom: '6px' }}>{product.name}</h3>
                <p style={{ fontSize: '17px', fontWeight: 'bold', color: '#E5989B', margin: 0 }}>
                  {formatPrice(product.price)}
                </p>
              </article>
            );
          })}
      </div>

    </div>
  );
}