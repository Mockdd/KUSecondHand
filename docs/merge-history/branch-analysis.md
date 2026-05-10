# KUSecondHand 브랜치 분석

작성일: 2026-05-10
대상 브랜치: `main`, `bundle-recommendation-code`, `exchange-student`, `item-recommendation`
참고용 브랜치(머지 제외): `bundle-recommendation` (5개 커밋, 6개 파일 — 초기 schema 자료만)

---

## 0. 전체 요약

- **모든 브랜치는 동일 스택 (Next.js + Supabase 웹앱).** 앱→웹 변환 이슈는 없음.
- **모든 브랜치는 서로 orphan 히스토리** (`git merge-base` 결과 없음). 일반적인 `git merge`는 사실상 의미 없음 — 파일 단위 cherry-pick 필요.
- **`schema.sql`은 main이 통합본** (2026-05-03 통합, 2237줄). 3개 도메인(메인/수강추천/교환학생) 모든 테이블 포함.
- 각 브랜치 schema vs main 차이는 매우 작음:
  - `bundle-recommendation-code`: **0줄 차이** (정확히 동일)
  - `exchange-student`: 1곳 — `essential_packages.name JSONB` ↔ main은 `name_ko/name_en` 분리
  - `item-recommendation`: 1곳 — `item_categories.category_id INTEGER FK → categories` 컬럼 추가
- **충돌의 본질**: 코드 중복(자체 `layout.tsx`, `page.tsx`, `globals.css`, 자체 `lib/supabase/*`, 자체 auth 페이지). 도메인 코드 자체는 거의 안 겹침.

---

## 1. main 브랜치

**커밋 수**: 1 (`648ee07 components`)
**스택**:
- Next.js 15 (App Router, `--webpack` 기본, Turbopack 옵션) + React 19 + TypeScript (strict)
- Tailwind CSS v4 + `@tailwindcss/postcss`
- Supabase: `@supabase/ssr 0.6.1`, `@supabase/supabase-js 2.43.4`
- 상태: Zustand (`authStore`), TanStack Query
- i18n: `i18next`, `next-i18next`, `react-i18next`
- 번역 API: `deepl-node`
- 보안: `bcryptjs` (+ `@types/bcryptjs`)
- 도구: `tsx` (스크립트용)
- TS path alias: `@/*`, `@components/*`, `@lib/*`, `@hooks/*`, `@types/*`, `@constants/*`

**파일 수**: src/ 73 / 전체 92

**기능 영역**:
- **인증** (`(auth)` route group): `login`, `register`, `verify`, `find-id` (+ `verify`), `forgot-password`, `reset-password`, `reactivate`
  - 컴포넌트: `LoginForm`, `RegisterForm`, `VerifyForm`, `VerifyGate`, `FindIdForm`, `FindIdVerifyForm`, `FindIdVerifyGate`, `ForgotPasswordForm`, `ResetPasswordForm`, `ReactivateForm`, `WithdrawAccountForm`
  - lib: `lib/auth/validate.ts`, `lib/auth/otp-session-redirect.ts`, `lib/supabase/{client,server,admin,otp-sender,auth-callback-client}.ts`
- **프로필**: `(main)/my/profile`, `(main)/my/account`, `components/profile/{ProfileForm,ActivityRegionAuto}`
- **상품**: `(main)/products` (목록), `(main)/products/[pid]`, `(main)/products/[pid]/edit`, `(main)/products/new`
- **API routes**: `api/regions`, `api/regions/resolve`, `api/products`, `api/products/[pid]`, `api/majors`, `api/profile`, `api/reports`, `api/reviews`, `api/auth/*` (reactivate, send-email-otp, complete-profile, sync-password, withdraw, touch-activity), `api/account/status`, `api/cron/{trust-recompute,dormant}`
- **신뢰도/매너 온도**: `lib/trust/{recompute,success,temperature,constants}.ts`, `components/trust/TrustBadge`
- **계정 휴면 처리**: `lib/account/dormant.ts`, `db/migrations/002_account_activity_dormant.sql`
- **로깅 보호**: `lib/logging/sanitize.ts`
- **공통**: `components/Providers.tsx` (TanStack QueryClientProvider 등), `stores/authStore.ts`

