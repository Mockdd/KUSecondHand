# KU Secondhand
고려대학교 학우들을 위한 안전한 중고거래 플랫폼

## 프로젝트 개요

KU Secondhand 는 고려대학교 학우 인증을 거친 사용자만 참여하는 캠퍼스 특화 중고거래 서비스입니다.
단순 매물 등록/검색을 넘어 **학과·학년·거주 형태·시간표** 같은 학생 컨텍스트를 활용해
"지금 나에게 필요한 물건"을 자동으로 묶어 추천하는 데 초점을 두었습니다.

- 인증된 학우 간 거래로 신뢰도 확보
- 신입생 / 자취생 / 교환학생 등 라이프스타일별 패키지 추천
- 시간표 강의 기반 교재·실습 도구 추천
- 임베딩 기반 의미 검색과 다국어 지원으로 교환학생까지 포괄

## 주요 기능

### 매물 / 거래
- 매물 등록 · 사진 업로드 (Supabase Storage)
- 카테고리 (대분류 6 / 소분류) 기반 탐색 + CategoryBar
- 검색: 키워드 + OpenAI 임베딩 기반 의미 검색 (pgvector + HNSW 인덱스)
- 위시리스트 (찜)
- 1:1 채팅 (매물 단위 / 패키지 세션 단위)
- 거래 후 리뷰 · 신뢰점수 (trust metrics)

### 추천
- **패키지 추천**: 학과 × 학년 × 거주 형태(기숙사/자취) 매트릭스 기반
  - `essential_packages` (DORM_BASIC, FLAT_FULL 등)
  - `package_templates` (학과별 템플릿)
  - `meta_packages` (메타 묶음)
- **시간표 기반 매물 추천** (item-recommendation): 수강 강의 → 교재/도구 매칭
- **시세 추천** (resale-price): 카테고리·연식 기반 적정 가격 제안
- **매물-학과 매핑** (M:N, `item_related_majors`): 매물 풀을 학과별로 필터링

### 사용자 / 인증
- 회원가입 · 학우 이메일 인증 (verify)
- 비밀번호 찾기 / 아이디 찾기 / 재활성화 (휴면 계정 복귀)
- 신고 (reports) · 차단
- 휴면 계정 자동 처리 (cron, 기본 180일)

### 교환학생
- 출신 국가(country_code) 기반 매칭
- 다국어 채팅 (DeepL 번역) + i18n (한/영)

## 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| Framework | Next.js (App Router), React 19, TypeScript |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage) |
| Styling | Tailwind CSS v4 |
| State | Zustand, @tanstack/react-query |
| Search / AI | OpenAI Embeddings, pgvector + HNSW |
| i18n | next-i18next, react-i18next |
| 번역 | DeepL API |
| Deploy | Docker (output: standalone), Railway |

## 디렉토리 구조

```
KUSecondHand/
├── src/
│   ├── app/
│   │   ├── (auth)/               # 로그인 / 회원가입 / 인증
│   │   │   ├── login, register, verify
│   │   │   ├── find-id, forgot-password, reset-password
│   │   │   └── reactivate
│   │   ├── (main)/               # 메인 라우트
│   │   │   ├── products          # 매물 목록 / 상세
│   │   │   ├── search            # 키워드 + 의미 검색
│   │   │   ├── sell              # 매물 등록
│   │   │   ├── chat              # 1:1 채팅
│   │   │   ├── wishlist          # 위시리스트
│   │   │   ├── packages          # 패키지 추천
│   │   │   ├── recommend         # 시간표 기반 매물 추천
│   │   │   ├── recommendations   # 통합 추천 허브
│   │   │   └── my                # 마이페이지
│   │   ├── api/                  # Route Handlers
│   │   │   ├── auth, account, profile
│   │   │   ├── products, categories, majors, regions
│   │   │   ├── search, recommend, matches
│   │   │   ├── chat, wishlists, reviews, reports
│   │   │   └── cron              # 휴면 계정 등 정기 작업
│   │   ├── auth/                 # OAuth / 콜백
│   │   ├── layout.tsx, globals.css
│   │   └── proxy.ts              # 인증 미들웨어 (next 파라미터 보존)
│   ├── components/               # auth, chat, home, layout, products,
│   │                             # profile, trust, wishlist, CourseAddModal
│   ├── constants/                # 카테고리, 학과, 거주 형태 등 상수
│   ├── hooks/                    # 커스텀 훅
│   ├── lib/                      # supabase client, util
│   ├── stores/                   # Zustand store
│   └── types/                    # 공통 타입
├── proc/
│   ├── seed/                     # 시드 SQL (페르소나/패키지/매물/교환학생 등)
│   ├── plan/                     # 개발 계획 문서
│   └── spec/                     # 기능 스펙
├── db/
│   ├── migrations/               # 002~013 (휴면계정, 신뢰점수, 임베딩, HNSW, 채팅 등)
│   ├── ERD.jpg, erd_script.py
│   ├── platformDataDoc.md, tableSpec.md
├── docs/                         # HANDOVER, PLAN, 기능 스펙, UX 설계 노트
├── scripts/                      # e2e-seed-accounts, backfill-trust-metrics, backfill-embeddings
├── schema.sql                    # 전체 스키마 스냅샷
├── Dockerfile, .dockerignore     # Railway 배포
└── next.config.ts                # standalone + 이미지 호스트 화이트리스트
```

