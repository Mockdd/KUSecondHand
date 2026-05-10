# KU Secondhand — 프론트엔드 개발 계획

> 작성일: 2026-05-10  
> 참조: `doc/platformPlanningDoc.md`, `db/tableSpec.md`, `db/platformDataDoc.md`

---

## 1. 확정된 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | Next.js 15 (App Router, Turbopack) | `src/app/` 기반 |
| 언어 | TypeScript 5 (strict mode) | |
| 스타일 | Tailwind CSS v4 | PostCSS 플러그인 방식 |
| 서버 상태 | TanStack Query v5 | API 캐싱·재검증 |
| 클라이언트 상태 | Zustand v5 | 인증 세션, UI 전역 상태 |
| DB / Auth | Supabase (PostgreSQL) | `@supabase/ssr` + `@supabase/supabase-js` |
| API 레이어 | Next.js Route Handlers (`src/app/api/`) | 별도 백엔드 없음 |
| i18n | next-i18next + react-i18next | 다국어 선택적 적용 |

> **MySQL → PostgreSQL 변환 주의사항**  
> `tableSpec.md`는 MySQL 기준. Supabase 마이그레이션 시:
> - `TINYINT(1)` → `BOOLEAN`
> - `AUTO_INCREMENT` → `BIGSERIAL` / `uuid_generate_v4()`
> - `DATETIME` → `TIMESTAMPTZ`
> - `ENUM` → PostgreSQL `ENUM TYPE` 또는 `TEXT CHECK()`
> - `ON UPDATE CURRENT_TIMESTAMP` → 트리거로 구현

---

## 2. 구현 범위 (이미지 1 기준)

| # | 기능 | 이미지 1 행 | 우선순위 |
|---|------|------------|---------|
| 1 | 학교 이메일 기반 회원가입 및 인증 | 1행 | P0 |
| 2 | 프로필 설정 | 2행 | P1 |
| 3 | 상품 등록 및 관리 | 4행 | P1 |
| 4 | 거래이력 기반 평점 및 신뢰도 시스템 | 3행 | P2 |
| 5 | 불량 사용자 신고 | (`platformPlanningDoc.md` §6) | P2 |

---

## 3. 구현 단계 및 가설

### Phase 0 — 프로젝트 초기화
**목표**: 빌드 가능한 Next.js 베이스 확보  
**성공 기준**: `npm run dev` 정상 실행, Supabase 연결 확인

- [ ] `npm install`
- [ ] `src/` 폴더 구조 생성 (아래 §5 참조)
- [ ] `.env.local` 작성 (Supabase URL + anon key)
- [ ] Supabase 클라이언트 유틸 작성 (`src/lib/supabase/`)
- [ ] Supabase에 PostgreSQL 스키마 적용 (DDL 변환 후 SQL Editor 실행)
- [ ] `src/types/database.ts` — DB 테이블 TypeScript 타입 정의

### Phase 1 — 인증 (P0)
**가설**: Supabase Auth의 이메일 OTP 기능으로 학교 메일 인증을 구현할 수 있다.  
**변수**: 학교 도메인 허용 리스트 필터링은 커스텀 Route Handler에서 처리.  
**성공 기준**: 학교 메일로 OTP 수신 → 인증 → JWT 세션 발급 → 보호된 페이지 접근 가능

- [ ] Supabase Auth 이메일 OTP 설정
- [ ] `/auth/register` 페이지 — 이메일 입력 + 도메인 검증 + OTP 전송
- [ ] `/auth/verify` 페이지 — OTP 입력 + 닉네임/학번 설정
- [ ] `/auth/login` 페이지
- [ ] 미들웨어 (`src/middleware.ts`) — 세션 갱신 + 라우트 보호
- [ ] Zustand auth store — 세션 상태 전역 관리

**논의 필요**: 졸업생 허용 여부 (→ `school_domain` 화이트리스트로 제어)

### Phase 2 — 프로필 설정 (P1)
**가설**: Supabase Storage를 S3 대체재로 사용해 이미지 업로드 구현 가능.  
**성공 기준**: 프로필 사진 변경, 한 줄 소개, 선호 지역 설정이 DB에 반영됨

- [ ] `/my/profile` 페이지 — 프로필 편집 폼
- [ ] 이미지 업로드 컴포넌트 (리사이징, EXIF 제거)
- [ ] Route Handler: `PATCH /api/users/[uid]/profile`
- [ ] `Region` 마스터 데이터 시드 (서울 주요 지역)

