# 세탁 인증 기능 상세 설계서

> 작성일: 2026-05-05
> 담당: 교환학생 파트
> 참조: exchange_student_feature_spec.md / schema.sql

---

## 목차

1. [개요](#1-개요)
2. [인증 대상 물품](#2-인증-대상-물품)
3. [인증 로직 상세](#3-인증-로직-상세)
4. [인증 상태 흐름](#4-인증-상태-흐름)
5. [화면 구성 상세](#5-화면-구성-상세)
6. [예외 처리](#6-예외-처리)
7. [데이터 예시](#7-데이터-예시)
8. [미결 사항](#8-미결-사항)

---

## 1. 개요

### 1.1 목적
이불, 베개, 토퍼 등 몸에 직접 닿는 물품의 위생 상태를 확인.
셀러가 세탁 완료 사진을 업로드해야 해당 물품 패키지 게시 가능.
바이어는 세탁 인증 배지로 위생 상태 확인 후 거래 결정.

### 1.2 인증 방식 요약

| 항목 | 내용 |
|------|------|
| 인증 주체 | 셀러 (사진 업로드) |
| 인증 방식 | 세탁 완료 사진 업로드 → 관리자 검토 |
| 파일 저장 | Supabase Storage (`hygiene-certs` 버킷) |
| 허용 파일 형식 | JPG, PNG |
| 미인증 시 | 해당 물품 패키지 게시 불가 |
| 바이어 확인 방법 | 패키지 상세 화면 배지 표시 |

---

## 2. 인증 대상 물품

### 2.1 인증 필요 물품
`package_items.requires_hygiene_cert = TRUE` 인 물품

| 물품 | 이유 |
|------|------|
| 이불 | 피부 직접 접촉 |
| 베개 | 얼굴 직접 접촉 |
| 토퍼 | 피부 직접 접촉 |
| 수건 세트 | 피부 직접 접촉 |

> ⚠️ **인증 대상 물품 목록은 추후 팀 논의 후 확정**
> 위 목록은 초안이며 변경될 수 있음

### 2.2 인증 불필요 물품
`package_items.requires_hygiene_cert = FALSE` 인 물품
- 전기밥솥, 스탠드 조명, 청소기 등 피부 비접촉 물품

---

## 3. 인증 로직 상세

### 3.1 전체 흐름

```
[1] 셀러: 보유 물품 체크 중 인증 필요 물품 선택
      ↓
[2] 세탁 인증 화면으로 이동
      ↓
[3] 세탁 완료 사진 업로드
      ↓
[4] Supabase Storage 업로드
      ↓
[5] hygiene_certifications INSERT (status = 'pending')
      ↓
[6] 관리자 검토
      ↓
[7-A] 승인: status = 'approved' → 게시 가능
[7-B] 반려: status = 'rejected' → 재업로드 필요
```

---

### 3.2 Step 3 — 사진 업로드

**업로드 가이드**
```
좋은 사진 예시:
- 세탁기 안에 물품이 들어있는 사진
- 세탁 완료 후 건조 중인 사진
- 세탁 라벨이 보이는 사진

나쁜 사진 예시:
- 물품만 찍은 사진 (세탁 여부 확인 불가)
- 흐릿하거나 어두운 사진
```

**파일 제한**
```
허용 형식: JPG, PNG
최대 파일 크기: 10MB
최소 해상도: 800 x 600px
```

---

### 3.3 Step 4 — Supabase Storage 업로드

```
버킷: hygiene-certs
경로: hygiene-certs/{seller_uid}/{category_id}/{timestamp}.jpg
```

```javascript
// 업로드 예시 (Supabase 클라이언트)
const { data, error } = await supabase.storage
  .from('hygiene-certs')
  .upload(
    `${seller_uid}/${category_id}/${Date.now()}.jpg`,
    file,
    { contentType: 'image/jpeg' }
  );
```

---

### 3.4 Step 5 — DB INSERT

```sql
INSERT INTO hygiene_certifications (
    seller_uid,
    category_id,
    image_url,
    status
)
VALUES (
    :seller_uid,
    :category_id,
    :storage_url,
    'pending'
)
ON CONFLICT DO NOTHING;
```

---

### 3.5 Step 6 — 관리자 검토

> ⚠️ **관리자 검토 UI는 현재 구현 범위 외**
> 초기에는 Supabase 대시보드에서 직접 status 변경으로 처리

```sql
-- 관리자: 승인 처리
UPDATE hygiene_certifications
SET status = 'approved',
    reviewed_at = NOW(),
    updated_at = NOW()
WHERE cert_id = :cert_id;

-- 관리자: 반려 처리
UPDATE hygiene_certifications
SET status = 'rejected',
    reviewed_at = NOW(),
    updated_at = NOW()
WHERE cert_id = :cert_id;
```

---

### 3.6 Step 7 — 게시 가능 여부 확인

```sql
-- 패키지 게시 전 인증 완료 여부 확인
SELECT
    pi.category_id,
    pi.requires_hygiene_cert,
    hc.status AS cert_status
FROM package_items pi
LEFT JOIN hygiene_certifications hc
    ON hc.category_id = pi.category_id
    AND hc.seller_uid = :seller_uid
    AND hc.status = 'approved'
WHERE pi.package_id = :package_id
  AND pi.requires_hygiene_cert = TRUE;

-- 모든 인증 필요 물품의 cert_status = 'approved' 일 때만 게시 가능
```

---

## 4. 인증 상태 흐름

```
사진 업로드
    ↓
 pending
 (검토 대기)
  ↓        ↓
approved  rejected
(게시 가능) (재업로드 필요)
              ↓
           pending
           (재검토)
```

### 4.1 상태별 정의

| 상태 | 설명 | UI 표시 |
|------|------|--------|
| `pending` | 사진 업로드 완료, 검토 대기 | "검토 중 ⏳" |
| `approved` | 관리자 승인 완료 | "세탁완료 ✅" |
| `rejected` | 관리자 반려 | "인증 반려됨 ❌ — 재업로드 필요" |

### 4.2 인증 상태별 게시 가능 여부

| 인증 상태 | 게시 가능 여부 |
|----------|-------------|
| 업로드 전 | ❌ 불가 |
| `pending` | ❌ 불가 (검토 완료 대기) |
| `approved` | ✅ 가능 |
| `rejected` | ❌ 불가 (재업로드 필요) |

---

## 5. 화면 구성 상세

### 5.1 셀러 — 세탁 인증 화면 (/sell/hygiene)

```
┌─────────────────────────────────────┐
│  ← 세탁 인증                          │
├─────────────────────────────────────┤
│  이불, 베개, 토퍼는 세탁 완료 사진     │
│  업로드가 필수예요.                   │
├─────────────────────────────────────┤
│  [이불]                              │
│  ┌──────────┐                       │
│  │  사진    │  세탁완료 ✅            │  ← approved
│  │ 썸네일   │                       │
│  └──────────┘                       │
├─────────────────────────────────────┤
│  [베개]                              │
│  ┌──────────┐                       │
│  │  사진    │  검토 중 ⏳             │  ← pending
│  │ 썸네일   │                       │
│  └──────────┘                       │
├─────────────────────────────────────┤
│  [토퍼]                              │
│  인증 반려됨 ❌                       │  ← rejected
│  "사진이 흐릿해요. 다시 업로드해주세요" │
│  [재업로드]                          │
├─────────────────────────────────────┤
│  [수건 세트]                          │
│  [사진 업로드]                        │  ← 미업로드
└─────────────────────────────────────┘
│  [등록으로 돌아가기]                   │
│  (미승인 항목 있음: 2개)              │
└─────────────────────────────────────┘
```

### 5.2 셀러 — 사진 업로드 가이드 모달

```
┌─────────────────────────────────────┐
│  세탁 완료 사진 업로드                 │
│                                     │
│  📷 좋은 사진 예시                    │
│  • 세탁기 안에 넣은 사진              │
│  • 건조 중인 사진                    │
│                                     │
│  ❌ 나쁜 사진 예시                    │
│  • 물품만 찍은 사진                  │
│  • 흐릿하거나 어두운 사진             │
│                                     │
│  허용 형식: JPG, PNG / 최대 10MB     │
│                                     │
│  [갤러리에서 선택]  [카메라로 촬영]   │
└─────────────────────────────────────┘
```

### 5.3 바이어 — 패키지 상세 인증 배지

```
┌─────────────────────────────────────┐
│  📋 물품 체크리스트                   │
│                                     │
│  [필수 항목]                          │
│  ✅ 이불      세탁완료 ✅             │  ← approved
│  ✅ 베개      검토 중 ⏳              │  ← pending
│  ✅ 토퍼      인증없음 ⚠️            │  ← 미인증
│  ✅ 전기밥솥  (인증 불필요)           │
│  ✅ 스탠드 조명 (인증 불필요)          │
└─────────────────────────────────────┘
```

### 5.4 바이어 — 배지별 안내 문구

| 배지 | 안내 문구 |
|------|---------|
| 세탁완료 ✅ | "세탁 완료가 확인된 물품이에요" |
| 검토 중 ⏳ | "현재 세탁 인증을 검토 중이에요" |
| 인증없음 ⚠️ | "세탁 인증이 없는 물품이에요. 거래 전 확인해보세요" |

---

## 6. 예외 처리

| 상황 | 처리 방식 | UI 표시 |
|------|----------|--------|
| 미인증 상태로 게시 시도 | 게시하기 버튼 비활성 | "세탁 인증이 완료되지 않은 항목이 있어요" |
| 업로드 실패 (네트워크 오류) | 재시도 안내 | "업로드에 실패했어요. 다시 시도해주세요" 토스트 |
| 지원하지 않는 파일 형식 | 업로드 차단 | "JPG, PNG 파일만 업로드 가능해요" |
| 파일 크기 초과 (10MB 이상) | 업로드 차단 | "파일 크기가 너무 커요. 10MB 이하로 업로드해주세요" |
| 반려 후 재업로드 | 기존 인증 덮어쓰기 | status = 'pending' 으로 재설정 |
| pending 상태에서 재업로드 시도 | 허용 | 기존 사진 교체 + status = 'pending' 유지 |
| approved 상태에서 재업로드 시도 | 허용 | "이미 인증된 물품이에요. 재업로드 시 재검토가 필요해요" 안내 |

---

## 7. 데이터 예시

### 7.1 hygiene_certifications 예시

```json
[
  {
    "cert_id": 1,
    "seller_uid": "uuid-seller-001",
    "category_id": 10,
    "image_url": "https://storage.supabase.co/hygiene-certs/uuid-seller-001/10/1746000000000.jpg",
    "status": "approved",
    "reviewed_at": "2026-05-04T10:00:00Z",
    "created_at": "2026-05-03T09:00:00Z"
  },
  {
    "cert_id": 2,
    "seller_uid": "uuid-seller-001",
    "category_id": 11,
    "image_url": "https://storage.supabase.co/hygiene-certs/uuid-seller-001/11/1746000001000.jpg",
    "status": "pending",
    "reviewed_at": null,
    "created_at": "2026-05-03T09:01:00Z"
  },
  {
    "cert_id": 3,
    "seller_uid": "uuid-seller-001",
    "category_id": 12,
    "image_url": "https://storage.supabase.co/hygiene-certs/uuid-seller-001/12/1746000002000.jpg",
    "status": "rejected",
    "reviewed_at": "2026-05-04T10:05:00Z",
    "created_at": "2026-05-03T09:02:00Z"
  }
]
```

### 7.2 게시 가능 여부 쿼리 결과 예시

```json
[
  { "category_id": 10, "requires_hygiene_cert": true,  "cert_status": "approved"  },
  { "category_id": 11, "requires_hygiene_cert": true,  "cert_status": null        },
  { "category_id": 12, "requires_hygiene_cert": true,  "cert_status": "rejected"  },
  { "category_id": 15, "requires_hygiene_cert": false, "cert_status": null        }
]
```

```
→ category_id 11, 12 미승인
→ 게시 불가
```

### 7.3 Supabase Storage 구조

```
hygiene-certs/
├── uuid-seller-001/
│   ├── 10/          ← 이불 (category_id: 10)
│   │   └── 1746000000000.jpg
│   ├── 11/          ← 베개 (category_id: 11)
│   │   └── 1746000001000.jpg
│   └── 12/          ← 토퍼 (category_id: 12)
│       └── 1746000002000.jpg
└── uuid-seller-002/
    └── 10/
        └── 1746000003000.jpg
```

---

## 8. 미결 사항

| 항목 | 내용 | 확인 대상 |
|------|------|---------|
| 인증 대상 물품 목록 | 이불/베개/토퍼/수건 외 추가 여부 | 팀 전체 |
| 관리자 검토 UI | Supabase 대시보드 직접 처리 vs 별도 관리자 화면 | 팀 전체 |
| 검토 소요 시간 | 얼마나 빠르게 검토할지 | 팀 전체 |
| 반려 사유 전달 방식 | 텍스트로만 vs 상세 사유 선택 | 팀 전체 |
| approved 상태 재업로드 허용 여부 | 현재는 허용으로 설계 | 팀 전체 |