## 데이터 모델 (요약)

- **학과**: 64개 (고려대 전체 학부)
- **카테고리**: 대분류 6 + 소분류 (item_categories, FK 연결)
- **essential_packages**: DORM_BASIC / FLAT_FULL 등 기본 패키지
- **package_templates**: 학과 × 학년 × 거주 형태 매트릭스
- **meta_packages**: 메타 묶음 패키지
- **item_related_majors**: 매물 ↔ 학과 M:N 매핑 (RLS 적용)
- **search_embeddings**: OpenAI 임베딩 + HNSW 인덱스
- **trust metrics**: successful_trade_count 등 신뢰 지표

전체 스키마는 [schema.sql](schema.sql), ERD 는 [db/ERD.jpg](db/ERD.jpg) 참고.

## 시드 데이터

`proc/seed/` 아래 10개 SQL (총 약 3,158 라인) 로 데모 데이터 구성:

| 파일 | 내용 |
| --- | --- |
| `02-sample-data.sql` | 카테고리 · 학과 · 지역 기본 데이터 |
| `03-exchange-seed.sql` | 교환학생 매칭 시드 |
| `04-package-seed.sql` | essential_packages |
| `04a-persona-seed.sql` | 페르소나 20명 |
| `04b-package-template-seed.sql` | 학과별 package_templates |
| `05-product-seed.sql` | 매물 220개 |
| `06-product-related-majors.sql` | 매물-학과 M:N 매핑 84건 |
| `06b-product-related-majors-rls.sql` | 위 테이블 RLS 정책 |
| `08-meta-packages.sql` | 메타 패키지 |
| `test-seed.sql` | E2E / 개발 테스트용 |

## 개발 환경 설정

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수
`.env.local` 을 만들고 [.env.example](.env.example) 을 참고해 채워주세요.

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000

OPENAI_API_KEY=...
DEEPL_API_KEY=...

CRON_SECRET=...
DORMANT_INACTIVE_DAYS=180
```

### 3. DB 준비
1. Supabase 프로젝트 생성
2. [schema.sql](schema.sql) 실행
3. [db/migrations](db/migrations) 순차 적용 (002 → 013)
4. `proc/seed/*.sql` 순서대로 실행 (02 → 03 → 04 → 04a → 04b → 05 → 06 → 06b → 08)

### 4. 실행
```bash
npm run dev          # 개발 서버 (webpack)
npm run dev:turbo    # Turbopack
npm run build        # 프로덕션 빌드 (standalone)
npm run start        # 프로덕션 실행
npm run type-check   # TypeScript 검사
npm run lint         # ESLint
```

### 5. 보조 스크립트
```bash
npm run seed:e2e            # E2E 테스트 계정 시드
npm run backfill:trust      # 신뢰점수 백필
npx tsx scripts/backfill-embeddings.ts   # 검색 임베딩 백필
```

## 배포

- **Docker**: 루트의 [Dockerfile](Dockerfile) 사용 (Next.js `output: 'standalone'`)
- **Railway**: `staging` 브랜치 push 시 자동 배포
- 이미지 호스트: Supabase Storage, picsum.photos, placehold.co, loremflickr.com (next.config.ts 화이트리스트)

## 협업 워크플로우

1. `main` 에서 feature 브랜치 분기 (`feature/<이름>-<주제>`)
2. PR 생성 → 리뷰
3. **Squash and merge** 로 main 통합
4. main → staging 머지 시 Railway 가 자동 배포

브랜치 통합 이력은 [docs/merge-history](docs/merge-history) 에 기록되어 있습니다.

## 문서

- [docs/HANDOVER.md](docs/HANDOVER.md) — 인수인계 가이드
- [docs/flow-design.md](docs/flow-design.md) — 사용자 플로우 설계
- [docs/search-design.md](docs/search-design.md) — 검색 설계
- [docs/ux-ui-design-rationale.md](docs/ux-ui-design-rationale.md) — UX/UI 결정 배경
- [docs/exchange_student_feature_spec.md](docs/exchange_student_feature_spec.md) — 교환학생 기능 스펙
- [proc/spec/feature-package-recommendation.md](proc/spec/feature-package-recommendation.md) — 패키지 추천 스펙
- [proc/spec/feature-resale-price.md](proc/spec/feature-resale-price.md) — 시세 추천 스펙

## 라이선스

내부 공모전 프로젝트입니다.
