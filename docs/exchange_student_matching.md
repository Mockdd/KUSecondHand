# 자동 매칭 기능 상세 설계서

> 작성일: 2026-05-05
> 담당: 교환학생 파트
> 참조: exchange_student_feature_spec.md / schema.sql

---

## 목차

1. [개요](#1-개요)
2. [매칭 조건](#2-매칭-조건)
3. [매칭 로직 상세](#3-매칭-로직-상세)
4. [매칭 상태 흐름](#4-매칭-상태-흐름)
5. [화면 구성 상세](#5-화면-구성-상세)
6. [예외 처리](#6-예외-처리)
7. [데이터 예시](#7-데이터-예시)
8. [미결 사항](#8-미결-사항)

---

## 1. 개요

### 1.1 목적
Outgoing 학생(셀러)과 Incoming 학생(바이어)을 자동으로 연결.
학기 종료 D-14일에 같은 지역 파견 예정 바이어와 보유 물품이 겹치면 자동 매칭.

### 1.2 매칭 방식 요약

| 항목 | 내용 |
|------|------|
| 트리거 | 종강 D-14일 (스케줄러) |
| 매칭 기준 | region_group 일치 + 물품 카테고리 겹침 |
| 매칭 단위 | 패키지 단위 (1 셀러 : N 바이어 동시 가능) |
| 수락 기한 | N일 (추후 확정) |
| 미수락 처리 | status = 'cancelled' 자동 처리 |

> ⚠️ **스케줄러(node-cron) 구현은 자산 순환 파트와 협의 필요**

### 1.3 매칭 생성 방식 2가지

| 방식 | 설명 | 저장 테이블 |
|------|------|-----------|
| 자동 매칭 | 종강 D-14일 스케줄러가 자동 생성 | `package_matches` |
| 직접 요청 | 바이어가 패키지 상세에서 "거래 요청하기" 버튼 클릭 | `package_matches` |

두 방식 모두 동일하게 `package_matches` 테이블에 저장. 별도 구분 없이 같은 흐름으로 처리.

**우선순위 정의:**
- 직접 요청이 자동 매칭보다 우선 — 바이어가 직접 요청한 경우 자동 매칭 스킵
- 자동 매칭 실행 시 이미 `pending` / `matched` 상태의 매칭이 있으면 해당 바이어 제외

---

## 2. 매칭 조건

### 2.1 거래 케이스

| 케이스 | 셀러 | 바이어 | 장소 |
|--------|------|--------|------|
| 케이스 1 | Outgoing | Incoming | 고려대 캠퍼스 |
| 케이스 2 | Outgoing | Outgoing | 해외 현지 |
| 케이스 3 | Incoming | Incoming | 고려대 캠퍼스 |

→ **role 제약 없음. region_group 기준으로만 매칭.**

### 2.2 셀러 조건
- `exchange_students.onboarding_completed = TRUE`
- `package_matches.status IN ('pending', 'matched')` — 활성 패키지 있음
- `package_listings` 에 `status = 'selling'` 매물 1개 이상
- 자기 자신과 매칭 불가 (`chk_package_matches_no_self`)

### 2.3 바이어 조건
- `exchange_students.onboarding_completed = TRUE`
- `exchange_wishlists` 에 알림 신청한 항목 1개 이상 (신청 안 한 사용자는 자동 매칭 대상 제외)
- 아직 같은 패키지 + 같은 셀러에 매칭되지 않은 상태

### 2.4 매칭 성립 조건
- 셀러의 `region_group` = 바이어의 `region_group`
- 셀러의 `package_listings.category_id` 와 바이어의 `exchange_wishlists.category_id` 겹치는 항목 1개 이상
- 셀러의 `semester` = 바이어의 `semester`
- 겹치는 물품 없으면 → 조용히 스킵 (바이어에게 별도 알림 없음)

### 2.5 1:N 매칭
- 셀러 한 명이 여러 바이어와 동시에 매칭 가능
- 단, 같은 바이어 + 같은 셀러 + 같은 패키지 조합은 중복 불가 (`ON CONFLICT DO NOTHING`)

---

## 3. 매칭 로직 상세

### 3.1 전체 흐름

```
[1] 트리거 — 종강 D-14일
      ↓
[2] 매칭 대상 셀러 조회
      ↓
[3] 셀러별 매칭 가능한 바이어 조회
      ↓
[4] 겹치는 물품 확인
      ↓
[5] 매칭 생성 (package_matches INSERT)
      ↓
[6] 채팅방 생성 (chat_rooms INSERT)
      ↓
[7] 양측 알림 발송
      ↓
[8] 수락 기한 관리
```

---

### 3.2 Step 1 — 트리거

> ⚠️ 스케줄러 구현은 자산 순환 파트와 협의 필요
> 아래는 로직 정의만 포함

```
종강일 기준 D-14일에 실행
→ 현재 활성 학기(semester) 셀러 전체 대상으로 매칭 시도
```

---

### 3.3 Step 2 — 매칭 대상 셀러 조회

```sql
SELECT
    es.uid AS seller_uid,
    es.region_group,
    es.semester,
    pm.match_id,
    pm.package_id
FROM exchange_students es
JOIN package_matches pm
    ON pm.seller_uid = es.uid
    AND pm.status = 'pending'
WHERE es.onboarding_completed = TRUE   -- role 제약 없음
  AND es.semester = :current_semester
  AND EXISTS (
      SELECT 1 FROM package_listings pl
      WHERE pl.match_id = pm.match_id
        AND pl.status = 'selling'
  );
```

---

### 3.4 Step 3 — 바이어 조회

```sql
SELECT
    es.uid AS buyer_uid,
    es.region_group,
    es.semester
FROM exchange_students es
WHERE es.onboarding_completed = TRUE   -- role 제약 없음
  AND es.semester = :seller_semester
  AND es.region_group = :seller_region_group
  AND es.uid != :seller_uid            -- 자기 자신 제외
  AND EXISTS (
      -- exchange_wishlists 알림 신청한 사용자만 대상
      SELECT 1 FROM exchange_wishlists ew
      WHERE ew.uid = es.uid
        AND ew.deleted_at IS NULL
  )
  AND NOT EXISTS (
      -- 이미 같은 패키지 + 같은 셀러에 매칭된 바이어 제외
      SELECT 1 FROM package_matches pm
      WHERE pm.buyer_uid = es.uid
        AND pm.package_id = :package_id
        AND pm.seller_uid = :seller_uid
        AND pm.status IN ('pending', 'matched')
  );
```

> **1:N 매칭**: 같은 셀러가 여러 바이어와 동시에 매칭될 수 있음.
> 단, 동일한 바이어 + 셀러 + 패키지 조합은 중복 불가.

---

### 3.5 Step 4 — 겹치는 물품 확인

```sql
SELECT COUNT(*) AS overlap_count
FROM package_listings pl
JOIN exchange_wishlists ew
    ON ew.category_id = pl.category_id
    AND ew.uid = :buyer_uid
    AND ew.deleted_at IS NULL
WHERE pl.match_id = :match_id
  AND pl.status = 'selling';
```

```
overlap_count >= 1 → 매칭 진행
overlap_count = 0  → 조용히 스킵 (바이어에게 별도 알림 없음)
```

---

### 3.6 Step 5 — 매칭 생성

```sql
INSERT INTO package_matches (
    package_id,
    buyer_uid,
    seller_uid,
    status,
    semester
)
VALUES (
    :package_id,
    :buyer_uid,
    :seller_uid,
    'pending',
    :semester
)
ON CONFLICT DO NOTHING;   -- 중복 매칭 방지
```

---

### 3.7 Step 6 — 채팅방 생성

매칭 생성 직후 채팅방 자동 생성:

```sql
-- 채팅방 생성
INSERT INTO chat_rooms (package_match_id)
VALUES (:new_match_id)
RETURNING room_id;

-- 참여자 등록 (바이어 + 셀러)
INSERT INTO chat_participants (room_id, uid)
VALUES
    (:room_id, :buyer_uid),
    (:room_id, :seller_uid);
```

---

### 3.8 Step 7 — 알림 발송

> ⚠️ 알림 방식(FCM / 이메일)은 팀 전체 합의 필요

| 대상 | 알림 내용 |
|------|---------|
| 바이어 | "원하는 물품을 보유한 셀러와 매칭됐어요! 채팅방을 확인해보세요." |
| 셀러 | "새로운 바이어와 매칭됐어요! 채팅방을 확인해보세요." |

---

### 3.9 Step 8 — 수락 기한 관리

> ⚠️ 수락 기한 N일은 추후 팀 논의 후 확정

```
매칭 생성 후 N일 경과
→ status = 'pending' 인 매칭 조회
→ status = 'cancelled' 로 업데이트
→ 채팅방 soft delete (deleted_at 업데이트)
→ 양측 알림 발송 ("매칭이 만료됐어요")
```

```sql
-- 만료 처리
UPDATE package_matches
SET status = 'cancelled',
    updated_at = NOW()
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL ':n days';
```

---

## 4. 매칭 상태 흐름

```
[자동 매칭 생성 / 직접 요청]
          ↓
       pending
       (매칭 대기)
      ↓         ↓         ↓
  matched    cancelled  cancelled
  (채팅 시작)  (기한 만료)  (수동 취소)
      ↓
  completed
  (거래 완료)
```

### 4.1 상태별 정의

| 상태 | 설명 | 전환 조건 |
|------|------|---------|
| `pending` | 매칭 생성, 채팅 대기 | 자동 매칭 생성 또는 직접 요청 시 |
| `matched` | 채팅 진행 중 | 채팅방 첫 메시지 전송 시 자동 전환 |
| `completed` | 거래 완료 | 채팅방 내 "거래 완료" 버튼 클릭 |
| `cancelled` | 취소 / 만료 | 기한 만료 또는 수동 취소 |

### 4.2 수락 방식 — 채팅방 진입 = 수락

별도 수락 버튼 없음. 채팅방에서 첫 메시지 전송 시 자동으로 `matched` 처리.

```sql
-- 첫 메시지 전송 시 matched 처리
UPDATE package_matches
SET status = 'matched',
    updated_at = NOW()
WHERE match_id = :match_id
  AND status = 'pending';
```

### 4.3 수동 취소 흐름

**바이어가 취소하는 경우:**
```
채팅방 상단 "매칭 취소" 버튼 클릭
→ 취소 확인 모달 ("정말 취소하시겠어요?")
→ 확인 클릭
→ package_matches.status = 'cancelled'
→ 셀러에게 알림 ("바이어가 매칭을 취소했어요")
→ 채팅방 비활성화 (메시지 입력 불가)
```

**셀러가 취소하는 경우:**
```
채팅방 상단 "매칭 취소" 버튼 클릭
→ 취소 확인 모달
→ 확인 클릭
→ package_matches.status = 'cancelled'
→ 바이어에게 알림 ("셀러가 매칭을 취소했어요")
→ 채팅방 비활성화
```

```sql
-- 수동 취소 처리
UPDATE package_matches
SET status = 'cancelled',
    updated_at = NOW()
WHERE match_id = :match_id
  AND status IN ('pending', 'matched')
  AND (buyer_uid = :current_uid OR seller_uid = :current_uid);
```

### 4.4 1:N 매칭 처리

- 셀러 한 명이 여러 바이어와 동시에 `pending` / `matched` 상태 가능
- 셀러는 모든 바이어와 채팅 진행 후 한 명과 `completed` 처리
- `completed` 처리 시 나머지 바이어 매칭 자동 `cancelled`

```sql
-- 거래 완료 처리 시 나머지 매칭 cancelled
UPDATE package_matches
SET status = 'cancelled',
    updated_at = NOW()
WHERE seller_uid = :seller_uid
  AND package_id = :package_id
  AND match_id != :completed_match_id
  AND status IN ('pending', 'matched');
```

---

## 5. 화면 구성 상세

### 5.0 사전 단계 화면

#### 5.0.1 셀러 — 패키지 등록 흐름

```
[셀러] 패키지 등록 시작
      ↓
┌─────────────────────────────────────┐
│  패키지 템플릿 선택 (/sell/template)  │
├─────────────────────────────────────┤
│  [DORM_BASIC]                       │
│  기숙사 기본 패키지                   │
│  이불, 베개, 토퍼, 전기밥솥 외 10개   │
│                                     │
│  [FLAT_FULL]                        │
│  자취/플랫셰어 풀 패키지              │
│  기숙사 패키지 + 주방용품 외 6개      │
│                                     │
│  [INCOMING_DORM]                    │
│  고려대 기숙사 입주 패키지            │
│  고려대 기숙사 규격 맞춤 구성         │
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│  보유 물품 체크 (/sell/register)     │
│  체크한 물품 3 / 전체 14             │
├─────────────────────────────────────┤
│  [필수 항목]                         │
│  ☑ 이불        세탁완료 ✅           │
│  ☑ 베개        세탁완료 ✅           │
│  ☑ 토퍼        인증 필요 ⚠️         │  ← 세탁 인증 미완료
│  ☐ 전기밥솥                         │
│  ☐ 스탠드 조명                       │
│                                     │
│  [선택 항목]                         │
│  ☐ 청소기                           │
│  ☐ 빨래 건조대                       │
├─────────────────────────────────────┤
│  학기 선택: [2026-1 ▼]              │
│  희망 가격: [________] 원            │
│                                     │
│  ⚠️ 세탁 인증 미완료 항목 있음        │
│  → [세탁 인증하러 가기]              │
│                                     │
│  [게시하기] (미인증 항목 있으면 비활성) │
└─────────────────────────────────────┘
```

#### 5.0.2 바이어 — 알림 신청 흐름

```
[바이어] 패키지 상세에서 미보유 물품 확인
      ↓
┌─────────────────────────────────────┐
│  패키지 상세 (/packages/[id])        │
│                                     │
│  [미보유 항목]                        │
│  ❌ 청소기                           │
│     현재 매물이 없어요               │
│     [알림 신청하기] ← 클릭            │
│                                     │
│  ❌ 빨래 건조대                       │
│     → 일반 매물 보러가기             │
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│  알림 신청 완료                       │
│                                     │
│  청소기 매물이 올라오면               │
│  알림을 보내드릴게요! 🔔              │
│                                     │
│  [알림 신청 목록 보기]               │
└─────────────────────────────────────┘
      ↓
┌─────────────────────────────────────┐
│  알림 신청 목록 (/wishlist)          │
├─────────────────────────────────────┤
│  청소기                              │
│  독일 · 2026-1 · 대기 중 🔔          │
│                           [삭제]    │
├─────────────────────────────────────┤
│  빨래 건조대                          │
│  독일 · 2026-1 · 알림 발송됨 ✅       │
│                           (삭제불가) │
└─────────────────────────────────────┘
```

```
┌─────────────────────────────────────┐
│  진행 중인 매칭                        │
├─────────────────────────────────────┤
│  [매칭 카드 1]                        │
│  기숙사 기본 패키지                    │
│  셀러: 김민준 / 2026-1               │
│  상태: 🔄 수락 대기 중                 │
│  [채팅방 이동]                        │
├─────────────────────────────────────┤
│  [매칭 카드 2]                        │
│  기숙사 기본 패키지                    │
│  셀러: 이서연 / 2026-1               │
│  상태: 💬 채팅 진행 중                 │
│  [채팅방 이동]                        │
└─────────────────────────────────────┘
```

### 5.2 셀러 — 메인 대시보드 매칭 현황

```
┌─────────────────────────────────────┐
│  내 패키지 매칭 현황                   │
│  기숙사 기본 패키지 · 3명 매칭 중       │
├─────────────────────────────────────┤
│  [바이어 카드 1]                      │
│  바이어: Emma / 독일 / 2026-1        │
│  겹치는 물품: 이불, 베개, 전기밥솥      │
│  상태: 🔄 수락 대기 중                 │
│  [채팅방 이동]                        │
├─────────────────────────────────────┤
│  [바이어 카드 2]                      │
│  바이어: Lucas / 독일 / 2026-1       │
│  겹치는 물품: 이불, 스탠드             │
│  상태: 💬 채팅 진행 중                 │
│  [채팅방 이동]                        │
├─────────────────────────────────────┤
│  [바이어 카드 3]                      │
│  바이어: Yuki / 독일 / 2026-1        │
│  겹치는 물품: 베개, 토퍼              │
│  상태: 🔄 수락 대기 중                 │
│  [채팅방 이동]  [매칭 취소]            │
└─────────────────────────────────────┘
```

### 5.3 채팅방 상단 — 매칭 상태 표시

**바이어 입장:**
```
┌─────────────────────────────────────┐
│  ← 김민준                             │
│  기숙사 기본 패키지 · 수락 대기 중 🔄   │
│  자동 번역 ON · DeepL      [매칭 취소] │
└─────────────────────────────────────┘
```

**셀러 입장 (거래 완료 가능):**
```
┌─────────────────────────────────────┐
│  ← Emma                              │
│  기숙사 기본 패키지 · 채팅 진행 중 💬   │
│  자동 번역 ON · DeepL  [거래완료] [취소]│
└─────────────────────────────────────┘
```

### 5.4 거래 완료 처리 모달 (셀러)

```
┌─────────────────────────────────────┐
│  거래를 완료하시겠어요?                 │
│                                     │
│  Emma님과의 거래를 완료하면            │
│  다른 바이어 2명의 매칭이              │
│  자동으로 취소됩니다.                  │
│                                     │
│  [취소]          [거래 완료]          │
└─────────────────────────────────────┘
```

### 5.5 매칭 알림 카드 (앱 푸시 / 이메일)

```
┌─────────────────────────────────────┐
│  🎉 새로운 매칭이 생겼어요!             │
│                                     │
│  기숙사 기본 패키지                    │
│  셀러: 김민준 (독일 · 기숙사)          │
│  겹치는 물품: 이불, 베개, 전기밥솥      │
│                                     │
│  [채팅방 확인하기]                    │
└─────────────────────────────────────┘
```

---

## 6. 예외 처리

| 상황 | 처리 방식 |
|------|----------|
| 매칭 가능한 바이어 없음 | 매칭 스킵, 다음 스케줄러 실행 시 재시도 |
| 겹치는 물품 없음 | 조용히 스킵, 바이어에게 알림 없음 |
| 알림 신청 안 한 바이어 | 자동 매칭 대상 제외 |
| 직접 요청 바이어 재자동매칭 시도 | 기존 매칭 유지, 자동 매칭 스킵 |
| 1:N 매칭 중복 시도 | `ON CONFLICT DO NOTHING` 으로 차단 |
| 수동 취소 | status = 'cancelled', 상대방 알림 발송 |
| 거래 완료 시 나머지 바이어 | status = 'cancelled' 자동 처리 + 알림 |
| 이미 cancelled 된 매칭 취소 시도 | "이미 취소된 매칭이에요" 안내 |
| 수락 기한 만료 | status = 'cancelled' 자동 처리 |
| 셀러가 매물 삭제 | `package_listings.status = 'sold'` 로 변경, 기존 매칭 유지 |
| 바이어가 알림 신청 취소 | `exchange_wishlists.deleted_at` 업데이트, 기존 매칭 유지 |
| 자기 자신과 매칭 시도 | `chk_package_matches_no_self` CHECK 제약으로 차단 |

---

## 7. 데이터 예시

### 7.1 매칭 생성 예시

```json
{
  "match_id": 201,
  "package_id": 1,
  "buyer_uid": "uuid-buyer-001",
  "seller_uid": "uuid-seller-001",
  "status": "pending",
  "semester": "2026-1",
  "created_at": "2026-04-17T09:00:00Z"
}
```

### 7.2 겹치는 물품 예시

```
셀러 보유 물품 (package_listings):
  - 이불 (category_id: 10)
  - 베개 (category_id: 11)
  - 전기밥솥 (category_id: 15)

바이어 알림 신청 (exchange_wishlists):
  - 이불 (category_id: 10) ← 겹침 ✅
  - 베개 (category_id: 11) ← 겹침 ✅
  - 청소기 (category_id: 20)

overlap_count = 2 → 매칭 진행
```

### 7.3 채팅방 생성 예시

```json
{
  "room_id": 301,
  "product_id": null,
  "package_match_id": 201,
  "created_at": "2026-04-17T09:00:01Z"
}
```

---

## 8. 미결 사항

| 항목 | 내용 | 확인 대상 |
|------|------|---------|
| 스케줄러 구현 | node-cron 담당 파트 | 자산 순환 파트 |
| 수락 기한 N일 | 며칠로 설정할지 | 팀 전체 |
| 수락 방식 | 채팅 진입 vs 명시적 수락 버튼 | 팀 전체 |
| 알림 방식 | FCM / 이메일 / 둘 다 | 팀 전체 |
| 종강일 기준 | 어떤 날짜를 종강일로 설정할지 | 팀 전체 |