**미들웨어** ⚠️:
- `src/proxy.ts` 존재 — `proxy()` 함수와 `config.matcher` export.
- 그러나 Next.js 미들웨어는 파일명이 `middleware.ts`이고 `middleware()`를 export 해야 동작함.
- **현재 main에는 실제로 동작하는 미들웨어가 없음** — 인증 가드, dormant 리다이렉트 등이 활성화 안 된 상태로 보임.
- 머지 시 `src/proxy.ts` → `src/middleware.ts`로 rename + 함수명 변경 필요.

**스키마 위치**:
- `schema.sql` (root, 2237줄, 통합본)
- `db/migrations/{002_account_activity_dormant,003_trust_successful_trade_count}.sql` (증분)
- `db/{tableSpec.md, platformDataDoc.md, ERD.jpg, erd_script.py}`

**빌드 스크립트**:
- `dev` (webpack), `dev:turbo`, `build`, `start`, `lint`, `type-check`
- `seed:e2e` (`scripts/e2e-seed-accounts.mjs`), `backfill:trust` (`scripts/backfill-trust-metrics.ts`)

---

## 2. bundle-recommendation-code 브랜치 (팀원1)

**커밋 수**: 1 orphan (`6047b52 setup bundle recommendation feature`)
**스택**: main과 동일 (Next.js + Supabase + Tailwind 4 + TanStack + Zustand + i18next + deepl-node). `package.json`은 main의 부분집합 (`bcryptjs`, `tsx`, `next-i18next` 외에는 동일).

**파일 수**: 52개

**기능**:
- **패키지 추천** `(features)/recommend/package`
  - 학과·학년·거주형태·학기 조건으로 필요 물품 묶음 자동 제안
  - 컴포넌트: `PackageRecommendationClient`, `HousingTypeSelector`, `CategorySection`, `ProductCard`, `PackageResult`
- **재판매가 추천** `(features)/recommend/resale-price`
  - 카테고리·상태·사용월수 기반 시세 가이드
  - 컴포넌트: `ResalePriceClient`, `ResalePriceForm`, `ResalePriceResult`
- **API**: `api/recommend/category-avg-price` (service_role로 transactions 집계)

**핵심 디렉토리**:
- `src/app/(features)/recommend/{package,resale-price}/` — 페이지 및 _components/
- `src/lib/recommend/{packageQueries,resalePriceQueries,resalePriceCalculator,semesterUtils}.ts`
- `src/types/recommend.ts`
- `src/lib/supabase/{client,server,admin}.ts` (main에 동일 위치 존재 — main 우선)
- `src/lib/providers.tsx` (main의 `src/components/Providers.tsx`와 중복 — main 우선)

**자체 보유 (main과 충돌)**:
- `src/app/{layout,page}.tsx`, `src/app/globals.css`
- `src/app/login/page.tsx` + `_components/LoginForm.tsx` (main의 `(auth)/login`과 동일 URL — main 우선)
- `src/app/signup/page.tsx` + `_components/SignupForm.tsx` (main은 `/register` 사용 — 버림)
- `src/app/auth/callback/route.ts` (main은 `auth/callback/page.tsx` — main 우선)
- `next-env.d.ts`, `tsconfig.json`, `postcss.config.mjs`, `package.json`, `package-lock.json`, `.gitignore`

**의존 테이블**:
- 읽기: `package_templates`, `package_template_items`, `resale_price_rules`, `users`, `categories`, `products`, `product_images`, `transactions` (집계)
- 쓰기: 없음 (이 브랜치 docs 명시적 규칙: 기존 테이블 read-only)

