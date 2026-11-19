import React, { useEffect, useMemo, useState } from 'react';
import { SHOP } from './shop';

// 🎄 크리스마스 꾸미기: 위쪽 띠지 + 은은한 눈 + 가끔 산타·루돌프 썰매 (색은 shop.ts 의 xmas 값)
// 기간: 2027-01-01 00:00(한국시간)에 자동으로 꺼짐. 관리자 설정에서 미리 끌 수도 있음.
export const XMAS_END_MS = new Date('2027-01-01T00:00:00+09:00').getTime();
export const isXmasSeason = () => Date.now() < XMAS_END_MS;

const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

// 썰매 그림(왼쪽으로 달리는 모습): 루돌프 2마리 + 산타 + 선물
const Sleigh = ({ gift1, gift2 }: { gift1: string; gift2: string }) => (
  <svg viewBox="0 0 380 120" width="100%" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
    {/* 반짝이 꼬리 */}
    <g fill="#fff" opacity="0.9">
      <circle cx="372" cy="62" r="2.2" /><circle cx="360" cy="48" r="1.6" /><circle cx="366" cy="78" r="1.8" /><circle cx="350" cy="68" r="1.2" />
    </g>
    {/* 끌줄 */}
    <path d="M118 60 C150 52 170 54 196 66" stroke="#b08a3e" strokeWidth="2" fill="none" />
    <path d="M60 58 C80 50 100 52 124 58" stroke="#b08a3e" strokeWidth="2" fill="none" />
    {/* 루돌프 2마리 */}
    {[0, 62].map((dx, i) => (
      <g key={i} transform={`translate(${104 + dx} 0) scale(-1 1)`}>
        <path d="M22 70 q-6 -8 -2 -16" stroke="#7a4b2e" strokeWidth="3" fill="none" strokeLinecap="round" />
        <ellipse cx="44" cy="62" rx="22" ry="12" fill="#9a6338" />
        <ellipse cx="44" cy="66" rx="14" ry="6" fill="#c89466" opacity="0.7" />
        <path d="M30 70 l-2 16 M40 72 l-1 16 M52 72 l1 16 M62 70 l2 16" stroke="#7a4b2e" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M62 54 l10 -12" stroke="#9a6338" strokeWidth="7" strokeLinecap="round" />
        <circle cx="74" cy="40" r="9" fill="#9a6338" />
        <circle cx="79" cy="38" r="1.6" fill="#2b1b12" />
        <circle cx="83" cy="44" r="3.6" fill="#e53935" />
        <path d="M70 32 q-2 -10 -8 -13 M70 32 q0 -8 -2 -12 M72 31 q6 -9 12 -9 M73 31 q2 -7 8 -11" stroke="#6b4226" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="64" cy="64" r="3" fill="#e53935" opacity="0" />
      </g>
    ))}
    {/* 썰매 */}
    <path d="M178 62 h88 q10 0 8 12 q-4 18 -22 18 h-62 q-14 0 -12 -14 z" fill="#c62828" />
    <path d="M178 62 h88 q10 0 8 12" stroke="#e0b04a" strokeWidth="3" fill="none" />
    <path d="M168 100 h108 q16 0 18 -14" stroke="#e0b04a" strokeWidth="4" fill="none" strokeLinecap="round" />
    <path d="M168 100 q-8 0 -8 -10" stroke="#e0b04a" strokeWidth="4" fill="none" strokeLinecap="round" />
    <path d="M196 92 v8 M246 92 v8" stroke="#e0b04a" strokeWidth="3" />
    {/* 선물 */}
    <rect x="236" y="30" width="30" height="30" rx="3" fill={gift1} />
    <path d="M251 30 v30 M236 45 h30" stroke="#fff" strokeWidth="3" />
    <path d="M251 30 q-8 -9 -12 -3 q4 6 12 3 q8 -9 12 -3 q-4 6 -12 3" fill="#fff" />
    <rect x="270" y="42" width="24" height="22" rx="3" fill={gift2} />
    <path d="M282 42 v22 M270 53 h24" stroke="#fff" strokeWidth="2.5" />
    <rect x="296" y="50" width="20" height="14" rx="3" fill="#2f6b4f" />
    <path d="M306 50 v14" stroke="#fff" strokeWidth="2" />
    {/* 산타 */}
    <rect x="198" y="40" width="30" height="26" rx="9" fill="#e53935" />
    <rect x="198" y="56" width="30" height="4" fill="#3a2a22" />
    <circle cx="213" cy="34" r="10" fill="#ffd9bf" />
    <path d="M203 38 q10 14 20 0 q-2 12 -10 14 q-8 -2 -10 -14z" fill="#fff" />
    <path d="M203 30 q10 -18 22 -4 q-4 -2 -10 -2 q-6 0 -12 6z" fill="#e53935" />
    <rect x="202" y="28" width="22" height="5" rx="2.5" fill="#fff" />
    <circle cx="229" cy="20" r="4" fill="#fff" />
    <circle cx="209" cy="33" r="1.3" fill="#2b1b12" /><circle cx="217" cy="33" r="1.3" fill="#2b1b12" />
    <path d="M198 54 q-16 -2 -24 -10" stroke="#e53935" strokeWidth="6" strokeLinecap="round" fill="none" />
    <circle cx="172" cy="43" r="4" fill="#fff" />
  </svg>
);

