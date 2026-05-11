# KUSecondHand 인수인계 문서

작성일: 2026-05-11

---

## 1. 프로젝트 개요

고려대학교 중고거래 플랫폼. 일반 학생의 중고 매물 거래 + 교환학생을 위한 생필품 패키지 거래 두 가지 흐름을 하나의 서비스로 통합.

- **프레임워크**: Next.js 16 (App Router), TypeScript
- **DB/Auth**: Supabase (PostgreSQL + RLS + Realtime)
- **스타일**: Tailwind CSS
- **번역**: DeepL API (채팅 실시간 번역)
- **검색**: OpenAI text-embedding-3-small + pgvector + pg_trgm (hybrid)

---

## 2. 환경 설정

`.env.local` 필수 항목:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
DEEPL_AUTH_KEY=
```

`.env.example` 파일 참고. Supabase 프로젝트는 두 개:
- **kusecond-test**: 개발/테스트용 (마이그레이션 적용 완료)
- **kusecond-set**: 프로덕션용 (**마이그레이션 미적용 — 아래 §3 참고**)

---

## 3. DB 마이그레이션 — kusecond-set에 적용 필요

`db/migrations/` 폴더의 파일을 **003 → 009 순서대로** Supabase SQL Editor에서 실행해야 함.
001~002는 이미 적용되어 있다고 가정.

| 파일 | 내용 |
|------|------|
| `003_trust_successful_trade_count.sql` | users 테이블에 신뢰도 컬럼 추가 |
| `004_item_categories_category_fk.sql` | item_categories FK 추가 |
| `005_essential_packages_country_code.sql` | essential_packages 국가 코드 컬럼 추가 |
| `006_package_matches_nullable_buyer.sql` | buyer_uid NULL 허용 |
| `007_package_matches_price.sql` | package_matches 가격 컬럼 추가 |
| `008_search_embeddings.sql` | pgvector 테이블, HNSW 인덱스, RPC 함수 |
| `009_hnsw_index.sql` | IVFFlat → HNSW 인덱스 교체 |

모든 파일이 `IF NOT EXISTS` / `CREATE OR REPLACE` 기반이라 중복 실행해도 안전.

---

## 4. 지금까지 한 것

### 4-1. 브랜치 머지 (Phase 1~3)

기존에 4개 팀원 브랜치가 orphan 히스토리로 분리되어 있었음. `merge/integration` 브랜치에서 수동으로 통합.

| 브랜치 | 내용 | 커밋 |
|--------|------|------|
| bundle-recommendation-code | 패키지 추천, 중고가 시세 추천 | `6242b74` |
| item-recommendation | 카테고리별 매물 추천 (`/products/recommendations`) | `aae2d6c` |
| exchange-student | 교환학생 패키지 거래 전체 (패키지 목록/상세/등록, 채팅, 매칭, 위시리스트, 마이페이지) | `11c2d78` |

머지 전략: `git merge` 금지 (orphan 충돌), `git checkout origin/<branch> -- <path>` 방식으로 파일 단위 통합.

### 4-2. 교환학생 기능 개선

- **세탁 인증(hygiene) 전면 제거** — score.ts, types/package.ts, 관련 UI 전부 삭제. `/sell/hygiene`는 `/sell/template`로 redirect
- **incoming/outgoing 자동 판별** — 마이페이지에서 역할 드롭다운 제거. 국가 코드 KR이면 incoming, 그 외 outgoing 자동 결정
- **패키지 가격 필수화** — `sell/register` 페이지에서 가격 미입력 시 게시 불가
- **등록 취소 기능** — 바이어 없을 때 셀러가 패키지 등록 취소 가능
- **채팅 목록 정리** — 빈 채팅 목록의 "패키지 추천 보기" 링크 제거

### 4-3. UI 통합

- **레이아웃 단일화**: (exchange) route group 제거, 모든 라우트 `(main)` 그룹으로 통합
- **NavBar**: 검색창, 상품 등록, 교환학생 링크 추가
- **마이페이지**: `/my/profile` 단일화 — 일반 프로필 + 교환학생 프로필 섹션 통합
- **위시리스트**: 일반 상품 + 패키지 통합 카드 UI
- **패키지 추천 UI**: sticky 플로팅 바→인라인, 가로스크롤→그리드

### 4-4. 신규 기능

**일반 상품 등록** (`/products/new`)
- 이미지 업로드, 카테고리 계층 선택
- `POST /api/products` 구현

**일반 상품 위시리스트**
- `GET/POST /api/wishlists`, `DELETE /api/wishlists/[pid]`
- 상품 상세 페이지 찜하기 버튼

**검색 시스템** (hybrid search)
- OpenAI `text-embedding-3-small`으로 semantic 검색
- `pg_trgm`으로 fuzzy 키워드 검색
- RRF(Reciprocal Rank Fusion, k=60)로 두 결과 병합
- 일반 유저: 매물만, 교환학생: 매물+패키지 탭
- similarity threshold 0.25로 무관한 결과 필터링
- `scripts/backfill-embeddings.ts`로 기존 데이터 39개 embedding 완료

**일반 상품 채팅**
- 상품 상세 페이지에 "채팅하기" 버튼 (`ChatButton` 컴포넌트)
- `POST /api/chat/create` — 채팅방 생성 및 참여자 등록 (service role로 RLS 우회)
- `chat/[id]` 페이지에서 일반 상품 채팅 / 교환학생 패키지 채팅 분기 처리
- `chat/page` 목록에 일반 상품 채팅방 포함

### 4-5. 버그 수정

| 버그 | 원인 | 수정 |
|------|------|------|
| 검색 결과 0건 | IVFFlat lists=100, rows=39 → 빈 클러스터 | HNSW 인덱스로 교체 (migration 009) |
| 검색 결과 0건 | search API가 anon key → RLS 차단 | service role client로 변경 |
| 검색 결과 0건 | embedding을 number[]로 전달 → PostgREST 타입 변환 실패 | `[x,x,...]` string으로 전달 |
| 채팅 메시지 전송 403 | `chat_participants` PK가 `cp_id`인데 `.select('id')` 사용 | `.select('cp_id')`로 수정 |
| 채팅방 생성 실패 | 클라이언트에서 seller를 `chat_participants`에 INSERT → RLS 차단 | `/api/chat/create` 서버 route에서 service role로 처리 |

---

## 5. 앞으로 할 것 (우선순위 순)

### 긴급

**main 브랜치 Auth 변경사항 통합**
- 누군가 main에 인증 관련 코드를 푸시함 (2026-05-11 이후)
- 변경된 파일: `src/app/auth/`, `src/components/auth/`, `src/lib/auth/`, `src/proxy.ts`
- `merge/integration` 브랜치에 아직 반영 안 됨 — main에서 해당 파일들 cherry-pick 또는 수동 통합 필요
- `proxy.ts`는 기존에 dead code 상태였는데 (PLAN.md D1 참고) 이번에 정상화됐을 가능성 있음 — 내용 확인 후 middleware로 활성화 여부 결정

### 높음

**kusecond-set 마이그레이션 적용** (§3 참고)
- set 프로젝트에 003~009 SQL 실행
- 실행 후 `scripts/backfill-embeddings.ts` 재실행 필요 (set DB에는 embedding 데이터 없음)

**채팅 end-to-end 테스트**
- 실제 두 계정으로 일반 상품 채팅 / 교환학생 패키지 채팅 전체 흐름 확인
- 패키지 채팅: pending → 첫 메시지 → matched 상태 전환 확인

### 중간

**온보딩 구현** (`docs/flow-design.md §3` 참고)
- 신규 가입 후 교환학생 여부 판단 → 프로필 등록 유도 흐름 미구현

**미들웨어 활성화 논의** (PLAN.md D1)
- `src/proxy.ts`가 dead code 상태 — 인증 가드 미작동
- 팀원 의도 확인 후 `middleware.ts`로 rename해서 활성화할지 결정

**패키지 이미지 업로드**
- 현재 패키지 등록 시 이미지 없음 — 일반 상품처럼 이미지 지원 추가 가능

### 낮음

**placeholder 14개 채우기**
- 빈 컴포넌트/훅 파일 14개 존재 (ChatBubble, PackageCard, useChat 등)
- 기능은 이미 인라인으로 동작 중 — 리팩토링 성격, 급하지 않음
- 목록: `docs/merge-history/PLAN-2026-05-11.md §12`

**ESLint 설정** (PLAN.md D6)
- `eslint.config.mjs` 신규 작성 필요 (Next.js 16에서 `next lint` 제거됨)

---

## 6. 주요 파일 구조

```
src/
├── app/
│   ├── (auth)/              # 로그인, 회원가입
│   ├── (main)/              # 모든 일반/교환학생 라우트
│   │   ├── chat/            # 채팅 목록 + 채팅방
│   │   ├── packages/        # 교환학생 패키지 목록/상세
│   │   ├── products/        # 일반 매물 목록/상세/추천
│   │   ├── recommend/       # 패키지 추천, 중고가 시세
│   │   ├── search/          # 통합 검색
│   │   ├── sell/            # 상품/패키지 등록
│   │   └── wishlist/        # 찜 목록
│   └── api/                 # API routes
│       ├── chat/            # create, send
│       ├── matches/         # auto, complete
│       ├── products/        # 상품 CRUD
│       ├── search/          # products, packages
│       └── wishlists/       # 위시리스트 CRUD
├── components/
│   └── chat/ChatButton.tsx  # 상품 채팅 시작 버튼
├── hooks/
│   └── useExchangeProfile.ts
├── lib/
│   ├── deepl/translate.ts   # DeepL 번역
│   ├── openai/embeddings.ts # OpenAI embedding 생성
│   └── search/hybridSearch.ts
└── types/                   # exchange.ts, match.ts, supabase.ts 등

db/migrations/               # 001~009 SQL 마이그레이션
scripts/
└── backfill-embeddings.ts   # 기존 데이터 embedding 생성 스크립트
docs/
├── HANDOVER.md              # 이 문서
├── flow-design.md           # 전체 유저 플로우 설계
├── search-design.md         # 검색 시스템 설계
└── exchange_student_*.md    # 교환학생 기능 스펙
```

---

## 7. 시드 데이터

테스트 계정 및 초기 데이터:

| 파일 | 내용 |
|------|------|
| `proc/seed/03-exchange-seed.sql` | 교환학생 테스트 계정 4개 (US/DE/JP/KR) |
| `proc/seed/04-package-seed.sql` | essential_packages 3종 + package_items |
| `proc/seed/02-sample-data.sql` | 일반 매물 샘플 데이터 |

테스트 계정 생성은 Supabase Authentication에서 직접 생성 후 위 시드 SQL 실행.
