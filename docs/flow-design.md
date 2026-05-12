# KUSecondHand 전체 플로우 설계서

작성일: 2026-05-11
업데이트: 2026-05-11 (레이아웃 단일화 완료, 상품 등록 설계 추가)
상태: 일부 구현 완료 / 일부 설계 확정

---

## 1. 유저 유형 정의

| 유형 | 조건 | 비고 |
|---|---|---|
| 일반 유저 | `users` 테이블에 존재 | 기본 |
| 교환학생 | `exchange_students` 테이블에 row 존재 | 온보딩 Step 2에서 선택 |

- 교환학생은 일반 기능(상품 목록, 검색)도 그대로 사용 가능
- 일반 유저도 `/packages` 등 교환학생 페이지 접근 가능 (단, 개인화 없이 기본 정렬)
- 두 유형은 상호 배타적이지 않음 — 교환학생도 일반 유저의 상위 집합

---

## 2. 인증 플로우

```
[회원가입]
/register
  → 학교 이메일 입력 (@korea.ac.kr)
  → OTP 이메일 발송
  → /verify
      → OTP 코드 + 비밀번호 + 닉네임 + 학번 입력
      → /api/auth/complete-profile
  → /onboarding          ← 신규 회원만, 1회
      → /products         ← 온보딩 완료 후

[로그인]
/login
  → 이메일 + 비밀번호
  → onboarding_completed 확인
      → false  → /onboarding
      → true   → /products (또는 next 파라미터 경로)
```

**onboarding_completed 필드**: `users` 테이블에 boolean 컬럼 추가 필요 (migration 007)

---

## 3. 온보딩 플로우 (`/onboarding`)

신규 가입 후 1회만 진행. 완료 시 `users.onboarding_completed = true` 저장.

```
Step 1 — 학과 선택
  ↓
Step 2 — 교환학생 여부
  ├─ 아니오 → 완료 → /products
  └─ 예
       ↓
Step 3 — 교환학생 정보 입력
  • 국가 (country_id)
  • 거주 형태 (housing_type: dorm / flat)
  • 학기 (semester: 2026-1 등)
  • 역할 (role: incoming / outgoing)
  • 선호 언어 (language_pref: ko / en)
       ↓
  완료 → exchange_students row 생성 → /products
```

**처리 API**: `POST /api/auth/onboarding` (신규)

---

## 4. 통합 레이아웃 (단일 top nav)

현재 `(main)` / `(exchange)` 두 레이아웃을 **하나의 레이아웃으로 통합**.
route group은 라우팅 정리 목적으로만 유지, layout은 `(main)/layout.tsx` 하나만 사용.

### 4-1. 네비게이션

```
[KU Secondhand]  [🔍 상품 검색...]  상품 · 패키지 · 채팅 · 위시리스트 · 상품 등록 · 마이페이지
```

| 항목 | 링크 | 비고 |
|---|---|---|
| 검색창 | `/search?q=` | 엔터 시 이동 |
| 상품 | `/products` | 전체 매물 목록 |
| 패키지 | `/packages` | 교환학생 패키지 |
| 채팅 | `/chat` | |
| 위시리스트 | `/wishlist` | |
| 상품 등록 | `/products/new` | 일반 매물 등록 |
| 마이페이지 | `/my/profile` | |

> 온보딩 구현 후: 패키지·채팅·위시리스트는 교환학생 profile 있을 때만 표시 예정

### 4-2. nav 구현 방식

- `useExchangeProfile()` hook으로 exchange profile 여부 판단
- profile 없으면 (null) → 일반 유저 메뉴
- profile 있으면 → 교환학생 메뉴 추가 표시
- SSR에서는 일반 메뉴 기본값, 클라이언트에서 hydration 후 전환 (깜빡임 최소화)

---

## 5. Route 구조

### 5-1. 현재 구조 (머지 완료 상태)

```
src/app/
├── (auth)/                   ← 로그인·회원가입·OTP
│   ├── login/
│   ├── register/
│   ├── verify/
│   ├── forgot-password/
│   ├── reset-password/
│   ├── find-id/
│   └── reactivate/
│
├── (main)/                   ← 일반 레이아웃 (top nav)
│   ├── layout.tsx            ← 현재 단독 layout
│   ├── products/
│   │   ├── page.tsx          ← 상품 목록
│   │   └── [pid]/page.tsx    ← 상품 상세
│   ├── products/recommendations/
│   ├── recommend/
│   │   ├── package/          ← 패키지 추천
│   │   └── resale-price/     ← 중고가 추천
│   ├── search/               ← 🔲 신규 예정 (검색)
│   └── my/
│       ├── profile/          ← 통합 마이페이지
│       └── account/
│
├── (exchange)/               ← 교환학생 전용 (layout 통합 예정)
│   ├── layout.tsx            ← ⚠️ 통합 후 제거 예정
│   ├── packages/
│   │   └── [id]/
│   ├── sell/
│   │   ├── template/
│   │   ├── register/
│   │   └── hygiene/
│   ├── wishlist/
│   ├── chat/
│   │   └── [id]/
│   └── mypage/               ← 현재 /my/profile로 redirect
│
└── (onboarding)/             ← 🔲 신규 예정
    └── onboarding/
        └── page.tsx
```

### 5-2. 목표 구조 (레이아웃 통합 후)

