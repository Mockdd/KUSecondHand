# KUSecondHand 검색 시스템 설계서

작성일: 2026-05-11
담당: exchange-student 개발자
상태: 설계 확정 (개발 미시작)

---

## 1. 현황 확인

| 항목 | 상태 |
|---|---|
| `/search` 페이지 | 없음 — 신규 생성 필요 |
| 검색 API | 없음 — 신규 생성 필요 |
| `/products` 페이지 | 단순 목록만 (검색 UI 없음) |
| 로그인 강제 | proxy.ts에 로직 있으나 미활성 (D1). 설계는 "로그인 필수" 전제로 진행 |

---

## 2. 요구사항

| # | 요구사항 |
|---|---|
| R1 | 오타 허용 검색 (삼성 갤럭씨 → 삼성 갤럭시) |
| R2 | Semantic search — 의미 기반 매칭 (노트북 → laptop) |
| R3 | 다국어 — 한국어 쿼리로 영어 매물 매칭, 반대도 동일 |
| R4 | 응답 지연 없음 — 검색 시 API 호출 최소화 |
| R5 | 일반 유저: 매물(products) 검색만 |
| R6 | 교환학생: 매물(products) + 패키지(essential_packages) 탭 검색 |
| R7 | V1은 텍스트 검색. 카테고리 필터는 V2 |

---

## 3. 전체 아키텍처

### 핵심 기술 스택

```
오타 허용    │ pg_trgm (Supabase 내장)
Semantic    │ pgvector + OpenAI text-embedding-3-small
다국어      │ OpenAI embedding이 자연스럽게 처리 (별도 번역 불필요)
결과 통합   │ RRF (Reciprocal Rank Fusion)
```

### 왜 외부 검색 서비스(Algolia 등)가 아닌가

- Supabase에 pgvector, pg_trgm 이미 내장 → 추가 인프라 없음
- 다국어 semantic은 OpenAI embedding이 충분히 처리
- 비용: text-embedding-3-small = $0.02/1M tokens (매물 1만 개 ≈ 무료 수준)

### Hybrid Search 흐름

```
쿼리 입력
  ↓
[클라이언트] debounce 300ms
  ↓
GET /api/search/products?q=노트북
  ↓
[서버] OpenAI embedding 생성 (쿼리 1회)
  ↓
[DB] ① pgvector cosine similarity (semantic, top 50)
     ② pg_trgm similarity (fuzzy, top 50)
  ↓
[서버] RRF 점수 계산 → top 20 반환
  ↓
결과 렌더링
```

---

## 4. Embedding 생성 전략

### products — 매물 등록 시 동기 생성

```
POST /api/products (매물 등록)
  → title + description 문자열 조합
  → OpenAI embedding 생성 (~200-400ms)
  → product_embeddings 테이블에 저장
  → 등록 완료 응답
```

**선택 이유:**
- 검색 응답 시간에 영향 없음 (검색 시 embedding 생성 불필요)
- 등록 시 추가 200-400ms는 이미지 업로드와 합쳐져 체감 미미
- 백그라운드 처리 대비 구현 단순

**업데이트 시:** 매물 수정 → embedding 재생성 (동일 흐름)

### essential_packages — 마이그레이션 시 일괄 생성

- 패키지는 고정 마스터 데이터 (수십 개 수준, 자주 추가 안 됨)
- migration 006 실행 시 기존 패키지 전체 embedding 일괄 생성
- 신규 패키지 추가 시: 관리자가 수동으로 embedding 생성 (빈도 낮음)

---

## 5. Schema 변경 — migration 008

### 추가할 것

```sql
-- 1. 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. 매물 embedding 테이블
CREATE TABLE product_embeddings (
    pid          UUID        NOT NULL PRIMARY KEY,
    embedding    vector(1536) NOT NULL,
    embedded_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_product_embeddings_pid
        FOREIGN KEY (pid) REFERENCES products(pid) ON DELETE CASCADE
);

-- 3. 패키지 embedding 테이블
CREATE TABLE package_embeddings (
    package_id   INTEGER      NOT NULL PRIMARY KEY,
    embedding    vector(1536) NOT NULL,
    embedded_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_package_embeddings_id
        FOREIGN KEY (package_id) REFERENCES essential_packages(package_id) ON DELETE CASCADE
);

-- 4. pgvector IVFFlat 인덱스 (빠른 ANN 검색)
CREATE INDEX idx_product_embeddings_vec
    ON product_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_package_embeddings_vec
    ON package_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- 5. pg_trgm 인덱스 (fuzzy 검색)
CREATE INDEX idx_products_trgm
    ON products USING gin ((title || ' ' || COALESCE(description, '')) gin_trgm_ops);

CREATE INDEX idx_packages_trgm
    ON essential_packages USING gin ((name_ko || ' ' || name_en) gin_trgm_ops);
```

