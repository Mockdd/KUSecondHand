# AI 명령지침 — 패키지 추천 & 재판매 가격 추천 기능

## 담당 범위

이 명세는 `ku-secondhand` 프로젝트에서 **아래 두 기능만** 다룬다.

1. **사용자 조건 기반 패키지 추천** (`/recommend/package`)
2. **재판매 가격 추천** (`/recommend/resale-price` 또는 상품 등록 흐름 내 삽입 UI)

## 핵심 행동 규칙

- 기존 `products`, `transactions`, `users`, `categories` 테이블은 **읽기 전용**으로만 사용한다. INSERT/UPDATE/DELETE 하지 않는다.
- `schema.sql`에 이미 존재하는 테이블 구조를 변경하지 않는다.
- 새 테이블이 필요하면 `proc/spec/`에 DDL 초안을 작성한 뒤 팀원과 합의 후 `schema.sql`에 반영한다.
- 상품 등록 플로우, 거래 완료 플로우, 인증 플로우는 건드리지 않는다.
- 파일 위치는 `app/(features)/recommend/` 하위에서만 작업한다.
- 공통 컴포넌트(`components/shared/`), Supabase 클라이언트(`lib/supabase/`)는 읽기만 하고 수정 전 팀원과 확인한다.
- TypeScript strict mode를 유지한다. `any` 타입 사용 금지.
- 서버 컴포넌트(RSC)와 클라이언트 컴포넌트('use client')를 명확히 분리한다.
- Supabase RLS가 이미 설정된 테이블은 별도 필터 없이 RLS를 신뢰한다.

## 배포/테스트 정책

- 실제 코드 수정 전 반드시 `proc/spec/`의 명세를 확인한다.
- `proc/plan/`의 작업 항목 체크리스트를 기준으로 진행 상황을 추적한다.
- 변경 파일은 담당 범위(`app/(features)/recommend/`) 내로 제한한다.





# 기능 명세: 사용자 조건 기반 패키지 추천

## 제품 정의

### Problem Statement
대학 신입생·재학생이 학기 초 필요한 물품을 하나씩 검색해 구매해야 하는 비효율이 존재한다.
학과·학년·거주 형태에 따라 필요한 물품이 다르지만, 기존 중고거래 플랫폼은 개별 검색만 지원한다.

### Product Goal
사용자 조건(학과, 학년, 거주 형태, 학기)을 바탕으로 필요한 물품 카테고리를 자동으로 묶어 제안함으로써,
한 화면에서 필요한 물품을 한눈에 파악하고 바로 검색·거래로 이어질 수 있게 한다.

### Persona
- **일반 재학생**: 학기 초 필요한 물품을 빠르게 파악하고 싶은 사용자
- **신입생**: 대학 생활에 무엇이 필요한지 모르는 사용자

---

## 핵심 기능 정의

### MoSCoW

| 분류 | 기능 |
|------|------|
| Must | 학과·학년 기반 템플릿 조회 (`package_templates`) |
| Must | 템플릿 구성 카테고리 조회 (`package_template_items`) |
| Must | 카테고리별 판매 중 상품 목록 조회 (`products`) |
| Must | 여러 카테고리 상품을 하나의 패키지 UI로 묶어 표시 |
| Should | 거주 형태(dorm/flat) 필터 적용 |
| Should | 상품 없는 카테고리 표시 ("아직 매물이 없어요") |
| Could | 패키지 전체 예상 비용 합계 표시 |
| Won't | 패키지를 DB에 직접 저장 (추천 단계에서만 조합) |
| Won't | 판매자의 상품 등록 방식 변경 |

### Sitemap

```
/recommend
  /package            ← 추천 결과 페이지 (조건 입력 포함)
```

### Screen Spec

| 영역 | 구성요소 | 설명 |
|------|----------|------|
| 조건 입력 폼 | major, grade (users에서 자동), housing_type 선택 | housing_type은 UI 입력 (dorm/flat) |
| 패키지 헤더 | 템플릿 title + description | package_templates에서 조회 |
| 카테고리 섹션 | 카테고리명 + 상품 카드 리스트 | package_template_items → products 순으로 조회 |
| 상품 카드 | 이미지, 제목, 가격, 상태 | products + product_images |
| 빈 카테고리 | "아직 매물이 없어요" 안내 | 상품 0건인 카테고리 처리 |