### Phase 3 — 상품 등록 및 관리 (P1)
**가설**: 다중 이미지 업로드는 Supabase Storage + `ProductImage` 테이블로 처리.  
**성공 기준**: 상품 등록/수정/Soft Delete 가능, 목록 조회 페이지 동작

- [ ] `/products/new` 페이지 — 등록 폼 (카테고리, 가격, 상태, 이미지)
- [ ] `/products/[pid]/edit` 페이지
- [ ] `/products` 페이지 — 목록 (필터, 무한 스크롤)
- [ ] `/products/[pid]` 페이지 — 상세
- [ ] Route Handlers: `POST /api/products`, `PATCH /api/products/[pid]`, `DELETE /api/products/[pid]`
- [ ] `Category` 마스터 데이터 시드

**논의 필요**: 금지 품목 리스트, 가격 상한선 정책

### Phase 4 — 거래 완료 및 평가 (P2)
**가설**: 거래 완료 확정 → `Transaction` INSERT + `Product.status` UPDATE는 Supabase의 PostgreSQL 트랜잭션으로 원자적 처리 가능.  
**성공 기준**: 거래 완료 → 리뷰 작성 → `manner_temperature` 재계산 반영

- [ ] 거래 완료 확정 모달
- [ ] 별점 + 리뷰 + 매너 키워드 선택 UI
- [ ] Route Handler: `POST /api/transactions/[id]/complete`
- [ ] 매너 온도 재계산 로직 (Review 평균 → User 업데이트)
- [ ] `MannerKeyword` 마스터 데이터 시드

### Phase 5 — 불량 사용자 신고 (P2)
**가설**: 신고자 익명성은 Route Handler에서 `reporter_uid`를 응답 페이로드에 포함하지 않는 방식으로 보장.  
**성공 기준**: 신고 접수 → `Report` + `ReportEvidence` INSERT, 중복 신고 차단

- [ ] 신고 모달 컴포넌트 (사유 선택 + 증거 사진)
- [ ] Route Handler: `POST /api/reports`
- [ ] 중복 신고 방지 로직 (동일 reporter+target 기간 조건)

---

## 4. 공통 컴포넌트 계획

| 컴포넌트 | 용도 |
|---------|------|
| `ImageUploader` | 이미지 선택, 미리보기, 리사이징, EXIF 제거 |
| `StarRating` | 별점 드래그/클릭 인터페이스 |
| `MannerTempBadge` | 매너 온도 표시 (색상 범위별) |
| `ProductCard` | 상품 목록 카드 |
| `AuthGuard` | 미들웨어와 함께 라우트 보호 |

---

## 5. 폴더 구조

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── verify/page.tsx
│   ├── (main)/
│   │   ├── products/
│   │   │   ├── page.tsx           # 목록
│   │   │   ├── new/page.tsx       # 등록
│   │   │   └── [pid]/
│   │   │       ├── page.tsx       # 상세
│   │   │       └── edit/page.tsx  # 수정
│   │   └── my/
│   │       └── profile/page.tsx
│   └── api/
│       ├── auth/
│       ├── users/[uid]/
│       ├── products/
│       └── reports/
├── components/
│   ├── ui/            # 재사용 기본 컴포넌트
│   ├── auth/
│   ├── products/
│   └── review/
├── hooks/             # 커스텀 훅 (useAuth, useProduct 등)
├── lib/
│   ├── supabase/      # 클라이언트·서버 Supabase 인스턴스
│   └── utils/
├── stores/            # Zustand store
├── types/
│   └── database.ts    # DB 테이블 TypeScript 타입
└── constants/
    └── school-domains.ts  # 허용 학교 도메인 리스트
```

---

## 6. 환경 변수 체크리스트

`.env.local`에 필요한 항목:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # Route Handler 전용 (서버 측)
```

---

## 7. 미결 논의사항 (개발 중 결정 필요)

| 항목 | 현재 상태 | 관련 Phase |
|------|----------|-----------|
| 졸업생 이용 허용 여부 | 미결 | Phase 1 |
| 닉네임 정책 (변경 횟수 제한 등) | 미결 | Phase 1 |
| 선호 지역 정밀도 (좌표 vs 지역 ID) | 지역 ID로 확정 | Phase 2 |
| 금지 품목 리스트 | 미결 | Phase 3 |
| 가격 상한선 정책 | 미결 | Phase 3 |
| 채팅 기능 (탐색/상호작용) | 이번 범위 외 | — |
