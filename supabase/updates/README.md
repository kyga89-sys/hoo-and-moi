# 후앤모아 기능 업데이트 적용 순서

## 1차 업데이트 (feature/batch1-ui)

바뀌는 것
- 주문완료: "주문서 전송하기" 버튼 → 주문정보 복사 + 안내창 → [1:1 채팅방 열기]
- 주문완료 하단 "1:1 채팅" → "📢 신상 소식방" (단체 오픈채팅)
- 상품 썸네일: 사이즈 + 색상 표시, 상단 ⊞ 아이콘으로 2열/4열 전환 (4열은 사진+가격)
- 페이지 번호 1~10 표시, ‹ › 1페이지 / « » 10페이지 이동 (관리자 상품 목록도 동일)
- 뒤로가기: 휴대폰 뒤로가기·상단 < 버튼이 직전 화면으로, 홈은 보던 위치 그대로
- 맨 아래 사업자 정보 + 결제정보(설정의 무통장 입금 계좌) + 카카오톡 문의 버튼
- 관리자 로그인: 실패 원인 안내, 비밀번호 👁 보기 버튼
- 관리자 설정: 신상 소식방 주소, 사업자 정보 입력칸 추가

### 1. SQL 먼저 실행 (데이터 변경 없음, 칸만 추가)
Supabase → SQL Editor → `01_batch1_settings.sql` 전체 붙여넣기 → Run
→ 맨 아래 표에 사업자 정보가 나오면 성공

### 2. Replit Shell
```bash
git fetch origin
git switch feature/batch1-ui
PORT=19275 BASE_PATH=/ pnpm --filter @workspace/hoo-and-moi run build
npx firebase-tools hosting:channel:deploy batch1-test --project hoo-and-moi --expires 7d
```

### 3. 테스트 주소에서 확인
- [ ] 상품 썸네일에 📏 사이즈 / 🎨 색상
- [ ] 상단 ⊞ 눌러 4열 ↔ 2열, 새로고침해도 고른 배열 유지
- [ ] 페이지 번호, ‹ › « » 이동
- [ ] 3페이지에서 상품 보고 뒤로가기 → 3페이지 같은 위치
- [ ] 맨 아래 사업자 정보·결제정보·카카오톡 문의
- [ ] 테스트 주문 → 주문서 전송하기 → 안내창 → 1:1 채팅방 열기 → 붙여넣기 내용 확인
- [ ] 신상 소식방 버튼이 단체 오픈채팅으로 열림
- [ ] 관리자 로그인 (👁 버튼), 설정 탭의 새 입력칸
- [ ] 테스트 주문 삭제

### 4. 실제 배포
```bash
npx firebase-tools deploy --only hosting --project hoo-and-moi
```