---

## 사용자 경험 설계

### 사용 시나리오

1. 사용자가 `/recommend/package` 진입
2. 사용자 프로필에서 `major_id`, `grade` 자동 로드
3. `housing_type` 선택 (dorm / flat / 미선택)
4. 현재 날짜 기반으로 `semester` 파생 (예: 5~8월 → '2026-1')
5. 조건에 맞는 `package_templates` 조회 → 매칭 우선순위: (major+grade+housing) > (major+grade) > (major) > (기본)
6. 해당 템플릿의 `package_template_items` 조회 (priority_order 순)
7. 각 `category_id`로 `products` (status='selling') 조회
8. 카테고리별로 묶어 화면 렌더링

### 템플릿 매칭 우선순위 로직

```
1순위: major_id = 사용자.major_id AND grade = 사용자.grade AND housing_type = 입력값 AND semester = 현재학기
2순위: major_id = 사용자.major_id AND grade = 사용자.grade AND housing_type IS NULL
3순위: major_id IS NULL AND housing_type = 입력값
4순위: major_id IS NULL AND housing_type IS NULL  ← 전체 기본 템플릿
```

매칭되는 템플릿이 없으면 "조건에 맞는 패키지가 없어요" 안내.

### RBAC

| 역할 | 접근 |
|------|------|
| 로그인 사용자 | 패키지 추천 조회 가능 (RLS: authenticated) |
| 비로그인 | 접근 불가 (로그인 유도) |

---

## 운영 로직 및 비즈니스 정책

### 핵심 쿼리 흐름

```sql
-- 1. 템플릿 조회 (우선순위 매칭)
SELECT * FROM package_templates
WHERE (major_id = $major_id OR major_id IS NULL)
  AND (grade = $grade OR grade IS NULL)
  AND (housing_type = $housing_type OR housing_type IS NULL)
  AND (semester = $semester OR semester IS NULL)
ORDER BY
  (major_id IS NOT NULL)::int DESC,
  (grade IS NOT NULL)::int DESC,
  (housing_type IS NOT NULL)::int DESC,
  (semester IS NOT NULL)::int DESC
LIMIT 1;

-- 2. 템플릿 구성 카테고리 조회
SELECT pti.category_id, pti.required_quantity, pti.priority_order, c.name
FROM package_template_items pti
JOIN categories c ON c.category_id = pti.category_id
WHERE pti.package_template_id = $template_id
ORDER BY pti.priority_order;

-- 3. 카테고리별 판매 중 상품 조회
SELECT p.pid, p.title, p.price, p.condition, pi.image_url
FROM products p
LEFT JOIN product_images pi ON pi.pid = p.pid AND pi.display_order = 0
WHERE p.category_id = $category_id
  AND p.status = 'selling'
  AND p.deleted_at IS NULL
ORDER BY p.created_at DESC
LIMIT 5;
```

### 사용 테이블 (읽기 전용)

| 테이블 | 용도 | 권한 |
|--------|------|------|
| `users` | major_id, grade 조회 | SELECT (본인) |
| `package_templates` | 조건 매칭 템플릿 | SELECT (공개) |
| `package_template_items` | 카테고리 목록 | SELECT (공개) |
| `categories` | 카테고리명 | SELECT (공개) |
| `products` | 판매 중 상품 | SELECT (공개) |
| `product_images` | 대표 이미지 | SELECT (공개) |

### Schema 갭 및 처리 방안

| 갭 | 처리 방안 |
|----|----------|
| `users.housing_type` 없음 | UI에서 사용자가 직접 선택 (저장 안 함) |
| `users.semester` 없음 | 앱 레이어에서 현재 날짜 기반 파생 함수로 계산 |

---

## 기술 환경

