# 보완 시스템 기능 상세 설계서

> 작성일: 2026-05-05
> 담당: 교환학생 파트
> 참조: exchange_student_feature_spec.md / schema.sql

---

## 목차

1. [개요](#1-개요)
2. [보완 로직 상세](#2-보완-로직-상세)
3. [화면 구성 상세](#3-화면-구성-상세)
4. [예외 처리](#4-예외-처리)
5. [데이터 예시](#5-데이터-예시)
6. [미결 사항](#6-미결-사항)

---

## 1. 개요

### 1.1 목적
셀러 패키지에 없는 물품을 바이어가 다른 방법으로 구할 수 있도록 안내.
별도 알고리즘 없이 같은 `category_id`로 기존 `products` 테이블을 조회하는 단순 구조.

### 1.2 보완 방식 요약

| 상황 | 처리 방식 |
|------|---------|
| 일반 매물 있음 | `products` 테이블에서 같은 카테고리 매물 안내 |
| 일반 매물 없음 | `exchange_wishlists` 알림 신청 유도 |

### 1.3 핵심 설계 원칙
- **DB 추가 없음** — 기존 `products` 테이블 읽기 전용으로 활용
- **다른 파트 영향 없음** — `products` 조회만 하고 수정하지 않음
- **단순하게** — 추천 알고리즘 없이 카테고리 기반 단순 조회

---

## 2. 보완 로직 상세

### 2.1 전체 흐름

```
[1] 패키지 전체 구성 물품 조회 (package_items)
      ↓
[2] 셀러 보유 물품 조회 (package_listings)
      ↓
[3] 미보유 항목 계산
      ↓
[4-A] 일반 매물 조회 (products) → 매물 있으면 안내
[4-B] 매물 없으면 → 알림 신청 유도
```

---

### 2.2 Step 1 — 패키지 전체 구성 물품 조회

```sql
SELECT
    pi.package_item_id,
    pi.category_id,
    pi.is_required,
    pi.priority_order,
    c.name AS category_name
FROM package_items pi
JOIN categories c ON c.category_id = pi.category_id
WHERE pi.package_id = :package_id
ORDER BY pi.is_required DESC, pi.priority_order ASC;
```

---

### 2.3 Step 2 — 셀러 보유 물품 조회

```sql
SELECT
    pl.category_id
FROM package_listings pl
WHERE pl.match_id = :match_id
  AND pl.status = 'selling';
```

---

### 2.4 Step 3 — 미보유 항목 계산

```
전체 package_items - 셀러 package_listings = 미보유 항목
```

```javascript
// 예시 (앱 레이어)
const allItems = [10, 11, 12, 15, 20, 21];      // package_items
const ownedItems = [10, 11, 15];                 // package_listings
const missingItems = allItems.filter(
    id => !ownedItems.includes(id)
);
// missingItems = [12, 20, 21]
```

---

### 2.5 Step 4 — 미보유 항목별 일반 매물 조회

```sql
SELECT
    p.pid,
    p.title,
    p.price,
    p.condition,
    p.status,
    p.created_at,
    u.nickname AS seller_name,
    pi.image_url AS thumbnail
FROM products p
JOIN users u ON u.uid = p.seller_uid
LEFT JOIN product_images pi
    ON pi.pid = p.pid
    AND pi.display_order = 0          -- 대표 이미지만
WHERE p.category_id = :missing_category_id
  AND p.status = 'selling'
  AND p.deleted_at IS NULL
ORDER BY p.created_at DESC
LIMIT 3;                              -- 카테고리당 최대 3개
```

---

### 2.6 정렬 기준

| 기준 | 설명 |
|------|------|
| 최신순 | `created_at DESC` — 가장 최근 등록 매물 우선 |
| 최대 3개 | 너무 많으면 바이어 혼란, 3개로 제한 |

---

## 3. 화면 구성 상세

### 3.1 패키지 상세 — 미보유 항목 보완 안내

#### 케이스 A — 일반 매물 있을 때

```
┌─────────────────────────────────────┐
│  ❌ 청소기                            │
│                                     │
│  일반 매물에서 찾았어요!              │
│  ┌───────────────────────────────┐  │
│  │ 🖼️ 다이슨 청소기 V8           │  │
│  │    35,000원 · 상태: 좋음      │  │
│  │    판매자: 이민준              │  │
│  │                  [보러가기 →] │  │
│  ├───────────────────────────────┤  │
│  │ 🖼️ 샤오미 무선 청소기         │  │
│  │    15,000원 · 상태: 보통      │  │
│  │    판매자: 김서연              │  │
│  │                  [보러가기 →] │  │
│  └───────────────────────────────┘  │
│  [더 보기 →]                         │
└─────────────────────────────────────┘
```

#### 케이스 B — 일반 매물 없을 때

```
┌─────────────────────────────────────┐
│  ❌ 빨래 건조대                       │
│                                     │
│  현재 등록된 매물이 없어요.           │
│  매물이 올라오면 알림을 받아보세요!   │
│                                     │
│  [🔔 알림 신청하기]                  │
└─────────────────────────────────────┘
```

#### 케이스 C — 알림 신청 완료

```
┌─────────────────────────────────────┐
│  ❌ 빨래 건조대                       │
│                                     │
│  현재 등록된 매물이 없어요.           │
│  매물이 올라오면 알림을 드릴게요! 🔔  │
│                           [취소하기] │
└─────────────────────────────────────┘
```

---

### 3.2 패키지 상세 — 전체 물품 체크리스트

```
┌─────────────────────────────────────┐
│  📋 물품 체크리스트                   │
│  8/10 보유 중                        │
│                                     │
│  [필수 항목]                          │
│  ✅ 이불        세탁완료 ✅           │
│  ✅ 베개        세탁완료 ✅           │
│  ✅ 토퍼        인증없음 ⚠️           │
│  ✅ 전기밥솥                          │
│  ✅ 스탠드 조명                       │
│                                     │
│  [선택 항목]                          │
│  ❌ 청소기                            │
│     다이슨 청소기 35,000원 [보러가기]  │
│  ❌ 빨래 건조대                       │
│     현재 매물 없음 [알림 신청하기 🔔]  │
│  ✅ 옷걸이 세트                       │
└─────────────────────────────────────┘
│  [거래 요청하기]                      │
└─────────────────────────────────────┘
```

### 3.3 일반 매물 상세 페이지 연결

```
패키지 상세 → [보러가기] 클릭
→ 일반 상품 상세 페이지 (/products/[pid])
→ 뒤로가기 → 패키지 상세로 복귀
```

---

## 4. 예외 처리

| 상황 | 처리 방식 | UI 표시 |
|------|----------|--------|
| 일반 매물 있음 | 최신순 최대 3개 표시 | 매물 카드 + [보러가기] |
| 일반 매물 없음 | 알림 신청 유도 | "현재 매물이 없어요" + 알림 신청 버튼 |
| 알림 신청 완료 | 신청 상태 표시 | "알림 신청됨 🔔" + 취소하기 버튼 |
| 알림 신청 취소 | `exchange_wishlists` Soft Delete | 알림 신청 버튼으로 복귀 |
| 이미 알림 신청한 물품 재신청 | UNIQUE 제약으로 차단 | "이미 알림 신청한 물품이에요" |
| 매물 조회 중 네트워크 오류 | 재시도 안내 | "불러오는 중 오류가 발생했어요. 다시 시도해주세요" |
| 셀러 패키지 전체 보유 | 보완 섹션 미노출 | (보완 섹션 없음) |

---

## 5. 데이터 예시

### 5.1 미보유 항목 계산 예시

```
패키지 전체 구성 (package_items):
  category_id: [10(이불), 11(베개), 12(토퍼), 15(전기밥솥), 20(청소기), 21(건조대)]

셀러 보유 물품 (package_listings):
  category_id: [10(이불), 11(베개), 15(전기밥솥)]

미보유 항목:
  category_id: [12(토퍼), 20(청소기), 21(건조대)]
```

### 5.2 일반 매물 조회 결과 예시

```json
// category_id: 20 (청소기) 조회 결과
[
  {
    "pid": "uuid-product-001",
    "title": "다이슨 청소기 V8",
    "price": 35000,
    "condition": "good",
    "status": "selling",
    "seller_name": "이민준",
    "thumbnail": "https://storage.supabase.co/..."
  },
  {
    "pid": "uuid-product-002",
    "title": "샤오미 무선 청소기",
    "price": 15000,
    "condition": "fair",
    "status": "selling",
    "seller_name": "김서연",
    "thumbnail": "https://storage.supabase.co/..."
  }
]
```

```json
// category_id: 21 (건조대) 조회 결과
[]  // 매물 없음 → 알림 신청 유도
```

### 5.3 알림 신청 데이터 예시

```json
{
  "exchange_wishlist_id": 50,
  "uid": "uuid-buyer-001",
  "category_id": 21,
  "region_group": "E3",
  "semester": "2026-1",
  "is_notified": false,
  "notified_at": null,
  "deleted_at": null,
  "created_at": "2026-05-05T14:00:00Z"
}
```

---

## 6. 미결 사항

| 항목 | 내용 | 확인 대상 |
|------|------|---------|
| 추천 시스템 연동 | 추천 시스템 파트와 보완 시스템 연동 여부 | 추천 시스템 파트 |
| 매물 정렬 기준 | 최신순 외 추가 정렬 기준 (가격순 등) 필요 여부 | 팀 전체 |
| 노출 개수 | 카테고리당 3개 적절한지 | 팀 전체 |
| 알림 발송 시점 | 매물 등록 즉시 vs 배치 처리 | 자산 순환 파트 |