**스키마 차이**: **0줄** — main schema에 모든 테이블·ENUM 이미 포함 (`자산 순환 및 자동화 파트` 섹션, line 1822~).

**시드 자료**:
- `proc/seed/01-create-missing-tables.sql` — main에 이미 있는 테이블이라 **불필요** (skip)
- `proc/seed/02-sample-data.sql`, `proc/seed/test-seed.sql` — 추천 동작 검증용 시드. 머지 후 dev DB에 적용 권장.

**스펙/문서**: `proc/spec/{combine,feature-package-recommendation,feature-resale-price,ai-command-rules}.md`, `proc/plan/2026-05-09_*.md`

**기타 (머지 제외 권장)**:
- `install.sh`, `skills/` (개발 도구), `.DS_Store` (시스템 파일), `.env.local.example`

---

## 3. exchange-student 브랜치 (팀원2)

**커밋 수**: 1 orphan (`5f09ac7 feat: 교환학생 파트 Phase 1+2 전체 구현`)
**스택**: main과 동일 (구성 동일). `package.json` 의존성은 main의 부분집합.

**파일 수**: 60개

**기능**:
- **(exchange) route group** — 교환학생 패키지 거래
  - `packages` (목록), `packages/[id]` (상세)
  - `sell` (등록 시작), `sell/template` (템플릿 선택), `sell/register` (양식 입력), `sell/hygiene` (위생 인증 업로드)
  - `wishlist` (찜), `mypage` (내 정보)
  - `chat` (채팅 목록), `chat/[id]` (방)
- **API**: `api/chat/send`, `api/matches/auto`, `api/matches/complete`
- **다국어 채팅**: `lib/deepl/translate.ts`, `components/chat/{ChatBubble,ChatInput,TranslationToggle}`
- **위생 인증**: `components/exchange/{HygieneBadge,SupplementGuide}`

**핵심 디렉토리**:
- `src/app/(exchange)/*` (10 페이지 + layout)
- `src/app/api/{chat,matches}/*` (3 routes)
- `src/components/{chat,exchange}/*` (9개)
- `src/hooks/{useChat,useMatches,usePackages,useExchangeProfile}.ts`
- `src/lib/{deepl/translate,utils/{fallback,format,score}}.ts`
- `src/lib/supabase/{client,server,middleware}.ts` (main과 위치 충돌 — main 우선; `middleware.ts`는 별도 검토 필요)
- `src/types/{exchange,match,package,supabase}.ts`
- `src/constants/{packages,regions}.ts`
- `docs/exchange_student_*.md` (8개 문서 — 그대로 가져갈 가치 있음)

**자체 보유 (main과 충돌)**:
- `src/app/{layout,page,providers,globals.css}` 류
- `src/app/(auth)/login/page.tsx` ⚠️ — main과 **정확히 같은 경로**. main 우선.
- `src/middleware.ts` — main에는 `src/proxy.ts`가 별도. 충돌 없지만 어떤 것을 활성화할지 결정 필요.
- `next.config.ts` (main이 supabase 이미지 도메인 등록 → main 우선)
- `package.json`, `package-lock.json`, `tsconfig.json`, `postcss.config.mjs`, `.gitignore`

**의존 테이블**:
- 읽기/쓰기: `countries`, `exchange_students`, `essential_packages`, `package_items`, `package_listings`, `package_matches`, `hygiene_certifications`, `exchange_wishlists`, `chat_rooms`, `chat_participants`, `chat_messages`, `users`, `regions`
- 외부 API: DeepL 번역

**스키마 차이**: 1곳 — `essential_packages.name JSONB` ↔ main의 `name_ko/name_en` 두 컬럼.
- 결정: **main schema가 진실** (`name_ko VARCHAR(200)`, `name_en VARCHAR(200)`).
- 영향: 이 브랜치 app 코드가 `essential_packages.name`을 JSONB로 읽는 곳이 있다면 `name_ko`/`name_en`로 수정해야 함. (i18n 컨텍스트에 따라 분기)

