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