```
src/app/
├── (auth)/                   ← 변경 없음
│
├── (onboarding)/             ← 신규: 레이아웃 없음 (full-page)
│   └── onboarding/page.tsx
│
├── (main)/                   ← 통합 레이아웃 (모든 유저 공유)
│   ├── layout.tsx            ← 단일 top nav (교환학생 메뉴 조건부)
│   ├── products/
│   ├── packages/             ← (exchange)에서 이동
│   ├── sell/                 ← (exchange)에서 이동
│   ├── chat/                 ← (exchange)에서 이동
│   ├── wishlist/             ← (exchange)에서 이동
│   ├── recommend/
│   ├── search/               ← 신규
│   └── my/
│       ├── profile/
│       └── account/
│
└── (exchange)/               ← 빈 shell (redirect only) 또는 제거
```

---

## 6. /packages 기본 정렬 정책

| 상태 | 정렬 기준 | UI |
|---|---|---|
| 교환학생 (profile 있음) | 국가 + 거주형태 매칭 점수 → 조회수 | 맞춤 추천 뱃지 |
| 일반 유저 (profile 없음) | 조회수 순 | 상단 배너: "교환학생이신가요? 마이페이지에서 설정하면 맞춤 추천을 받을 수 있어요" |

---

## 7. 마이페이지 통합 구조

URL: `/my/profile` (단일)

```
┌─────────────────────────────────────────┐
│ 프로필 섹션                ← 모든 유저    │
│  사진 · 닉네임 · 한줄소개                 │
│  활동지역 (자동/수동) · 전공               │
│  계정 정보 (이메일·학번·매너온도·신뢰뱃지) │
├─────────────────────────────────────────┤
│ 교환학생 정보 섹션  ← exchange profile 有 │
│  국가 · 거주형태 · 학기 · 역할 · 선호언어  │
├─────────────────────────────────────────┤
│ [계정 관리 (탈퇴)]   [로그아웃]            │
└─────────────────────────────────────────┘
```

**구현 완료** (`src/app/(main)/my/profile/page.tsx`):
- `ProfileForm` — 일반 프로필 전체
- `ExchangeProfileSection` — exchange_students row 있을 때만 렌더
- `SignOutButton` — 로그아웃

---

## 8. 구현 순서 (우선순위 순)

| 순서 | 작업 | 파일 | 비고 |
|---|---|---|---|
| 1 | 레이아웃 통합 — `(exchange)/layout.tsx` 제거, `(main)/layout.tsx`에 조건부 nav | `(main)/layout.tsx`, `(exchange)/layout.tsx` | 교환학생 route를 (main)으로 이동 또는 (exchange) layout 제거 |
| 2 | 온보딩 페이지 구현 | `src/app/(onboarding)/onboarding/page.tsx` | Step 1~3 멀티스텝 |
| 3 | 온보딩 API | `src/app/api/auth/onboarding/route.ts` | exchange_students row 생성 + onboarding_completed 저장 |
| 4 | 로그인 후 onboarding_completed 체크 → redirect | `src/app/api/auth/...` 또는 middleware | |
| 5 | 검색 시스템 개발 | `docs/search-design.md` 참고 | migration 006 선행 |

> **스키마 확인 완료**: `users.onboarding_completed`, `countries` 23개, `exchange_students.onboarding_completed` 모두 schema.sql에 이미 존재 — 별도 migration 불필요.

---

## 9. 상품 등록 (`/products/new`)

### 구조

```
/products/new
  └── 탭: [일반 상품 등록] [패키지 등록]
            ↓                   ↓
        ProductForm       /sell/template로 이동
```

### 일반 상품 등록 폼 필드

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| 제목 (title) | text | ✅ | 최대 200자 |
| 가격 (price) | number | ✅ | 0 이상 정수 |
| 상태 (condition) | select | ✅ | new / like_new / good / fair / poor |
| 카테고리 (category_id) | select | ✅ | categories 테이블에서 로드 |
| 설명 (description) | textarea | — | 선택 |
| 이미지 | file(s) | — | Supabase Storage → product_images 테이블 |

### API

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST /api/products` | 상품 등록 | products row 생성 → product_images rows 생성 |

### 이미지 처리 흐름

```
파일 선택 → Supabase Storage (products/{uid}/{pid}/{filename}) 업로드
  → product_images INSERT (pid, image_url, display_order)
  → /products/{pid} 로 이동
```

### condition 한글 레이블

| 값 | 표시 |
|---|---|
| new | 새 상품 |
| like_new | 거의 새것 |
| good | 상태 양호 |
| fair | 보통 |
| poor | 하자 있음 |

---

## 10. 위시리스트 통합

### 구조

```
/wishlist
  ├── [상품 탭]  wishlists 테이블 (uid + pid) — 일반 매물
  └── [패키지 탭] exchange_wishlists 테이블 (uid + category_id) — 교환학생 알림 신청
```

### 상품 위시리스트 API

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET /api/wishlists` | 내 위시리스트 목록 | |
| `POST /api/wishlists` | 찜 추가 | body: `{ pid }` |
| `DELETE /api/wishlists/[pid]` | 찜 삭제 | |

### 상품 상세 페이지

- 하트 버튼 추가 — 로그인 유저만 사용 가능
- 찜 여부는 `/api/wishlists` GET으로 확인

---

## 11. 미결 / 추후 결정

| # | 항목 |
|---|---|
| F1 | (exchange) route group을 (main)으로 실제 이동할지, layout만 통합할지 |
| F2 | middleware.ts로 onboarding_completed 체크 (proxy.ts 활성화 논의와 연계 — D1) |
| F3 | 교환학생 전용 페이지에 비교환학생 접근 시 UX (현재: 그냥 볼 수 있음 + 개인화 없음) |
| F4 | 온보딩 스킵 허용 여부 |