export const XmasDecor = () => {
  const { a, b } = SHOP.xmas;
  const reduced = useMemo(prefersReducedMotion, []);
  const narrow = typeof window !== 'undefined' && window.innerWidth < 600;
  // 눈송이: 은은하게(폰 22개, 넓은 화면 34개). 만든 뒤 다시 계산하지 않음
  const flakes = useMemo(() => Array.from({ length: narrow ? 22 : 34 }, () => ({
    left: Math.random() * 100,
    size: 3 + Math.random() * 4,
    dur: 11 + Math.random() * 11,
    delay: -Math.random() * 20,
    dx: (Math.random() - 0.5) * 70,
    op: 0.55 + Math.random() * 0.4,
  })), [narrow]);

  // 썰매: 처음 6초 뒤 한 번, 그 뒤 30~55초마다 오른쪽 → 왼쪽으로 지나감
  const [run, setRun] = useState<{ id: number; top: number } | null>(null);
  useEffect(() => {
    if (reduced) return;
    let timer: number;
    let id = 0;
    const schedule = (ms: number) => {
      timer = window.setTimeout(() => {
        if (!document.hidden) { id += 1; setRun({ id, top: 12 + Math.random() * 22 }); }
        schedule(30000 + Math.random() * 25000);
      }, ms);
    };
    schedule(6000);
    return () => window.clearTimeout(timer);
  }, [reduced]);

  const stripe = `repeating-linear-gradient(135deg, ${a} 0 10px, #ffffff 10px 20px, ${b} 20px 30px, #ffffff 30px 40px)`;
  return (
    <>
      <style>{`
        @keyframes xm-fall { 0% { transform: translate3d(0,-6vh,0); } 100% { transform: translate3d(var(--dx),108vh,0); } }
        @keyframes xm-fly { 0% { transform: translate3d(105vw,0,0); } 100% { transform: translate3d(-420px,0,0); } }
        @keyframes xm-bob { 0%,100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-7px) rotate(1deg); } }
        .xm-flake { position: absolute; top: 0; border-radius: 50%; background: radial-gradient(circle, #fff 50%, rgba(205,222,245,0.95) 100%); box-shadow: 0 0 3px rgba(150,180,225,0.85); animation: xm-fall linear infinite; will-change: transform; }
        .xm-sleigh { position: absolute; left: 0; width: 250px; animation: xm-fly 12s linear 1 forwards; will-change: transform; }
        .xm-sleigh > div { animation: xm-bob 1.1s ease-in-out infinite; }
        @media (min-width: 600px) { .xm-sleigh { width: 320px; } }
      `}</style>
      {/* 위쪽 띠지 */}
      <div aria-hidden="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '6px', zIndex: 120, pointerEvents: 'none', background: stripe, boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }} />
      {!reduced && (
        <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 90, pointerEvents: 'none', overflow: 'hidden' }}>
          {flakes.map((f, i) => (
            <span key={i} className="xm-flake" style={{ left: `${f.left}%`, width: f.size, height: f.size, opacity: f.op, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s`, ['--dx' as any]: `${f.dx}px` }} />
          ))}
          {run && (
            <div key={run.id} className="xm-sleigh" style={{ top: `${run.top}vh` }} onAnimationEnd={() => setRun(null)}>
              <div><Sleigh gift1={a} gift2="#e0b04a" /></div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

// 🎄 홈 배너: 쇼핑몰 분위기에 맞게 다르게 (shop.ts 의 xmas.variant)
const TreeArt = () => (
  <svg viewBox="0 0 100 100" width="100%" aria-hidden="true" style={{ display: 'block' }}>
    <polygon points="50,6 54,17 66,18 57,26 60,38 50,31 40,38 43,26 34,18 46,17" fill="#f3c34f" transform="translate(0 -2) scale(1)" opacity="0" />
    <path d="M50 8 l4 8 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1z" fill="#f3c34f" />
    <polygon points="50,20 68,48 32,48" fill="#2f6b4f" />
    <polygon points="50,34 74,66 26,66" fill="#3a8160" />
    <polygon points="50,50 80,84 20,84" fill="#2f6b4f" />
    <rect x="45" y="84" width="10" height="8" rx="1.5" fill="#7a4b2e" />
    <circle cx="48" cy="40" r="3.2" fill="#F06A7D" /><circle cx="58" cy="58" r="3.4" fill="#fff" /><circle cx="42" cy="62" r="3.2" fill="#F06A7D" />
    <circle cx="50" cy="72" r="3.4" fill="#f3c34f" /><circle cx="35" cy="78" r="3" fill="#fff" /><circle cx="65" cy="77" r="3" fill="#F06A7D" />
    <rect x="6" y="76" width="18" height="16" rx="2.5" fill="#F06A7D" /><path d="M15 76 v16 M6 84 h18" stroke="#fff" strokeWidth="2.2" />
    <rect x="76" y="80" width="16" height="12" rx="2.5" fill="#fff" stroke="#f3c6cd" /><path d="M84 80 v12 M76 86 h16" stroke="#F06A7D" strokeWidth="2.2" />
    <g fill="#fff"><circle cx="16" cy="22" r="2" /><circle cx="86" cy="30" r="2.4" /><circle cx="90" cy="58" r="1.8" /><circle cx="10" cy="50" r="1.8" /></g>
  </svg>
);

const WreathArt = () => {
  const leaves = Array.from({ length: 16 }, (_, i) => {
    const ang = (i / 16) * Math.PI * 2;
    const x = 50 + 32 * Math.cos(ang), y = 50 + 32 * Math.sin(ang);
    return <ellipse key={i} cx={x} cy={y} rx="11" ry="5.2" transform={`rotate(${(ang * 180) / Math.PI + 90} ${x} ${y})`} fill={i % 2 ? '#5C7A62' : '#7b9a7f'} />;
  });
  return (
    <svg viewBox="0 0 100 100" width="100%" aria-hidden="true" style={{ display: 'block' }}>
      {leaves}
      {[12, 40, 70, 100, 130, 160, 200, 250, 300, 335].map((deg, i) => (
        <circle key={i} cx={50 + 32 * Math.cos((deg * Math.PI) / 180)} cy={50 + 32 * Math.sin((deg * Math.PI) / 180)} r="3" fill="#b5483f" />
      ))}
      <path d="M50 86 l-13 10 4 -14z M50 86 l13 10 -4 -14z" fill="#D29C8B" />
      <circle cx="50" cy="85" r="4.5" fill="#c4806e" />
      <g fill="#fff" opacity="0.9"><circle cx="50" cy="50" r="1.6" /><circle cx="42" cy="46" r="1.2" /><circle cx="58" cy="54" r="1.2" /></g>
    </svg>
  );
};

export const XmasBanner = ({ onClick }: { onClick: () => void }) => {
  const x = SHOP.xmas;
  const isHoo = x.variant === 'hoo';
  return (
    <button onClick={onClick} aria-label={x.title} style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', border: `${isHoo ? 2 : 1.5}px ${isHoo ? 'dashed' : 'solid'} ${x.border}`, borderRadius: '22px', padding: '14px 16px', textAlign: 'left', cursor: 'pointer', backgroundColor: x.bg, marginBottom: '20px', boxShadow: '0 4px 14px rgba(0,0,0,0.05)' }}>
      <div style={{ width: '84px', flexShrink: 0 }}>{isHoo ? <TreeArt /> : <WreathArt />}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 3px', fontSize: '11px', fontWeight: 'bold', letterSpacing: isHoo ? '0.5px' : '2px', color: x.b }}>{x.tag}</p>
        <p className="serif-text" style={{ margin: '0 0 3px', fontSize: '18px', fontWeight: 700, color: SHOP.theme.brown, lineHeight: 1.3 }}>{x.title}</p>
        <p style={{ margin: '0 0 10px', fontSize: '12.5px', color: SHOP.theme.subText }}>{x.sub}</p>
        <span style={{ display: 'inline-block', backgroundColor: isHoo ? x.a : x.b, color: '#fff', fontSize: '12px', fontWeight: 'bold', padding: '6px 14px', borderRadius: isHoo ? '14px' : '4px' }}>{x.cta} ›</span>
      </div>
    </button>
  );
};
