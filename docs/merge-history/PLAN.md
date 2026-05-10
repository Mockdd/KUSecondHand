# KUSecondHand 머지 계획 (PLAN.md)

작성일: 2026-05-10
업데이트: 2026-05-10 (사용자 결정사항 반영)
대상 브랜치: `merge/integration` (main에서 분기, 현재 main과 동일)
참고: [docs/branch-analysis.md](docs/branch-analysis.md)

> **중요**: 본 문서는 계획 단계 산출물입니다. 사용자 승인 전 실제 머지·코드 수정은 일체 수행하지 않습니다.

---

## 0. 확정된 결정사항 (2026-05-10)

| # | 결정 | 적용 |
|---|---|---|
| 1 | `/products` URL은 main 유지. item-recommendation의 `/products`는 **`/products/recommendations`** 로 이전. | Phase 2에서 처리 |
| 2 | `/products/[pid]`도 main 유지. item-recommendation의 [pid]는 **`/products/recommendations/[pid]`** 로 이전. | Phase 2에서 처리 |
| 3 | **미들웨어 보류**. `src/proxy.ts`는 그대로 둔다. 팀원이 의도적으로 rename했을 수 있어 추가 확인 필요. **머지 작업 전체 종료 후 재논의**. | §5 deferred에 기록 |
| 4 | 브랜치별 schema 차이는 main의 schema.sql + 마이그레이션 파일로 흡수 (item-rec: `item_categories.category_id` FK / exchange-student: `essential_packages.name_*` 정합화) | Phase 2, Phase 3 선행 작업 |
| 5 | 머지 단위는 **기능(브랜치)별 PR 분리**. Phase 1/2/3 각각 별도 PR. | 모든 Phase |

> Next.js 라우팅 메모: `app/(main)/products/recommendations/page.tsx` (정적 세그먼트)는 `app/(main)/products/[pid]/page.tsx` (동적 세그먼트)보다 우선 매칭됩니다. 따라서 `/products/recommendations` 진입 시 main의 `[pid]`가 잡지 않고 새 정적 라우트가 동작합니다.

---

## 1. 단계별 머지 계획 (개요)

### Phase 0 — 사전 준비 (코드 수정 없음)
- [x] 결정사항 합의
- [x] `merge/integration` 브랜치가 main과 동일 상태 (HEAD `648ee07...`)
- [ ] `.env.local` 준비 (§4)

### Phase 1 — bundle-recommendation-code 통합 (위험도 ★)
상세 계획은 §2 참고. URL 충돌 0건, schema 변경 0건.
**커밋/PR**: `feat(merge): bundle-recommendation-code (패키지 추천 + 재판매가 추천) 통합`

### Phase 2 — item-recommendation 통합 (위험도 ★★)
- 선행: schema 마이그레이션 1건 (`db/migrations/004_item_categories_category_fk.sql`) + `schema.sql` 본체 패치
- `/products` 동일 URL → `/products/recommendations` 로 이전
- `/products/[pid]` 동일 URL → `/products/recommendations/[pid]` 로 이전
- 추천 결과에서 매물로 이동하는 링크: `/products?cat_id=...` → `/products/recommendations?cat_id=...` 로 일괄 수정
- `(main)` 그룹 하위로 배치 검토
**커밋/PR**: `feat(merge): item-recommendation (시간표 기반 추천) 통합 + item_categories.category_id FK`

### Phase 3 — exchange-student 통합 (위험도 ★★★) — 진입 시 결정 반영

**Schema 차이 처리 방향 (2026-05-10 결정)**:
- `essential_packages.country_code` (브랜치 신규) → main schema에 컬럼 추가 (마이그레이션)
- `essential_packages.name JSONB` (브랜치) ↔ `name_ko/name_en` (main) → **코드 어댑팅** (main schema가 진실)

**선행 작업**: `db/migrations/005_essential_packages_country_code.sql` 신설 + `schema.sql` 본체 패치 (단독 커밋)