### embedding 테이블을 products에 컬럼으로 넣지 않는 이유

- products 테이블 row 크기 급증 방지 (vector(1536) = 6KB)
- embedding 없는 기존 매물과 NULL 컬럼 혼재 방지
- JOIN으로 필요할 때만 가져오는 게 깔끔

---

## 6. API 설계

### 6-1. 매물 검색 — `GET /api/search/products`

**Request**
```
GET /api/search/products?q=노트북&limit=20
```

| 파라미터 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `q` | string | 필수 | 검색어 |
| `limit` | number | 20 | 결과 수 |

**Response**
```json
{
  "data": [
    {
      "pid": "uuid",
      "title": "삼성 노트북",
      "price": 300000,
      "condition": "good",
      "category_id": 3,
      "seller": { "uid": "...", "nickname": "..." },
      "product_images": [{ "image_url": "..." }],
      "rrf_score": 0.032
    }
  ],
  "query": "노트북"
}
```

**내부 SQL (Hybrid Search + RRF)**
```sql
WITH semantic AS (
  SELECT pe.pid,
         ROW_NUMBER() OVER (ORDER BY pe.embedding <=> $1) AS rank
  FROM product_embeddings pe
  JOIN products p ON p.pid = pe.pid
  WHERE p.deleted_at IS NULL AND p.status = 'selling'
  ORDER BY pe.embedding <=> $1
  LIMIT 50
),
fuzzy AS (
  SELECT p.pid,
         ROW_NUMBER() OVER (ORDER BY similarity(p.title || ' ' || COALESCE(p.description,''), $2) DESC) AS rank
  FROM products p
  WHERE p.deleted_at IS NULL AND p.status = 'selling'
    AND (p.title || ' ' || COALESCE(p.description,'')) % $2
  ORDER BY similarity(p.title || ' ' || COALESCE(p.description,''), $2) DESC
  LIMIT 50
),
rrf AS (
  SELECT COALESCE(s.pid, f.pid) AS pid,
         COALESCE(1.0/(60 + s.rank), 0) + COALESCE(1.0/(60 + f.rank), 0) AS score
  FROM semantic s
  FULL OUTER JOIN fuzzy f ON s.pid = f.pid
  ORDER BY score DESC
  LIMIT $3
)
SELECT p.pid, p.title, p.price, p.condition, p.category_id, rrf.score, ...
FROM rrf JOIN products p ON rrf.pid = p.pid
ORDER BY rrf.score DESC
```

> `$1` = query embedding (vector), `$2` = query string, `$3` = limit

### 6-2. 패키지 검색 — `GET /api/search/packages`

**Request**
```
GET /api/search/packages?q=kitchen&limit=10
```

**Response**
```json
{
  "data": [
    {
      "package_id": 1,
      "template_type": "DORM_BASIC",
      "name_ko": "기숙사 기본 패키지",
      "name_en": "Dormitory Basic Package",
      "housing_type": "dorm",
      "rrf_score": 0.028
    }
  ],
  "query": "kitchen"
}
```

패키지는 row 수가 적으므로 fuzzy + semantic 동일 방식 적용 (규모가 작아 LIMIT 값 조정).

---

## 7. 페이지 설계

### 7-1. 일반 유저 — `(main)/search/page.tsx`

```
URL: /search?q=노트북
```

**UI 구성**
```
┌─────────────────────────────────┐
│  [검색창 🔍]  "노트북"           │  ← 입력 즉시 URL 업데이트 (debounce 300ms)
└─────────────────────────────────┘
  결과 20개
  ┌──────────────────────────────┐
  │ [이미지] 삼성 갤럭시 북       │
  │          300,000원  · 상태 양호│
  │          판매자: 홍길동        │
  └──────────────────────────────┘
  ...
```

