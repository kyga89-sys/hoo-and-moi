// 🏪 가게별 설정 — 후앤모아·모아루니는 App.tsx 가 똑같고 이 파일만 다릅니다.
//    (상호·대표자·사업자 정보·계좌·채팅 주소는 관리자 > 설정에서 바꾸고, 여기는 처음 기본값과 색상만)
export const SHOP = {
  nameEn: 'Hoo & Moi',
  nameKr: '후앤모아',
  orderPrefix: 'HM', // 주문번호 앞글자 (supabase create_order 와 같아야 함)
  siteUrl: 'https://hoo-and-moi.web.app',
  kakaoUrl: 'https://open.kakao.com/o/sy8ZbjNi', // 1:1 채팅 (설정에서 변경)
  communityUrl: 'https://open.kakao.com/o/g48GLFNi', // 📢 신상 소식방 (설정에서 변경)
  // 📱 아이폰 기린 수집기 단축어 iCloud 링크 (있으면 관리자 수집함에 [단축어 추가하기] 버튼)
  iosShortcutUrl: '',
  shippingFee: 3500,
  introMain: '매일매일 입고 싶은 옷,\n고민 없이 후앤모아 🎈',
  introSub: '편안함에 감성을 더한\n우리 아이 맞춤 옷장🎀',
  theme: {
    primary: '#F06A7D',
    primaryLight: '#FFF0F2',
    bg: '#FAF8F5',
    text: '#333333',
    subText: '#888888',
    border: '#EEEEEE',
    brown: '#6B5B53'
  }
};