- **위치**: `app/(features)/recommend/package/`
- **데이터 패칭**: Supabase JS SDK + TanStack Query (서버 컴포넌트 초기 fetch → 클라이언트 refetch)
- **상태 관리**: housing_type 선택값은 로컬 상태 (useState), 전역 불필요
- **타입**: 별도 `types/recommend.ts` 정의

---

## 단계별 개발 로드맵

| Phase | 내용 | 완료 기준 |
|-------|------|----------|
| 1 | DB 쿼리 함수 작성 + 타입 정의 | TypeScript 컴파일 오류 없음 |
| 2 | 패키지 추천 페이지 UI 구현 | housing_type 선택 → 결과 렌더링 |
| 3 | 빈 상태 처리 (템플릿 없음, 상품 없음) | 모든 케이스 UI 존재 |
| 4 | 로그인 게이트 처리 | 비로그인 시 리다이렉트 |







# 기능 명세: 재판매 가격 추천

## 제품 정의

### Problem Statement
중고 물품을 재판매하려는 사용자가 적정 가격을 몰라 너무 높거나 낮은 가격에 등록하는 문제.
상품 상태, 사용 기간, 카테고리를 고려한 합리적인 추천 가격이 없다.

### Product Goal
상품 상태(condition), 사용 기간(usage_months), 카테고리를 입력받아
기존 거래 데이터(`transactions.agreed_price`)와 감가율 규칙(`resale_price_rules`)을 조합해
적정 재판매 가격 범위를 제안한다.

### Persona
- **재판매 등록자**: 물품을 재판매하려는 사용자. 가격 책정에 자신 없음.

---

## 핵심 기능 정의

### MoSCoW

| 분류 | 기능 |
|------|------|
| Must | category_id + condition + usage_months → 매칭 규칙 조회 (`resale_price_rules`) |
| Must | 해당 카테고리 기존 완료 거래 평균가 조회 (`transactions`) |
| Must | 추천 가격 = 기준가 × (1 - depreciation_rate), 상/하한 클램핑 |
| Must | 추천 가격 범위(min~max) 화면 표시 |
| Should | 기준가로 사용할 거래 건수 표시 ("최근 N건 거래 기준") |
| Should | 규칙 없을 때 폴백 처리 (기본 감가율 20% 등) |
| Could | 추천 가격 1-click 적용 (가격 입력란에 자동 입력) |
| Won't | 결제·거래 완료 로직 |
| Won't | 상품 등록 전체 플로우 신규 구현 |

### Sitemap

```
/recommend
  /resale-price       ← 독립 계산기 페이지
  
또는

상품 등록 페이지 내 ← 팀원이 구현한 폼에 삽입될 수 있음 (팀 협의 필요)
```

### Screen Spec

| 영역 | 구성요소 | 설명 |
|------|----------|------|
| 입력 폼 | category_id 선택, condition 선택, usage_months 입력 | |
| 기준가 정보 | "해당 카테고리 최근 N건 평균 거래가: OOO원" | transactions 쿼리 결과 |
| 추천 가격 표시 | "추천 가격: OOO원 ~ OOO원" | min/max 범위 |
| 적용 감가율 | "감가율 XX% 적용" | depreciation_rate 시각화 |
| 기준가 없을 때 | "거래 데이터가 부족해 정확한 추천이 어렵습니다" | 폴백 안내 |

---

## 사용자 경험 설계

### 사용 시나리오

1. 사용자가 재판매 가격 추천 UI 진입 (독립 페이지 또는 등록 폼 내 버튼)
2. `category_id` 선택 (카테고리 드롭다운)
3. `condition` 선택 (new / like_new / good / fair / poor)
4. `usage_months` 입력 (숫자 입력, 0 이상)
5. "추천 가격 계산" 실행
6. 결과 표시

### 계산 로직

