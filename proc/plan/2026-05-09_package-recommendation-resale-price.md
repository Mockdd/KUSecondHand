# 패키지 추천 & 재판매 가격 추천 구현 계획

## 목표

`/recommend/package`와 `/recommend/resale-price` 두 페이지를 독립적으로 구현한다.
기존 팀원 작업 영역(`products`, `transactions`, `users` 테이블 및 상품 등록/거래 플로우)을 수정하지 않는다.

## 현재 맥락

- 프로젝트 상태: `schema.sql`, `package.json`, `tsconfig.json`만 존재. `src/` 또는 `app/` 없음.
- 팀이 동시에 초기 구조를 세우는 단계.
- 스택: Next.js App Router + Supabase + TanStack Query + Zustand + Tailwind CSS + TypeScript
- 관련 파일: `schema.sql` (테이블 구조 확인 완료)
- 의존성: `package_templates`, `package_template_items`는 이미 schema에 존재. Seed 데이터는 별도 필요.
- 제약:
  - `transactions` RLS 이슈 → RPC 함수 또는 Route Handler 필요 (팀 협의 필요)
  - `users.housing_type` 없음 → UI 입력으로 대체 (schema 변경 없음)

## 작업 항목

### 공통 기반
- [ ] `app/(features)/recommend/` 디렉토리 구조 생성
- [ ] `types/recommend.ts` 타입 정의 (PackageRecommendation, ResalePriceInput, ResalePriceResult)
- [ ] `lib/supabase/` 클라이언트 설정 확인 (팀원 구현 여부 파악)
- [ ] `lib/recommend/` 디렉토리 생성

### 기능 1: 패키지 추천
- [ ] `lib/recommend/semesterUtils.ts` — 날짜 → 학기 파생 함수
- [ ] `lib/recommend/packageQueries.ts` — Supabase 쿼리 함수 3개 (템플릿, 구성물품, 상품)
- [ ] `app/(features)/recommend/package/page.tsx` — 서버 컴포넌트 (초기 major/grade 로드)
- [ ] `app/(features)/recommend/package/_components/HousingTypeSelector.tsx`
- [ ] `app/(features)/recommend/package/_components/PackageResult.tsx`
- [ ] `app/(features)/recommend/package/_components/CategorySection.tsx`
- [ ] `app/(features)/recommend/package/_components/ProductCard.tsx`
- [ ] 빈 상태 처리 (템플릿 없음 / 상품 없음)
- [ ] 비로그인 시 로그인 유도 처리

### 기능 2: 재판매 가격 추천
- [ ] **[팀 협의]** `transactions` 집계용 Supabase RPC 함수 DDL 작성 (`fn_get_category_avg_price`)
- [ ] `lib/recommend/resalePriceCalculator.ts` — 순수 계산 함수 (단위 테스트 가능)
- [ ] `lib/recommend/resalePriceQueries.ts` — DB 쿼리 함수 (규칙 조회, 기준가 조회)
- [ ] `app/(features)/recommend/resale-price/page.tsx`
- [ ] `app/(features)/recommend/resale-price/_components/ResalePriceForm.tsx`
- [ ] `app/(features)/recommend/resale-price/_components/ResalePriceResult.tsx`
- [ ] 폴백 케이스 처리 (기준가 없음, 규칙 없음)

### Seed 데이터 (개발/테스트용)
- [ ] `proc/seed/package-templates-seed.sql` — 테스트용 템플릿 데이터
- [ ] `proc/seed/resale-price-rules-seed.sql` — 테스트용 감가율 규칙

## 진행 로그

### 2026-05-09
- 수행한 작업: schema.sql 전체 분석, 기능별 테이블 갭 파악, 명세 및 계획 작성
- 발생한 문제: `users.housing_type` 없음, `transactions` RLS 제약
- 해결 방법: housing_type → UI 입력 대체 / transactions → RPC 함수 방식으로 우회
- 다음 작업: 팀원과 RPC 함수 추가 합의, Supabase 클라이언트 설정 확인

## Claude 사용 기록

- 사용한 프롬프트: "schema.sql 분석 + 담당 기능 명세 및 계획 작성"
- Claude가 제안한 변경:
  - `users.housing_type` 없음 → UI 입력 대체 (schema 변경 없음)
  - `transactions` RLS → `fn_get_category_avg_price` RPC 함수 (SECURITY DEFINER)
  - 템플릿 매칭 우선순위 로직 (4단계 폴백)
- 실제 반영 여부: 명세에 반영 완료, 코드 미구현

## 변경 파일

- `proc/spec/ai-command-rules.md`: AI 행동 규칙
- `proc/spec/feature-package-recommendation.md`: 패키지 추천 명세
- `proc/spec/feature-resale-price.md`: 재판매 가격 추천 명세
- `proc/plan/2026-05-09_package-recommendation-resale-price.md`: 본 계획 문서

## 주의사항

- **건드리면 안 되는 영역**:
  - `app/(features)/products/` (상품 등록 플로우)
  - `app/(features)/transactions/` (거래 플로우)
  - `components/shared/` (공통 컴포넌트 — 수정 시 팀원 확인 필수)
  - `schema.sql` 직접 수정 금지 (변경 필요 시 `proc/spec/`에 DDL 초안 작성 후 팀 합의)

- **팀원과 확인 필요한 부분**:
  1. `fn_get_category_avg_price` RPC 함수 추가 (schema.sql에 팀원이 반영해야 함)
  2. `lib/supabase/` 클라이언트 경로·설정 (팀원 구현 완료 여부)
  3. 재판매 가격 추천 UI를 상품 등록 폼에 삽입할 경우, 해당 파일 수정 협의
  4. `app/` 디렉토리 전체 구조 합의 (폴더 컨벤션)