**중간 미들웨어 상태**:
- 현재 `middleware()`가 `return NextResponse.next()`로 비활성화돼 있음 (주석: "개발 중 인증 체크 비활성화"). 즉 사실상 no-op.

---

## 4. item-recommendation 브랜치 (팀원3)

**커밋 수**: 12 (자체 히스토리, `8315811 Initial commit from Create Next App`부터 빌드)
**스택**: main과 동일. `next` 버전이 `^15.5.0`로 명시 (main은 `latest`).

**파일 수**: 59개

**문서**: `README.md` (Next 기본), `CLAUDE.md` (브랜치 작업 메모 — **매우 상세**, 머지 시 그대로 가져갈 가치 큼)

**기능** (CLAUDE.md 명시):
- 시간표 기반 물품 추천 페이지 (4개 화면):
  1. 추천 입력창 (`/recommendations`) — 수강 과목 등록 + [추천받기]
  2. 과목 추가 모달 (`components/CourseAddModal`) — 전공/검색/학년 3개 탭
  3. 추천 결과 (`/recommendations/result`) — 과목별 추천 물품
  4. 매물 목록 (`/products?cat_id=...`) + 상품 상세 (`/products/[pid]`)
- MVP는 ML 미사용. `course_recommendations` 테이블의 사람 입력 매핑을 그대로 조회.

**핵심 디렉토리**:
- `src/app/recommendations/{page,result/page}.tsx`
- `src/app/products/{page,[pid]/page}.tsx` ⚠️ **main과 동일 URL**
- `src/components/CourseAddModal/{index,CourseResultList}.tsx`
- `src/lib/queries/{categories,courses,majors,products,recommendations,user-courses,types}.ts`
- `src/lib/{format,supabase/{client,server}}.ts`
- `src/middleware.ts` (실제 동작하는 supabase ssr 패턴)
- 개발용 (머지 제외 권장): `src/app/dev/{login,logout,me,supabase-check}/*`
- `supabase/migrations/{20260503000000_init.sql, 20260508000000_add_item_categories_category_fk.sql}` — 마이그레이션 자산
- `supabase/seed/{item_categories_mapping_dev.sql, products_dev.sql, recommendations_dev.sql}` — 시드

