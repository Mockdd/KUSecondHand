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