**Cherry-pick whitelist — 44 파일**
- 페이지 (exchange) 11 + API 3 + Components 9 + Hooks 4 + Lib 4 + Constants 2 + Types 4 + Docs 7

**결정·제외**:
- `(auth)/login` 정확히 같은 경로 — main 유지, 브랜치 자체 폐기
- 자체 `middleware.ts` 및 `lib/supabase/middleware.ts` 가져오지 않음 (결정 #3)
- 디렉토리 cherry-pick 시 따라오는 `.gitkeep` 은 즉시 제거

**코드 어댑팅 (cherry-pick 후)**:
- A1: `createServerSupabaseClient` → `createClient` (3 API routes)
- A2: `essential_packages.name` JSONB 가정 코드 → `name_ko/name_en` 분리 (3 페이지 + 2 타입)

**커밋/PR**: 2개 분리
- `feat(merge): essential_packages.country_code 컬럼 추가 (exchange-student 선행 schema)`
- `feat(merge): exchange-student (교환학생 패키지 + 채팅 + 매칭) 통합`

### Phase 4 — 마무리 (코드 수정 최소)
- `.env.example` 신규 작성
- `npm run type-check && npm run lint && npm run build` 전체 통과 확인
- (결정 #3) 미들웨어 활성화 논의 — **별도 세션**

---

## 2. Phase 1 상세 계획 — bundle-recommendation-code

> **이 섹션은 사용자 검토용. OK 받기 전 실행하지 않습니다.**

### 2.1. 가져올 파일 whitelist (12개)

| # | 출처 (origin/bundle-recommendation-code) | 대상 (merge/integration) | 비고 |
|---|---|---|---|
| 1 | `src/app/(features)/recommend/package/page.tsx` | `src/app/(main)/recommend/package/page.tsx` | route group을 `(main)`으로 이동 (헤더/네비 공유) |
| 2 | `src/app/(features)/recommend/package/_components/PackageRecommendationClient.tsx` | `src/app/(main)/recommend/package/_components/PackageRecommendationClient.tsx` | |
| 3 | `src/app/(features)/recommend/package/_components/HousingTypeSelector.tsx` | 동일 디렉토리 | |
| 4 | `src/app/(features)/recommend/package/_components/CategorySection.tsx` | 동일 디렉토리 | |
| 5 | `src/app/(features)/recommend/package/_components/ProductCard.tsx` | 동일 디렉토리 | |
| 6 | `src/app/(features)/recommend/package/_components/PackageResult.tsx` | 동일 디렉토리 | |
| 7 | `src/app/(features)/recommend/resale-price/page.tsx` | `src/app/(main)/recommend/resale-price/page.tsx` | |
| 8 | `src/app/(features)/recommend/resale-price/_components/ResalePriceClient.tsx` | 동일 디렉토리 | |
| 9 | `src/app/(features)/recommend/resale-price/_components/ResalePriceForm.tsx` | 동일 디렉토리 | |
| 10 | `src/app/(features)/recommend/resale-price/_components/ResalePriceResult.tsx` | 동일 디렉토리 | |
| 11 | `src/app/api/recommend/category-avg-price/route.ts` | 동일 경로 | admin client 호출 함수명 어댑팅 (§2.4) |
| 12 | `src/lib/recommend/packageQueries.ts` | 동일 경로 | |
| 13 | `src/lib/recommend/resalePriceQueries.ts` | 동일 경로 | |
| 14 | `src/lib/recommend/resalePriceCalculator.ts` | 동일 경로 | |
| 15 | `src/lib/recommend/semesterUtils.ts` | 동일 경로 | |
| 16 | `src/types/recommend.ts` | 동일 경로 | main에 없는 신규 파일 |

(원래 16개로 셈 — 표 #는 1부터 16까지)

### 2.2. 보존 자료 (선택) — 문서/시드

| 출처 | 대상 | 처리 |
|---|---|---|
| `proc/spec/feature-package-recommendation.md` | `proc/spec/feature-package-recommendation.md` | 그대로 보존 (main은 `proc/plan/dev-plan.md`만 보유, 충돌 없음) |
| `proc/spec/feature-resale-price.md` | `proc/spec/feature-resale-price.md` | 그대로 보존 |
| `proc/spec/combine.md` | `proc/spec/combine.md` | 그대로 보존 |
| `proc/seed/02-sample-data.sql` | `proc/seed/02-sample-data.sql` | dev DB 적용은 별도 단계 |
| `proc/seed/test-seed.sql` | `proc/seed/test-seed.sql` | 동일 |

> 시드 SQL은 파일만 머지하고 **실제 DB 적용은 별개 결정**. 머지 PR에서는 코드만.

### 2.3. 명시적 제외 (skip)

| 출처 | 사유 |
|---|---|
| `.DS_Store`, `proc/.DS_Store`, `skills/.DS_Store` | macOS 시스템 파일 |
| `install.sh` | 브랜치 작업자 셋업 스크립트 |
| `skills/**` (3개 SKILL.md, .Rhistory) | 브랜치 작업자 도구 |
| `.env.local.example` | Phase 4에서 통합본 작성 |
| `src/app/{layout,page,globals.css}` | main 유지 |
| `src/app/login/**`, `src/app/signup/**` | main의 `(auth)/login`·`(auth)/register` 사용 |
| `src/app/auth/callback/route.ts` | main의 `auth/callback/page.tsx` 패턴 유지 |
| `src/lib/supabase/{client,server,admin}.ts` | main 유지 (main이 더 풍부) |
| `src/lib/providers.tsx` | main의 `src/components/Providers.tsx` 유지 |
| `package.json`, `package-lock.json`, `tsconfig.json`, `postcss.config.mjs`, `next-env.d.ts`, `.gitignore` | main 유지 |
| `schema.sql` | 정확히 동일 (0줄 차이) |
| `proc/seed/01-create-missing-tables.sql` | 테이블 이미 main schema.sql에 존재 (line 1822~) |

### 2.4. 충돌 예상 지점과 해결 방안

| # | 지점 | 충돌 종류 | 해결 |
|---|---|---|---|
| C1 | route group `(features)` vs `(main)` | UX 일관성 | 가져오는 시점에 경로를 `(main)/recommend/...` 로 변경. URL은 동일 (`/recommend/package`, `/recommend/resale-price`). main의 `(main)/layout.tsx` 헤더·네비 공유. |
| C2 | `category-avg-price/route.ts`가 `createAdminClient` import | 함수명 불일치 (main은 `createServiceRoleClient`) | 라우트 파일에서 `import { createServiceRoleClient } from '@/lib/supabase/admin'`로 변경 + `const supabase = createServiceRoleClient()` + null 가드 추가 (main 패턴). |
| C3 | bundle 코드의 `@/lib/providers` import | main에는 없음 | feature 파일들은 실제로 `@/lib/providers`를 import하지 않음 (root layout만 사용). root layout은 가져오지 않으므로 충돌 없음. ✅ 검증 완료 |
| C4 | bundle 페이지가 `if (!user) redirect('/login?next=...')` | main `/login` 표준과 호환 | main의 `/login`이 `next` 쿼리스트링을 처리하는지 확인. 처리하면 그대로 OK, 안 하면 단순 `/login` 으로 변경. |
| C5 | `package_template_items.categories(name)` 조인 RLS | RLS 정책 의존 | main schema에서 `categories`는 `전체 공개 읽기` 정책 — anon도 SELECT 가능. ✅ 안전. |
| C6 | `transactions.agreed_price`, `transactions.completed_at`, `transactions.status='completed'` 컬럼 | schema 컬럼명 일치 확인 | main schema에 존재 확인 필요. (Phase 1 진입 직전 grep 1회) |
| C7 | tsconfig path alias | 모든 import가 `@/...`만 사용 | main tsconfig가 `@/* → ./src/*` 정의 — 모든 import 그대로 동작. ✅ |

### 2.5. 정확한 git 명령 시퀀스 (실행은 사용자 승인 후)

```bash
# 작업 디렉토리: KUSecondHand
# 현재 브랜치: merge/integration (main과 동일 상태)

# (선행) C6 컬럼 검증
grep -nE "transactions|agreed_price|completed_at" schema.sql | head

# 1) lib + types 가져오기 (충돌 0건)
git checkout origin/bundle-recommendation-code -- src/types/recommend.ts
git checkout origin/bundle-recommendation-code -- src/lib/recommend/

# 2) API route 가져오기
git checkout origin/bundle-recommendation-code -- src/app/api/recommend/

# 3) 페이지/컴포넌트를 신규 (main) 그룹에 배치
#    git checkout은 동일 경로로만 가져오므로,
#    (features) → (main) 이동은 git mv 또는 mkdir + mv 로 별도 처리
mkdir -p "src/app/(main)/recommend"
git checkout origin/bundle-recommendation-code -- "src/app/(features)/recommend/"
git mv "src/app/(features)/recommend/package"      "src/app/(main)/recommend/package"
git mv "src/app/(features)/recommend/resale-price" "src/app/(main)/recommend/resale-price"
rmdir "src/app/(features)/recommend" "src/app/(features)" 2>/dev/null

# 4) C2 수정 — admin client 함수명 어댑팅
#    src/app/api/recommend/category-avg-price/route.ts:
#      - import { createAdminClient } from '@/lib/supabase/admin'
#      + import { createServiceRoleClient } from '@/lib/supabase/admin'
#      - const supabase = createAdminClient()
#      + const supabase = createServiceRoleClient()
#      + if (!supabase) return NextResponse.json({ error: 'service unavailable' }, { status: 503 })
#    (Edit 도구로 정확 수정)

# 5) (선택) docs/seed 보존
git checkout origin/bundle-recommendation-code -- proc/spec/feature-package-recommendation.md
git checkout origin/bundle-recommendation-code -- proc/spec/feature-resale-price.md
git checkout origin/bundle-recommendation-code -- proc/spec/combine.md
git checkout origin/bundle-recommendation-code -- proc/seed/02-sample-data.sql
git checkout origin/bundle-recommendation-code -- proc/seed/test-seed.sql

# 6) 검증
git status
git diff --stat HEAD

# 7) 검증 명령 (§2.6)
# ...

# 8) 커밋 (PR 단위)
git add -A
git commit -m "feat(merge): bundle-recommendation-code 통합 (패키지 추천 + 재판매가 추천)"
```

### 2.6. 검증 방법

머지 후 즉시 실행:

| 단계 | 명령 | 통과 기준 |
|---|---|---|
| V1 | `npm install` (필요 시) | 종료 코드 0 |
| V2 | `npm run type-check` | TS 에러 0건 |
| V3 | `npm run lint` | 신규 lint 에러 없음 |
| V4 | `npm run build` | 빌드 성공 |
| V5 | `npm run dev` 후 브라우저 `/recommend/package` 진입 | 로그인 미완 시 `/login` 리다이렉트, 로그인 후 housing_type 선택 UI 렌더 |
| V6 | `/recommend/resale-price` 진입 | 카테고리 셀렉트 UI 렌더 (categories 테이블 비어 있으면 빈 select) |
| V7 | `/api/recommend/category-avg-price?category_id=1` curl | 200 응답 (`{avg_price: ..., count: ...}` 또는 `{avg_price: null, count: 0}`) |
| V8 | `git diff main...merge/integration --stat` 확인 | whitelist 파일만 추가 확인 (제외 항목 누락 없음) |

> dev DB가 비어 있어도 Phase 1 검증은 통과해야 함 (빈 결과 graceful 처리). 시드(`proc/seed/02-sample-data.sql`) 적용은 V5/V6 완료 후 별도 단계.

### 2.7. Phase 1 롤백

문제 발생 시:
```bash
git reset --hard main   # merge/integration을 main으로 되돌림
```
(merge/integration이 push되지 않은 한 안전)

---

## 3. Phase 2 — item-recommendation 통합 (개요)

> Phase 1 완료 + 사용자 OK 후 별도 상세 계획 작성.

핵심 변경:
- **선행 마이그레이션**: `db/migrations/004_item_categories_category_fk.sql` 신설 + `schema.sql` line 1375~ 부근에 `category_id INTEGER NULL` 컬럼 + FK + 인덱스 + COMMENT 동시 패치.
- **URL 분담** (결정 #1, #2):
  - `app/products/page.tsx` → `app/(main)/products/recommendations/page.tsx`
  - `app/products/[pid]/page.tsx` → `app/(main)/products/recommendations/[pid]/page.tsx`
- **링크 일괄 수정**: 추천 결과 → 매물 진입 링크 (`/products?cat_id=...`) 가 새 경로(`/products/recommendations?cat_id=...`)를 가리키도록 모든 호출지에서 grep + Edit.
- 그 외 whitelist는 Phase 1 직후 상세화.

---

## 4. 환경변수 체크리스트 (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # admin client / API routes (transactions 집계)
DEEPL_AUTH_KEY=                     # exchange-student 채팅 번역 (Phase 3)
```

`.env.example`은 Phase 4에서 신규 작성.

---

## 5. 머지 작업 종료 후 별도 논의 (deferred)

| # | 항목 | 사유 |
|---|---|---|
| D1 | **`src/proxy.ts` 정상화 여부** (결정 #3) | 팀원이 `middleware` → `proxy`로 의도적으로 rename했을 가능성. 의도 확인 필요. 현재 dead code 상태 — 인증 가드 미작동. 머지 완료 후 팀 합의 후 (a) `middleware.ts`로 rename 활성화, (b) 의도 보존 + 별도 활성 메커니즘, (c) 영구 비활성 중 결정. |
| D2 | 매물 페이지 분담 후 UX 흐름 (메인 `/products` ↔ 추천 결과 `/products/recommendations`) | 머지 완료 후 실제 데이터로 사용자 흐름 검증. |
| D3 | i18next 초기화 정착 (Phase 3 이후) | namespace JSON, locale switcher 등 미구현 — 채팅 번역 외 i18n 활용 결정. |
| D4 | bundle의 `(main)/recommend/*` 진입을 `(main)/layout.tsx` 네비에 노출할지 | UX 결정. |
| D5 | 시드 SQL 적용 정책 | dev/staging 별 적용 시점, owner 합의. |

---

## 6. 위험 요인 & 미지수

| 위험 | 영향 | 완화 |
|---|---|---|
| `essential_packages.name` JSONB→`name_ko/name_en` 변경 영향 범위가 예상보다 넓을 수 있음 | exchange-student 코드 수정 증가 | Phase 3 진입 시 grep으로 모든 사용처 사전 식별 후 일괄 |
| main의 `lib/auth/*`, OTP 흐름과 브랜치들의 자체 로그인 가정 불일치 | UX 어색함 | 브랜치 자체 LoginForm 모두 폐기, main 표준 사용 |
| `/login?next=...` 쿼리 처리가 main에 없을 수 있음 | 추천 페이지 → 로그인 → 복귀 흐름 끊김 | Phase 1 V5 검증 시점에 확인. 미지원이면 PHASE 1 내에서 main의 `(auth)/login` 코드에 `next` 처리 추가 (별도 small-PR 또는 본 PR 포함 — 결정 필요) |
| Supabase RLS 정책이 service_role 가정인데 anon으로 호출되는 경우 | 데이터 못 읽음 | API route 항상 admin client 사용. 클라이언트 직접 호출은 RLS authenticated. |

---

## 7. 머지 작업의 git 패턴

각 파일을 가져올 때 사용할 명령 (실행은 사용자 승인 후):

```bash
# 단일 파일
git checkout origin/<branch> -- <path>

# 디렉토리 통째
git checkout origin/<branch> -- <path>/

# 가져온 후 ls + git status로 확인
git status
git diff --stat HEAD
```

> `git merge --allow-unrelated-histories` 는 사용 금지. orphan 히스토리 4개라 충돌이 거의 모든 파일에서 발생.

---

## 8. 다음 액션

1. **사용자: §2 (Phase 1 상세 계획) 검토**
2. OK 시 Phase 1 실행 (코드 수정 + 검증 + 커밋)
3. Phase 1 결과 보고 후 Phase 2 상세 계획 작성 → 검토 → 진행
4. Phase 3 동일 절차
5. Phase 4 (마무리) → 머지 작업 종료 → §5 deferred 논의 시작

---

## 9. V3 lint — pre-existing main breakage (deferred)

> 기록일: 2026-05-10 | Phase 1 검증 중 발견. cherry-pick과 무관.

### 원인 요약

| 항목 | 상태 |
|------|------|
| Next.js 버전 | 16.2.6 |
| `next lint` subcommand | **제거됨** (Next 15+에서 deprecated, 16에서 삭제) |
| `package.json` `"lint"` 스크립트 | `"next lint"` — main 업그레이드 시점부터 **broken** |
| ESLint 설정 파일 | **부재** (`.eslintrc.*`, `eslint.config.*` 모두 없음) |
| ESLint 패키지 | eslint ^9.25.1, eslint-config-next: latest, @typescript-eslint/* ^8.30.1 설치됨 |

### 실제 실행 결과 (2026-05-10)

```
$ npm run lint
> next lint
Invalid project directory provided, no such directory: .../lint
---EXIT: 0   ← 오해 소지 (lint 자체가 실행되지 않음)

$ npx eslint .
Oops! Something went wrong! :(
ESLint: 9.39.4
ESLint couldn't find an eslint.config.(js|mjs|cjs) file.
From ESLint v9.0.0, the default configuration file is now eslint.config.js.
---EXIT: 0
```

### 조치 방향 (deferred)

- cherry-pick 파일과 **무관** — Phase 1 통합 자체의 회귀 없음
- 별도 이슈로 분리: `eslint.config.mjs` 신규 작성 + `package.json` lint 스크립트를 `"eslint ."` 으로 변경
- Phase 4 마무리 단계에서 처리 권장 (§1 Phase 4 참고)

---

## 10. V7 — 환경 의존 검증 (skipped with note)

> 기록일: 2026-05-10 | Phase 1 검증 중 확인.

### 실행 결과

```
GET /api/recommend/category-avg-price?category_id=1
→ HTTP 503  {"error": "service unavailable"}
```

### 원인

`.env.local`에 `SUPABASE_SERVICE_ROLE_KEY` 미설정.
`createServiceRoleClient()`가 `null` 반환 → route.ts의 null 가드가 503 응답.

### 검증된 것 ✅

- `/api/recommend/category-avg-price` 빌드에 포함됨 (V4 통과)
- 라우트 등록됨 (503 응답 = 라우트에 도달함, 404 아님)
- C2 어댑팅에서 추가한 null 가드가 의도대로 동작 (크래시 없이 503 graceful 응답)
- 코드 자체 정상

### 미검증 ⏳

- 실제 DB 쿼리 응답 (`avg_price`, `count` 필드)
- `SUPABASE_SERVICE_ROLE_KEY` 설정 후 별도 확인 필요

---

## 11. V5/V6 — pending env setup

> 기록일: 2026-05-10 | `.env.local` 미설정으로 브라우저 검증 보류.

| 단계 | URL | 상태 |
|------|-----|------|
| V5 | `http://localhost:3000/recommend/package` | ⏳ pending — `.env.local` 수령 후 재검증 |
| V6 | `http://localhost:3000/recommend/resale-price` | ⏳ pending — `.env.local` 수령 후 재검증 |

재검증 시 확인 항목:
- V5: 로그인 전 → `/login?next=...` 리다이렉트, 로그인 후 → housing_type 선택 UI 렌더
- V6: 카테고리 셀렉트 UI 렌더 (categories 비어 있으면 빈 select — graceful)