- 쿼리 없을 때: 빈 상태 (검색어를 입력하세요)
- 결과 없을 때: "검색 결과가 없어요" (유사 결과 안내 없음 — V1)
- 결과 클릭 → `/products/[pid]`

**구현 포인트**
- `useSearchParams` + `useRouter`로 URL 동기화
- `useQuery` (react-query) — 쿼리 키 `['search', 'products', q]`
- 300ms debounce 후 API 호출

### 7-2. 교환학생 — `(exchange)/search/page.tsx`

```
URL: /search?q=kitchen&tab=products
```

**UI 구성**
```
┌─────────────────────────────────┐
│  [검색창 🔍]  "kitchen"          │
└─────────────────────────────────┘
  [매물] [패키지]   ← 탭
  ─────────────────
  매물 탭 결과 (products)
  ┌──────────────────────────────┐
  │ [이미지] Kitchen knife set   │
  │          15,000원  · 거의 새것│
  └──────────────────────────────┘

  패키지 탭 결과 (essential_packages)
  ┌──────────────────────────────┐
  │  기숙사 기본 패키지           │
  │  Dormitory Basic Package     │
  └──────────────────────────────┘
```

- 탭 전환 시 이미 받은 결과 재사용 (별도 API 호출 없음 — 두 탭 동시 fetch)
- 매물 클릭 → `/products/[pid]`
- 패키지 클릭 → `/packages/[id]`

---

## 8. 환경변수 추가

`.env.local` 및 `.env.example`에 추가 필요:

```
OPENAI_API_KEY=<openai-secret-key>
```

서버 전용 (`NEXT_PUBLIC_` 접두사 없음 — 클라이언트 노출 금지).

---

## 9. 신규 파일 목록

| 파일 | 설명 |
|---|---|
| `db/migrations/008_search_embeddings.sql` | pgvector, pg_trgm, embedding 테이블, 인덱스 |
| `src/app/api/search/products/route.ts` | 매물 hybrid search API |
| `src/app/api/search/packages/route.ts` | 패키지 hybrid search API |
| `src/app/(main)/search/page.tsx` | 일반 유저 검색 페이지 |
| `src/app/(exchange)/search/page.tsx` | 교환학생 검색 페이지 (탭) |
| `src/lib/openai/embeddings.ts` | OpenAI embedding 생성 유틸 |
| `src/lib/search/hybridSearch.ts` | RRF 계산 + DB 쿼리 로직 |

기존 수정:
| 파일 | 수정 내용 |
|---|---|
| `src/app/api/products/route.ts` | POST 핸들러에 embedding 생성 추가 |
| `.env.example` | `OPENAI_API_KEY` 항목 추가 |
| `src/app/(main)/layout.tsx` | 네비에 검색 링크 추가 |
| `src/app/(exchange)/layout.tsx` | 하단 네비에 검색 탭 추가 |

---

## 10. 구현 순서

| 단계 | 작업 | 비고 |
|---|---|---|
| 1 | migration 008 작성 + Supabase 적용 (007 price와 동시 실행) | pgvector 활성화 필요 |
| 2 | `src/lib/openai/embeddings.ts` 작성 | OpenAI SDK 설치 포함 |
| 3 | `src/lib/search/hybridSearch.ts` 작성 | RRF SQL |
| 4 | `POST /api/products` embedding 생성 연결 | 기존 route.ts 수정 |
| 5 | `GET /api/search/products` 작성 | 검색 API |
| 6 | `GET /api/search/packages` 작성 | 검색 API |
| 7 | `(main)/search/page.tsx` 작성 | 일반 검색 UI |
| 8 | `(exchange)/search/page.tsx` 작성 | 교환학생 탭 검색 UI |
| 9 | 네비게이션 검색 링크 추가 | layout.tsx 2개 |
| 10 | 기존 매물 embedding 일괄 생성 스크립트 | 기존 products 처리 |

---

## 11. 미결 / 추후 결정 (V2)

| # | 항목 |
|---|---|
| V2-1 | 카테고리 필터 (`?category_id=3`) |
| V2-2 | 가격 범위 필터 |
| V2-3 | 검색 결과 무한 스크롤 (V1은 20개 고정) |
| V2-4 | 검색어 자동완성 |
| V2-5 | 기존 매물 embedding 재생성 정책 (매물 수정 시 자동 처리 제외한 나머지) |