```
기준가 = AVG(transactions.agreed_price)
          WHERE products.category_id = 입력값
            AND transactions.status = 'completed'
          최근 완료 거래 기준 (LIMIT 20, ORDER BY completed_at DESC)

매칭 규칙 = resale_price_rules
          WHERE (category_id = 입력값 OR category_id IS NULL)
            AND (condition = 입력값 OR condition IS NULL)
            AND usage_months_min <= 입력값
            AND (usage_months_max IS NULL OR usage_months_max >= 입력값)
          ORDER BY
            (category_id IS NOT NULL)::int DESC,
            (condition IS NOT NULL)::int DESC
          LIMIT 1

추천 가격 = 기준가 × (1 - depreciation_rate)
min 추천가 = 기준가 × min_price_ratio
max 추천가 = 기준가 × max_price_ratio

최종 추천가 = CLAMP(추천 가격, min 추천가, max 추천가)
```

**폴백 (기준가 없을 때)**:
- 기준가 = NULL → 추천 불가 안내 표시, 사용자가 직접 입력
- 매칭 규칙 없을 때 → 기본 규칙(category_id IS NULL AND condition IS NULL) 사용

### RBAC

| 역할 | 접근 |
|------|------|
| 로그인 사용자 | 가격 추천 기능 전체 사용 가능 |
| 비로그인 | 접근 불가 (로그인 유도) |

---

## 운영 로직 및 비즈니스 정책

### 핵심 쿼리

```sql
-- 1. 기준가 조회 (카테고리 기반 최근 거래 평균)
SELECT
    AVG(t.agreed_price)::INTEGER AS avg_price,
    COUNT(*)                     AS transaction_count
FROM transactions t
JOIN products p ON p.pid = t.pid
WHERE p.category_id = $category_id
  AND t.status = 'completed'
ORDER BY t.completed_at DESC
LIMIT 20;

-- 2. 감가율 규칙 조회 (구체적 → 일반 순)
SELECT
    rule_id,
    depreciation_rate,
    min_price_ratio,
    max_price_ratio
FROM resale_price_rules
WHERE (category_id = $category_id OR category_id IS NULL)
  AND (condition = $condition OR condition IS NULL)
  AND usage_months_min <= $usage_months
  AND (usage_months_max IS NULL OR usage_months_max >= $usage_months)
ORDER BY
    (category_id IS NOT NULL)::int DESC,
    (condition IS NOT NULL)::int DESC
LIMIT 1;
```

### 사용 테이블 (읽기 전용)

| 테이블 | 용도 | 권한 |
|--------|------|------|
| `resale_price_rules` | 감가율 규칙 조회 | SELECT (공개) |
| `transactions` | 기준가 계산 | SELECT (당사자만 — RLS 주의) |
| `products` | category_id 조인 | SELECT (공개) |
| `categories` | 카테고리 선택 드롭다운 | SELECT (공개) |

### RLS 주의사항

`transactions` 테이블은 RLS가 "구매자 또는 판매자만 읽기"로 설정되어 있다.
전체 카테고리 거래 평균을 구하려면 **서버 사이드 (service_role 키)로 집계**하거나,
**Supabase Edge Function**을 사용해야 한다.

→ 팀원과 사전 협의 필요. 구현 방안:
1. **Supabase RPC 함수** (`SECURITY DEFINER`)로 집계 로직 래핑 (권장)
2. **Route Handler** (`app/api/`) 내에서 service_role 키 사용

---

## 기술 환경

- **위치**: `app/(features)/recommend/resale-price/`
- **계산 로직**: `lib/recommend/resalePriceCalculator.ts` (순수 함수, 테스트 가능)
- **DB 쿼리**: Supabase RPC 또는 Route Handler
- **타입**: `types/recommend.ts`에 `ResalePriceInput`, `ResalePriceResult` 정의

---

## 단계별 개발 로드맵

| Phase | 내용 | 완료 기준 |
|-------|------|----------|
| 1 | 계산 순수 함수 작성 + 단위 테스트 | 다양한 케이스에서 올바른 값 계산 |
| 2 | DB 쿼리 함수 작성 (RPC or Route Handler) | transactions RLS 이슈 해결 |
| 3 | 재판매 가격 추천 UI 구현 | 입력 → 계산 → 결과 표시 |
| 4 | 폴백 케이스 처리 | 기준가 없음/규칙 없음 모두 처리 |
| 5 | (선택) 상품 등록 폼 연동 | 팀원과 협의 후 |