**자체 보유 (main과 충돌)**:
- `src/app/{layout,page,globals.css}`
- `src/app/products/page.tsx` 및 `src/app/products/[pid]/page.tsx` ⚠️ — main의 `(main)/products/...`와 **동일 URL**. CLAUDE.md에서도 "옆 팀과 분담 합의 필요"로 명시.
- `src/middleware.ts` — main에는 `src/proxy.ts`. main proxy가 더 풍부 (인증 가드, dormant 처리). 그러나 main proxy는 export명이 `proxy`라 동작 안 함. 머지 시 main proxy를 `middleware.ts`로 rename + 이 브랜치 미들웨어 패턴 비교 후 통합.
- `next.config.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, `postcss.config.mjs`, `.gitignore`, `eslint.config.mjs` (main에 없음)
- `public/*.svg` (Next 기본)

**의존 테이블**:
- 읽기: `majors`, `courses`, `course_schedules`, `item_categories`, `course_recommendations`, `products`, `product_images`, `categories`
- 쓰기: `user_courses` (수강 등록/삭제)

**스키마 차이**: 1곳 — `item_categories.category_id INTEGER NULL` 컬럼 + FK→`categories(category_id)` (ON DELETE SET NULL). 주석: "NULL 이면 추천 결과의 [상품 보러가기] 버튼은 비활성".
- 이 컬럼 없이는 `category_id`로 products 페이지에 진입하는 흐름이 끊김.
- 결정: **main schema에 이 컬럼 추가** (마이그레이션 1개 추가).

**알려진 follow-up** (브랜치 CLAUDE.md):
- ESLint flat config가 legacy `eslint-config-next` preset과 호환 안 됨 (FlatCompat 적용 필요)
- 화면 4의 찜/채팅 버튼은 placeholder — 다른 팀(채팅: exchange / 찜: main)과 연결 필요

---

## 5. 충돌 매트릭스 (브랜치 vs main)

| 경로 | bundle-rec-code | exchange-student | item-recommendation | 결정 |
|---|---|---|---|---|
| `src/app/layout.tsx` | ⚠ | ⚠ | ⚠ | **main 유지** (Providers 연결됨) |
| `src/app/page.tsx` | ⚠ | ⚠ | ⚠ | **main 유지** (`/products` 리다이렉트) |
| `src/app/globals.css` | ⚠ | ⚠ | ⚠ | main 유지, 추가 스타일은 검토 후 병합 |
| `src/lib/supabase/client.ts` | ⚠ | ⚠ | ⚠ | **main 유지** |
| `src/lib/supabase/server.ts` | ⚠ | ⚠ | ⚠ | **main 유지** (async cookies 패턴) |
| `src/lib/supabase/admin.ts` | ⚠ | — | — | **main 유지** |
| `next.config.ts` | — | ⚠ | ⚠ | **main 유지** (Supabase 이미지 도메인) |
| `tsconfig.json` | ⚠ | ⚠ | ⚠ | **main 유지** (path alias 풍부) |
| `package.json` | ⚠ | ⚠ | ⚠ | **main을 base로 deps 병합** (bcryptjs, tsx 등 main이 우위) |
| `(auth)/login` | (자체 `/login`) | ⚠ 동일 경로 | — | **main 유지**; 브랜치 자체 LoginForm은 버림 |
| `(auth)/register` vs `/signup` | ⚠ (`/signup`) | — | — | **main의 `/register` 채택** |
| `auth/callback/page.tsx` vs `route.ts` | ⚠ (route handler) | — | — | **main 유지** (page.tsx 패턴) |
| `(main)/products/page.tsx` | — | — | ⚠ `/products` 동일 URL | 분담 합의 — main이 base; item-rec의 `?cat_id=` 필터링 패치로 통합 |
| `(main)/products/[pid]/page.tsx` | — | — | ⚠ 동일 URL | 분담 합의 — 두 구현 비교 후 결정 (item-rec 버전이 view 로깅 포함) |
| `src/middleware.ts` / `src/proxy.ts` | — | ⚠ (no-op) | ⚠ (활성) | **main의 proxy 로직을 살리되 파일명을 middleware로 rename** + item-rec의 ssr 패턴 참고 |
| `src/components/Providers.tsx` vs `src/lib/providers.tsx` / `src/app/providers.tsx` | ⚠ | ⚠ | — | **main의 components/Providers 유지** |

---

## 6. 의존성 맵 (브랜치 → main 자산)

```
main (인증/프로필/상품 CRUD/trust/dormant/regions/majors)
  ↑                                       ↑
  │ users, products, categories,          │ middleware (인증 가드),
  │ product_images, regions, majors       │ supabase clients, Providers
  │                                       │
  ├── bundle-recommendation-code          ├── exchange-student
  │     • read: users, categories,        │     • read/write: countries,
  │       products, product_images,       │       exchange_students,
  │       transactions, package_templates,│       essential_packages,
  │       package_template_items,         │       package_items,
  │       resale_price_rules              │       package_matches,
  │     • new routes:                     │       package_listings,
  │       /recommend/package              │       hygiene_certifications,
  │       /recommend/resale-price         │       exchange_wishlists,
  │       /api/recommend/category-avg-price│       chat_*
  │                                       │     • DeepL 외부 API
  │                                       │     • new routes: (exchange)/*
  │                                       │       /api/chat/send
  │                                       │       /api/matches/{auto,complete}
  │
  └── item-recommendation
        • read: majors, courses, course_schedules, item_categories,
                course_recommendations, products, product_images, categories
        • write: user_courses
        • DB 변경: item_categories.category_id INTEGER FK 추가
        • new routes: /recommendations, /recommendations/result
        • 충돌: /products, /products/[pid] (main과 분담 필요)
```

**모든 브랜치 공통 의존**:
- Supabase Auth + `users` 프로필 — main이 모두 owner
- `categories`, `products`, `product_images` — main이 CRUD owner, 다른 브랜치는 read
- 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (admin client / API routes)
- (선택) `DEEPL_AUTH_KEY` (exchange-student 채팅 번역용)

---

## 7. 머지 순서 권장 (의존성·충돌 적은 순)

1. **bundle-recommendation-code 먼저**
   - 이유: URL 충돌 없음 (`(features)/recommend/*`는 main에 없는 경로). schema 변경 0건. 자체 auth는 버리고 main 사용.
   - 위험도: ★ (낮음)

2. **item-recommendation 두 번째**
   - 이유: schema 변경 1건만 추가 (작음). 브랜치 자체 docs(CLAUDE.md)에 "옆 팀 합치기" 단계가 명시돼 있어 머지 가정으로 작성됨. /products 충돌 1곳만 해결하면 됨.
   - 위험도: ★★ (중간 — /products 분담 결정 필요)

3. **exchange-student 마지막**
   - 이유: 충돌이 가장 많음 — `(auth)/login` 정확히 같은 경로, 미들웨어, 자체 providers, schema의 essential_packages.name 형식 차이로 app 코드 일부 수정 필요. 채팅·매칭 등 도메인이 가장 큼.
   - 위험도: ★★★ (높음 — 코드 수정 동반)

> 모든 단계에서 main의 schema를 진실로 삼고, 각 브랜치의 schema 차이는 main 기준으로 코드를 수정하거나 main에 미니 마이그레이션을 추가하는 식으로 일방향 정합.

---

## 8. 앱→웹 변환 주의점

해당 없음. 모든 브랜치가 이미 동일한 Next.js (App Router) 웹 스택 — 네이티브 모바일 코드 없음.

다만 비슷한 성격의 주의점은 있음:
- **CSS 통합**: 각 브랜치의 `globals.css`에 자체 base 스타일이 있을 수 있음. main에 머지 시 의도한 디자인 토큰(예: 색상 변수, 폰트)이 덮어쓰이지 않도록 검토.
- **Tailwind v4 config**: postcss.config.mjs는 거의 동일하지만 차이가 있는지 diff 필요.
- **이미지 도메인**: main `next.config.ts`에 이미 `bxgpjheyxkjldpwabyni.supabase.co`만 등록. 브랜치들이 다른 supabase 프로젝트 URL을 쓴다면 추가 필요.
- **i18n 초기화**: main에 i18next 의존성은 있지만 실제 초기화 코드(`i18n.ts`, namespace JSON)가 보이지 않음 — exchange-student 머지 시 채팅 번역과 함께 초기화 정착 필요.
- **미들웨어 활성화**: main의 `src/proxy.ts`가 사실상 dead code 상태. 머지 마무리에 `src/middleware.ts`로 rename + `proxy` → `middleware` 함수명 변경하지 않으면 어떤 인증 가드도 동작 안 함.
- **Next 15 cookies async**: 모든 server component에서 `const supabase = await createClient()` 패턴 일관 적용 (item-recommendation CLAUDE.md에 강조).

---

## 9. 환경변수 체크리스트 (.env.local)

머지 후 dev 실행 전 필요한 키:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # admin client / API routes (transactions 집계 등)
DEEPL_AUTH_KEY=                     # exchange-student 채팅 번역
# (필요 시) NEXT_PUBLIC_SITE_URL=  # auth callback redirect 등
```

`.env.example`은 main에 없음 — 머지 마무리에 생성 권장.
