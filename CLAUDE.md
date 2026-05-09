# 캠퍼스 중고거래 — 시간표 기반 추천 페이지

## 프로젝트 개요
고려대 학생 대상 중고거래 플랫폼 (팀 프로젝트).
나는 시간표 기반 추천 페이지 파트만 담당.

## 내 담당
시간표 기반 물품 추천 페이지 (4개 화면):
1. 추천 입력창 — 수강 과목 등록 + [추천받기]
2. 과목 추가 모달 — 전공/검색/학년 3개 탭
3. 추천 결과 — 과목별 추천 물품 + 추천 이유
4. 매물 목록 — 추천 카테고리의 상품 리스트

## MVP 추천 방식
통계/ML 사용 X. course_recommendations 테이블에 사람이 직접
입력한 "과목 → 물품 카테고리" 매핑을 그대로 조회해서 보여줌.

## 기술 스택
- Next.js 15.5 (App Router) + React 19 + TypeScript + Tailwind 4
- Dev: Turbopack
- 상태 관리: @tanstack/react-query (서버 상태), zustand (클라이언트 상태)
- 다국어: i18next + react-i18next + next-i18next
- 번역 API: deepl-node (옆 팀 번역 채팅 기능용 — 본인 파트엔 직접 사용 X)
- Supabase (Auth, PostgreSQL, Storage)
- 전체 스키마: supabase/migrations/20260503000000_init.sql

## 디렉토리 구조
- `src/` 디렉토리 사용 (팀 표준)
- import alias (tsconfig paths):
  * `@/*`           → `./src/*`
  * `@components/*` → `./src/components/*`
  * `@lib/*`        → `./src/lib/*`
  * `@hooks/*`      → `./src/hooks/*`
  * `@types/*`      → `./src/types/*`
  * `@constants/*`  → `./src/constants/*`

## 호출 방식 규약 (팀 합의)
- Edge Function 사용: 거래 완료, 번역 채팅, 패널티 발행, 감사 로그
- 그 외 모두: Supabase 클라이언트 SDK 직접 호출 (RLS 의존)

## 내 페이지가 사용하는 테이블
- 읽기: majors, courses, course_schedules, item_categories,
        course_recommendations, products, product_images, categories
- 쓰기: user_courses (본인 수강 과목 등록/삭제)

## 절대 어기면 안 되는 규칙
1. 자동 동기화 컬럼 직접 UPDATE 금지
   (products.view_count, users.trade_count, users.warning_count)
2. Soft Delete: products는 deleted_at IS NULL 필터 필수
3. RLS 활성화 — 모든 클라이언트 쿼리는 auth.uid() 컨텍스트 의존
4. 인증은 Supabase Auth (auth.users) — public.users는 프로필
5. categories(상품용)와 item_categories(추천용)는 다른 테이블, 합치지 말 것
6. Next 15 cookies() 는 async API — server.ts 의 createClient 도 async 함수
   호출 측에서 await 필수: `const supabase = await createClient()`

## 네이밍 컨벤션
- snake_case (DB 컬럼), camelCase (TS 변수)
- PK: uid(users), pid(products), 그 외 *_id
- 학기 표기: '2026-1' 형식

## 현재 진행 단계
마이그레이션 완료 — MVP-v2 가 작업 본진. MVP/ (→ MVP-old/ rename) 는 참고용.

- Step 1: 새 프로젝트 셋업 + 의존성 ✅
- Step 2: 코드 이전 ✅
  - 2-0 ~ 2-7 모두 완료
  - lib/, middleware, components/CourseAddModal/, app/dev/, app/recommendations/
  - Next 15 cookies async 적용
  - 시각 검증 통과 (인증 흐름 + 본인 페이지 + 모달)
  - tsc --noEmit 통과
- Step 3: 카테고리 매핑 작업 ✅
  - item_categories.category_id (FK → categories) 추가 — 라이브 DB 적용 완료
  - 7개 매핑 시드 적용 완료 (콘솔 확인)
  - SQL 자산 MVP-v2/ 로 정착: supabase/migrations/, supabase/seed/, schema.sql
- Step 4: 본격 신규 작업 ← 다음 작업 후보
  - 화면 3 (매물 목록)
  - 화면 4 (상품 상세)

### 알려진 follow-up
- ESLint flat config 가 legacy `eslint-config-next` preset 과 호환 안 됨
  (baseline 8d56fbb 부터 존재). FlatCompat 적용 필요. 마이그레이션과 무관.

## 마이그레이션 시 주의사항
- import 경로 변경: `@/lib/...` → `@lib/...` (팀 paths 컨벤션)
  단, src/ 내부 컴포넌트 간 `@/components/...` 는 그대로 OK (둘 다 src/ 안이라 작동)
- Next 15 cookies API:
  * server.ts 의 createClient 함수가 async 됨
  * 호출 측: `const supabase = createClient()` → `const supabase = await createClient()`
  * 영향 받는 파일: app/dev/me, app/dev/logout, app/recommendations/result 등 server component
- middleware.ts 위치: 루트가 아니라 `src/middleware.ts` 로 (src/ 사용 시 Next.js 규칙)
